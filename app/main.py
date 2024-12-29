# Standard library imports
from contextlib import asynccontextmanager

# Third-party imports
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from logging import getLogger
import uvicorn
from .config.settings import settings
from .api import api_router
from app.db.mongodb import db
from app.middleware.security import SecurityMiddleware

# Configure logger
logger = getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.connect_to_database()
    yield
    # Shutdown
    await db.close_database_connection()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    debug=settings.debug,
    lifespan=lifespan,
)

# Add debug middleware to log all requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.debug(f"Incoming {request.method} request to {request.url.path}")
    logger.debug(f"Headers: {request.headers}")
    response = await call_next(request)
    logger.debug(f"Response status: {response.status_code}")
    return response

# CORS middleware should be first
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Type", "Content-Encoding"],
)

# Then other middleware
app.add_middleware(SecurityMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Mount the API router
app.include_router(api_router, prefix="/api")
logger.debug(f"Registered routes: {[route for route in app.routes]}")

@app.get("/status")
async def status():
    try:
        if not db.client:
            return {"status": "error", "message": "Database not connected"}
        return {"status": "ok", "message": "API is operational"}
    except Exception as e:
        logger.error(f"Error checking status: {str(e)}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="debug"
    )
