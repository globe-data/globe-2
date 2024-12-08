from fastapi import APIRouter
from .routes.analytics import analytics_router
from .deps import get_current_user, get_database, get_user_repository

# Create main router
router = APIRouter()

# Include the analytics router
router.include_router(analytics_router)

# Export both the main router and other dependencies
__all__ = ["router", "analytics_router", "get_current_user", "get_database", "get_user_repository"]