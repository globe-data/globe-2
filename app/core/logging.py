import logging
import sys
from logging.handlers import RotatingFileHandler
from app.core.config import Settings
from datetime import datetime, timezone

def setup_logging(settings: Settings) -> logging.Logger:
    logger = logging.getLogger("analytics")
    logger.setLevel(logging.DEBUG)  # Set to DEBUG to see all logs

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler
    file_handler = RotatingFileHandler(
        'analytics.log',
        maxBytes=10485760,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger

# Helper function to get logger instance
def get_logger(name: str = "analytics") -> logging.Logger:
    return logging.getLogger(name)

# Context manager for timing operations
class LoggerTimer:
    def __init__(self, logger: logging.Logger, operation: str):
        self.logger = logger
        self.operation = operation
        self.start_time = None
        
    def __enter__(self):
        self.start_time = datetime.now(timezone.utc)
        self.logger.debug(f"Starting operation: {self.operation}")
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.now(timezone.utc) - self.start_time).total_seconds()
        if exc_type:
            self.logger.error(
                f"Operation {self.operation} failed after {duration:.2f}s",
                exc_info=(exc_type, exc_val, exc_tb)
            )
        else:
            self.logger.info(f"Operation {self.operation} completed in {duration:.2f}s")

# Example usage:
"""
from app.core.logging import get_logger, LoggerTimer

logger = get_logger(__name__)

# Basic logging
logger.info("Processing batch of events", extra={"batch_size": 100})
logger.error("Failed to process event", exc_info=True)

# Timing operations
with LoggerTimer(logger, "process_batch"):
    # Your code here
    process_events(batch)
""" 