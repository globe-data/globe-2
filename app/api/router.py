from fastapi import APIRouter
from app.api.routes.analytics import analytics_router
from app.api.routes.sessions import sessions_router

# Create and export a single router instance
api_router = APIRouter()

api_router.include_router(analytics_router, prefix="/analytics")
api_router.include_router(sessions_router, prefix="/sessions")