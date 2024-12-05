import logging
import sys
import json
from typing import Any
from datetime import datetime

class PrettyFormatter(logging.Formatter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
    def _format_object(self, obj: Any) -> str:
        """Format any object into a pretty string."""
        if isinstance(obj, (dict, list)):
            return '\n' + json.dumps(obj, indent=4, default=self._json_serial)
        return str(obj)
    
    def _json_serial(self, obj: Any) -> str:
        """JSON serializer for objects not serializable by default json code."""
        if isinstance(obj, datetime):
            return obj.isoformat()
        return str(obj)
    
    def format(self, record: logging.LogRecord) -> str:
        try:
            if isinstance(record.msg, dict):
                # Handle structured logging
                message = record.msg.get('message', '')
                data = record.msg.get('data')
                if data:
                    record.msg = f"{message}: {self._format_object(data)}"
                else:
                    record.msg = self._format_object(record.msg)
            elif isinstance(record.msg, str) and record.args:
                # Handle string formatting with args
                if isinstance(record.args, dict):
                    record.msg = record.msg % record.args
                elif isinstance(record.args, tuple):
                    if len(record.args) == 1 and isinstance(record.args[0], (dict, list)):
                        record.msg = f"{record.msg} {self._format_object(record.args[0])}"
                    else:
                        record.msg = record.msg % record.args
            
            return super().format(record)
        except Exception as e:
            # Fallback formatting if something goes wrong
            return f"{record.asctime} - {record.name} - {record.levelname} - Error formatting log message: {str(e)}"

def setup_logger(log_level: str = "DEBUG") -> logging.Logger:
    # Create and configure logger
    logger = logging.getLogger("api")
    
    # Prevent duplicate logging
    if logger.hasHandlers():
        logger.handlers.clear()
        
    logger.setLevel(getattr(logging, log_level.upper()))

    # Console handler with DEBUG level when in debug mode
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)  # Always set to DEBUG to see all levels
    
    # Create formatter with custom format
    console_formatter = PrettyFormatter(
        '%(asctime)s - %(name)s - %(levelname)s -\n%(message)s'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    return logger

# Create logger instance 
logger = setup_logger()
