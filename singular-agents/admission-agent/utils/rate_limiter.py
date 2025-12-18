"""
Rate limiter for API calls
"""
import asyncio
import time
from typing import Optional
from collections import deque
import threading

class RateLimiter:
    """Thread-safe rate limiter"""
    
    def __init__(self, max_calls_per_minute: int = 30, min_delay_ms: int = 500):
        self.max_calls_per_minute = max_calls_per_minute
        self.min_delay = min_delay_ms / 1000.0  # Convert to seconds
        self.call_history = deque()
        self.last_call_time = 0
        self.lock = threading.Lock()
    
    async def wait_if_needed(self):
        """Wait if rate limit is exceeded"""
        with self.lock:
            now = time.time()
            
            # Remove old calls from history
            while self.call_history and now - self.call_history[0] > 60:
                self.call_history.popleft()
            
            # Check if we've exceeded rate limit
            if len(self.call_history) >= self.max_calls_per_minute:
                oldest_call = self.call_history[0]
                wait_time = 60 - (now - oldest_call) + 0.1
                if wait_time > 0:
                    print(f"⏳ Rate limit: waiting {wait_time:.2f}s...")
                    await asyncio.sleep(wait_time)
                    now = time.time()  # Update time after sleep
            
            # Ensure minimum delay between calls
            time_since_last_call = now - self.last_call_time
            if time_since_last_call < self.min_delay:
                delay = self.min_delay - time_since_last_call
                await asyncio.sleep(delay)
            
            # Record this call
            self.last_call_time = time.time()
            self.call_history.append(self.last_call_time)