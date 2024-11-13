from app.db.factory import get_storage
from fastapi import Depends
from app.db.interface import AnalyticsStorage

def get_db() -> AnalyticsStorage:
    return get_storage() 