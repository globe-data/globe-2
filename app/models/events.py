from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base
from sqlalchemy.dialects.postgresql import JSONB

Base = declarative_base()

class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    __table_args__ = {"schema": "analytics"}

    id = Column(Integer, primary_key=True)
    event_id = Column(String, unique=True, nullable=False)
    event_type = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    session_id = Column(String, nullable=False, index=True)
    user_id = Column(String, index=True)
    client_timestamp = Column(DateTime(timezone=True))
    data = Column(JSONB, nullable=False)  # Store the full event data

    # Add TimescaleDB hypertable configuration
    # This would be done in migrations:
    # SELECT create_hypertable('analytics.analytics_events', 'timestamp'); 