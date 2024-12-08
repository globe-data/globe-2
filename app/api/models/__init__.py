from .analytics_models import *
from .auth_models import *
import sys

# Get all names from both modules
from . import analytics_models
from . import auth_models

__all__ = (
    getattr(analytics_models, '__all__', []) +
    getattr(auth_models, '__all__', [])
)

print("Available models:", sorted(__all__))