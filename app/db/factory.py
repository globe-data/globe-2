from enum import Enum
from typing import Optional
from .interface import AnalyticsStorage
from .supabase_storage import SupabaseAnalytics
from .timescale_storage import TimescaleAnalytics
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

class StorageType(Enum):
    SUPABASE = "supabase"
    TIMESCALE = "timescale"

_storage_instance: Optional[AnalyticsStorage] = None

def get_storage() -> AnalyticsStorage:
    """
    Factory function to get the configured storage implementation.
    Uses singleton pattern to avoid creating multiple connections.
    """
    global _storage_instance
    
    if _storage_instance is None:
        settings = get_settings()
        storage_type = settings.STORAGE_TYPE.lower()
        
        try:
            storage_type = StorageType(storage_type)
        except ValueError:
            raise ValueError(f"Invalid storage type: {storage_type}. Must be one of: {[t.value for t in StorageType]}")
        
        if storage_type == StorageType.SUPABASE:
            _storage_instance = SupabaseAnalytics()
        elif storage_type == StorageType.TIMESCALE:
            _storage_instance = TimescaleAnalytics()
        else:
            raise ValueError(f"Unhandled storage type: {storage_type}")
            
        logger.info(f"Initialized storage: {type(_storage_instance).__name__}")
    
    return _storage_instance

def reset_storage() -> None:
    """Reset the storage instance (useful for testing)"""
    global _storage_instance
    _storage_instance = None