# Standard library imports
from contextlib import asynccontextmanager

# Third-party imports
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from logging import getLogger  

from .config.settings import settings
from .api import api_router  # Import the main api_router
from app.db.mongodb import db

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

# Mount the API router
app.include_router(api_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/status", 
    summary="Check API status",
    description="Returns the current status of the API",
    response_description="API status",
    responses={
        200: {"description": "API is operational"},
        503: {"description": "API is not operational"}
    }
)
async def status():
    try:
        # Check if database is connected
        if not db.client:
            return {"status": "error", "message": "Database not connected"}, 503
        return {"status": "ok", "message": "API is operational"}, 200
    except Exception as e:
        logger.error(f"Error checking status: {str(e)}")
        return {"status": "error", "message": str(e)}, 503


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_includes=["*.py"],
        reload_excludes=["*.pyc"],
    )
