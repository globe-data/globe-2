from fastapi import APIRouter
from .routes.analytics import analytics_router
from .deps import get_current_user, get_database, get_user_repository

# Export dependencies
__all__ = ["analytics_router", "get_current_user", "get_database", "get_user_repository"]