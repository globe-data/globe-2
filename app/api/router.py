from fastapi import APIRouter
from .routes import analytics_router

router = APIRouter()

# Include the analytics router
router.include_router(analytics_router, prefix="/api/analytics")

# Export the router
__all__ = ["router"]
