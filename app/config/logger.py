import logging
import sys

def setup_logger(log_level: str = "INFO") -> logging.Logger:
    # Create and configure logger
    logger = logging.getLogger("api")
    
    # Prevent duplicate logging
    if logger.hasHandlers():
        logger.handlers.clear()
        
    logger.setLevel(getattr(logging, log_level.upper()))

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    return logger

# Create logger instance
logger = setup_logger()

