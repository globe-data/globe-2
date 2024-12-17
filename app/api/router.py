from fastapi import APIRouter
from app.api.routes.analytics import analytics_router

# Create and export a single router instance
api_router = APIRouter()

# Include the analytics router
api_router.include_router(analytics_router, prefix="/analytics")
