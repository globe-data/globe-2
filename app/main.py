# Standard library imports
from contextlib import asynccontextmanager

# Third-party imports
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config.settings import settings
from .config.logger import setup_logger
from .api.router import api_router
from app.db.mongodb import db

logger = setup_logger(settings.log_level)


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

# Include the router
app.include_router(api_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_includes=["*.py"],
        reload_excludes=["*.pyc"],
    )
