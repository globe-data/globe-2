import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict
import json
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from core.config import Settings

class JSONFormatter(logging.Formatter):
    def __init__(self):
        super().__init__()
    
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        if record.exc_info:
            log_data["exception"] = {
                "type": str(record.exc_info[0]),
                "value": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info)
            }
            
        if hasattr(record, "extra"):
            log_data.update(record.extra)
            
        return json.dumps(log_data)

def setup_logging(settings: Settings = Settings()) -> logging.Logger:
    """Configure logging for the application."""
    
    # Create logs directory if it doesn't exist
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Initialize logger
    logger = logging.getLogger("analytics")
    logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File Handler for JSON logs
    json_handler = RotatingFileHandler(
        filename=log_dir / "analytics.json",
        maxBytes=10_000_000,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    json_handler.setLevel(logging.INFO)
    json_handler.setFormatter(JSONFormatter())
    logger.addHandler(json_handler)
    
    # Error File Handler
    error_handler = TimedRotatingFileHandler(
        filename=log_dir / "error.log",
        when="midnight",
        interval=1,
        backupCount=30,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s\nStack Trace: %(stack_info)s\n'
    )
    error_handler.setFormatter(error_formatter)
    logger.addHandler(error_handler)
    
    logger.info(f"Logging setup completed. Environment: {settings.ENVIRONMENT}")
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
        self.start_time = datetime.utcnow()
        self.logger.debug(f"Starting operation: {self.operation}")
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.utcnow() - self.start_time).total_seconds()
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