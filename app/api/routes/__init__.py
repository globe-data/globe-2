from .analytics import analytics_router

# No need to re-export since it's imported directly in router.py
__all__ = [analytics_router]
