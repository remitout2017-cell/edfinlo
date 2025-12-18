"""
app.py - FastAPI Server for Admission Letter Processing with Multi-Threading/Multi-Processing
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
from uuid import uuid4
import json
from datetime import datetime

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from redis.asyncio import Redis
import structlog

from config import settings
from middleware.rate_limiter import RateLimiterMiddleware
from agents.admission_letter_workflow import (
    AdmissionLetterWorkflowOrchestrator,
    ProcessAdmissionLetterRequest,
    ProcessAdmissionLetterResponse,
)
from cache.redis_manager import RedisCacheManager
from utils.performance_monitor import PerformanceMonitor
from models.task_queue import TaskQueue, TaskStatus

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
logger = structlog.get_logger()

# Global executors for multi-threading/processing
thread_pool = ThreadPoolExecutor(max_workers=settings.THREAD_POOL_SIZE)
process_pool = ProcessPoolExecutor(max_workers=settings.WORKER_COUNT)

# Redis connection pool
redis_client: Optional[Redis] = None
cache_manager: Optional[RedisCacheManager] = None
task_queue: Optional[TaskQueue] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global redis_client, cache_manager, task_queue
    
    # Startup
    logger.info("Starting Admission Letter Agent V2 Server")
    
    # Initialize Redis
    redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    await redis_client.ping()
    
    # Initialize cache manager
    cache_manager = RedisCacheManager(redis_client)
    
    # Initialize task queue
    task_queue = TaskQueue(redis_client)
    
    # Initialize workflow orchestrator
    AdmissionLetterWorkflowOrchestrator.initialize()
    
    logger.info(f"Server started with {settings.WORKER_COUNT} workers")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Admission Letter Agent V2 Server")
    thread_pool.shutdown(wait=True)
    process_pool.shutdown(wait=True)
    if redis_client:
        await redis_client.close()

# Create FastAPI app
app = FastAPI(
    title="Admission Letter Agent V2",
    description="Multi-agent AI system for processing university admission letters",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting middleware
if settings.ENABLE_RATE_LIMITER:
    app.add_middleware(RateLimiterMiddleware)

# Request/Response Models
class AdmissionLetterRequest(BaseModel):
    """Request model for admission letter processing"""
    cloudinary_url: str = Field(..., description="Cloudinary URL of the admission letter")
    file_type: str = Field(..., description="File type (pdf, jpg, png, etc.)")
    user_id: Optional[str] = Field(None, description="Optional user ID for tracking")
    session_id: Optional[str] = Field(None, description="Optional session ID")
    enable_improvements: bool = Field(True, description="Enable improvement recommendations")
    priority: str = Field("normal", description="Processing priority (low, normal, high)")

class AdmissionLetterResponse(BaseModel):
    """Response model for admission letter processing"""
    task_id: str = Field(..., description="Unique task ID")
    status: str = Field(..., description="Task status")
    message: Optional[str] = Field(None, description="Status message")
    estimated_wait_time: Optional[int] = Field(None, description="Estimated wait time in seconds")
    result_url: Optional[str] = Field(None, description="URL to fetch results when ready")

class TaskStatusResponse(BaseModel):
    """Task status response model"""
    task_id: str
    status: str
    progress: int = Field(0, ge=0, le=100)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    processing_time_ms: Optional[int] = None

# Performance monitoring
performance_monitor = PerformanceMonitor()

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Admission Letter Agent V2",
        "version": "2.0.0",
        "status": "operational",
        "workers": settings.WORKER_COUNT,
        "threads": settings.THREAD_POOL_SIZE,
        "uptime": performance_monitor.get_uptime()
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check Redis connection
        if redis_client:
            await redis_client.ping()
        
        # Check if orchestrator is initialized
        if not AdmissionLetterWorkflowOrchestrator.is_initialized():
            raise HTTPException(status_code=503, detail="Orchestrator not initialized")
        
        return {
            "status": "healthy",
            "redis": "connected",
            "agents": "initialized",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")

@app.post("/api/v1/admission-letter/process", response_model=AdmissionLetterResponse)
async def process_admission_letter(
    request: AdmissionLetterRequest,
    background_tasks: BackgroundTasks
):
    """
    Process an admission letter using multi-agent AI workflow
    
    This endpoint accepts a Cloudinary URL and returns a task ID for async processing
    """
    # Generate task ID
    task_id = f"task_{uuid4().hex[:16]}"
    
    # Validate input
    if not request.cloudinary_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL format")
    
    # Check cache first
    if settings.ENABLE_CACHE and cache_manager:
        cache_key = f"admission:{hash(request.cloudinary_url)}"
        cached_result = await cache_manager.get(cache_key)
        if cached_result:
            logger.info("Cache hit for admission letter", url_hash=hash(request.cloudinary_url))
            return AdmissionLetterResponse(
                task_id=task_id,
                status="completed",
                message="Result retrieved from cache",
                result_url=f"/api/v1/tasks/{task_id}/result"
            )
    
    # Create task in queue
    task_data = {
        "cloudinary_url": request.cloudinary_url,
        "file_type": request.file_type,
        "user_id": request.user_id,
        "session_id": request.session_id or str(uuid4()),
        "enable_improvements": request.enable_improvements,
        "priority": request.priority,
        "created_at": datetime.utcnow().isoformat()
    }
    
    await task_queue.add_task(task_id, task_data)
    
    # Schedule background processing based on priority
    background_tasks.add_task(
        process_admission_letter_background,
        task_id,
        request.cloudinary_url,
        request.file_type,
        request.enable_improvements,
        request.priority
    )
    
    return AdmissionLetterResponse(
        task_id=task_id,
        status="queued",
        message="Admission letter processing started",
        estimated_wait_time=estimate_wait_time(request.priority),
        result_url=f"/api/v1/tasks/{task_id}"
    )

@app.get("/api/v1/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """Get status of a processing task"""
    if not task_queue:
        raise HTTPException(status_code=503, detail="Task queue not available")
    
    task = await task_queue.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return TaskStatusResponse(**task)

@app.get("/api/v1/tasks/{task_id}/result")
async def get_task_result(task_id: str):
    """Get processing result for a completed task"""
    if not task_queue:
        raise HTTPException(status_code=503, detail="Task queue not available")
    
    task = await task_queue.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="Task not completed yet")
    
    if "error" in task and task["error"]:
        raise HTTPException(status_code=500, detail=task["error"])
    
    return JSONResponse(content=task.get("result", {}))

@app.get("/api/v1/metrics")
async def get_metrics():
    """Get performance metrics"""
    return {
        "performance": performance_monitor.get_metrics(),
        "queue_stats": await task_queue.get_stats() if task_queue else {},
        "system": {
            "active_threads": thread_pool._max_workers,
            "active_processes": process_pool._max_workers,
            "memory_usage": performance_monitor.get_memory_usage(),
        }
    }

async def process_admission_letter_background(
    task_id: str,
    cloudinary_url: str,
    file_type: str,
    enable_improvements: bool,
    priority: str
):
    """Background task processor with multi-processing option"""
    try:
        # Update task status to processing
        await task_queue.update_task_status(task_id, "processing", progress=10)
        
        # Process based on priority and available resources
        if settings.ENABLE_MULTI_PROCESSING and priority == "high":
            # Use process pool for high priority tasks
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                process_pool,
                process_with_multiprocessing,
                cloudinary_url,
                file_type,
                enable_improvements
            )
        else:
            # Use thread pool for normal/low priority
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                thread_pool,
                process_with_multithreading,
                cloudinary_url,
                file_type,
                enable_improvements
            )
        
        # Update task with result
        await task_queue.complete_task(task_id, result)
        
        # Cache result if enabled
        if settings.ENABLE_CACHE and cache_manager:
            cache_key = f"admission:{hash(cloudinary_url)}"
            await cache_manager.set(cache_key, result, ttl=settings.REDIS_CACHE_TTL)
        
        logger.info("Background processing completed", task_id=task_id)
        
    except Exception as e:
        logger.error("Background processing failed", task_id=task_id, error=str(e))
        await task_queue.fail_task(task_id, str(e))

def process_with_multiprocessing(cloudinary_url: str, file_type: str, enable_improvements: bool):
    """Process using multiprocessing"""
    # Import here to avoid serialization issues
    from agents.admission_letter_workflow import AdmissionLetterWorkflowOrchestrator
    
    return AdmissionLetterWorkflowOrchestrator.process_admission_letter_sync(
        cloudinary_url=cloudinary_url,
        file_type=file_type,
        enable_improvements=enable_improvements
    )

def process_with_multithreading(cloudinary_url: str, file_type: str, enable_improvements: bool):
    """Process using multithreading"""
    from agents.admission_letter_workflow import AdmissionLetterWorkflowOrchestrator
    
    return AdmissionLetterWorkflowOrchestrator.process_admission_letter_sync(
        cloudinary_url=cloudinary_url,
        file_type=file_type,
        enable_improvements=enable_improvements
    )

def estimate_wait_time(priority: str) -> int:
    """Estimate wait time based on priority"""
    estimates = {
        "high": 10,  # 10 seconds
        "normal": 30,  # 30 seconds
        "low": 60  # 1 minute
    }
    return estimates.get(priority, 30)

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=settings.APP_PORT,
        workers=settings.WORKER_COUNT,
        reload=False
    )