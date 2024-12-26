from fastapi import APIRouter
from .routes.analytics import analytics_router
from .routes.sessions import sessions_router
from .deps import get_current_user, get_database, get_user_repository

# Create main API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(analytics_router, prefix="/analytics")
api_router.include_router(sessions_router, prefix="/sessions")

# Export dependencies and routers
__all__ = [
    "api_router",
    "analytics_router", 
    "sessions_router",
    "get_current_user", 
    "get_database", 
    "get_user_repository"
]