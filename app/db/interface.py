from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import datetime

class AnalyticsStorage(ABC):
    @abstractmethod
    async def store_event(self, event_data: dict) -> bool:
        """Store a single analytics event"""
        pass

    @abstractmethod
    async def store_events(self, event_data: list[dict]) -> bool:
        """Store a batch of analytics events"""
        pass
    
    @abstractmethod
    async def get_events(
        self,
        start_time: datetime,
        end_time: datetime,
        event_type: Optional[str] = None,
        all_events: bool = False
    ) -> List[dict]:
        """Retrieve events within a time range"""
        pass
    
    @abstractmethod
    async def get_aggregates(
        self,
        metric: str,
        interval: str,
        start_time: datetime,
        end_time: datetime,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[dict]:
        """Get aggregated metrics"""
        pass
    
    @abstractmethod
    async def healthcheck(self) -> bool:
        """Check if storage is accessible"""
        pass