"""
Cache decorators for async and sync functions
"""
import asyncio
import functools
import hashlib
import json
from typing import Any, Callable, Optional
from datetime import datetime, timedelta

# In-memory cache (can be replaced with Redis)
_cache = {}
_cache_lock = asyncio.Lock()

def cache_result(ttl: int = 300, key_prefix: str = ""):
    """Cache decorator for synchronous functions"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key_parts = [key_prefix, func.__name__]
            key_parts.extend(str(arg) for arg in args)
            key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
            cache_key = hashlib.md5("|".join(key_parts).encode()).hexdigest()
            
            # Check cache
            if cache_key in _cache:
                cached_item = _cache[cache_key]
                if datetime.now() < cached_item["expires"]:
                    print(f"🔄 Cache hit for {func.__name__}")
                    return cached_item["value"]
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Store in cache
            _cache[cache_key] = {
                "value": result,
                "expires": datetime.now() + timedelta(seconds=ttl)
            }
            
            return result
        
        return wrapper
    return decorator

def async_cache(ttl: int = 300, key_prefix: str = ""):
    """Cache decorator for asynchronous functions"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            async with _cache_lock:
                # Generate cache key
                key_parts = [key_prefix, func.__name__]
                key_parts.extend(str(arg) for arg in args)
                key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()))
                cache_key = hashlib.md5("|".join(key_parts).encode()).hexdigest()
                
                # Check cache
                if cache_key in _cache:
                    cached_item = _cache[cache_key]
                    if datetime.now() < cached_item["expires"]:
                        print(f"🔄 Async cache hit for {func.__name__}")
                        return cached_item["value"]
                
                # Execute function
                result = await func(*args, **kwargs)
                
                # Store in cache
                _cache[cache_key] = {
                    "value": result,
                    "expires": datetime.now() + timedelta(seconds=ttl)
                }
                
                return result
        
        return wrapper
    return decorator