from fastapi import APIRouter
from app.api import analytics_router

router = APIRouter()

# Include the analytics router
router.include_router(analytics_router, prefix="/api/analytics")

# Export the router
__all__ = ["router"]
