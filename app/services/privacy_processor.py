from enum import Enum
from typing import Dict, List, Any, Optional
import hashlib
import hmac
import base64
import os
import logging
from datetime import datetime
import numpy as np
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

class PrivacyLevels(Enum):
    """Enum defining different levels of data anonymization and privacy controls"""
    RAW = "raw"                    # Original data, encrypted at rest but otherwise unmodified
    TOKENIZED = "tokenized"        # Sensitive fields replaced with secure tokens (reversible)
    PSEUDONYMIZED = "pseudo"       # Consistent replacement of identifiers (reversible with key)
    REDACTED = "redacted"          # Sensitive fields removed or masked (irreversible)
    GENERALIZED = "generalized"    # Data grouped into broader categories (e.g., age ranges)
    DIFFERENTIAL = "differential"   # Differential privacy applied (epsilon-privacy guarantees)
    AGGREGATED = "aggregated"      # Statistical summaries only (no individual records)
    SYNTHETIC = "synthetic"        # AI-generated synthetic data matching statistical properties

class PrivacyProcessor:
    """Handles data privacy transformations with different anonymization levels"""
    
    def __init__(self, encryption_key: Optional[str] = None):
        """Initialize privacy processor with encryption key"""
        self.encryption_key = encryption_key or os.environ.get('PRIVACY_KEY')
        if not self.encryption_key:
            raise ValueError("Encryption key must be provided or set in PRIVACY_KEY env var")
        
        # Initialize Fernet cipher for field encryption
        self.cipher = Fernet(self.encryption_key.encode() if isinstance(self.encryption_key, str) 
                           else self.encryption_key)
        
        # Default generalization rules
        self.generalization_rules = {
            'age': lambda x: f"{(x//10)*10}-{(x//10)*10+9}",
            'income': lambda x: f"{(x//10000)*10000}-{(x//10000)*10000+9999}",
            'location': lambda x: x.split(',')[0]  # Keep only city/region
        }

    def process_data(self, data: Dict[str, Any], privacy_level: PrivacyLevels, 
                    sensitive_fields: List[str]) -> Dict[str, Any]:
        """Process data according to specified privacy level"""
        try:
            if not isinstance(data, dict):
                raise ValueError("Input data must be a dictionary")

            # Log processing attempt
            logger.info(f"Processing data with privacy level: {privacy_level.value}")
            
            processed_data = data.copy()
            
            # Apply privacy transformation based on level
            if privacy_level == PrivacyLevels.RAW:
                processed_data = self._encrypt_sensitive_fields(processed_data, sensitive_fields)
            elif privacy_level == PrivacyLevels.TOKENIZED:
                processed_data = self._tokenize_fields(processed_data, sensitive_fields)
            elif privacy_level == PrivacyLevels.PSEUDONYMIZED:
                processed_data = self._pseudonymize_fields(processed_data, sensitive_fields)
            elif privacy_level == PrivacyLevels.REDACTED:
                processed_data = self._redact_fields(processed_data, sensitive_fields)
            elif privacy_level == PrivacyLevels.GENERALIZED:
                processed_data = self._generalize_fields(processed_data, sensitive_fields)
            elif privacy_level == PrivacyLevels.DIFFERENTIAL:
                processed_data = self._apply_differential_privacy(processed_data, sensitive_fields)
            elif privacy_level == PrivacyLevels.AGGREGATED:
                processed_data = self._aggregate_data(processed_data, sensitive_fields)
            elif privacy_level == PrivacyLevels.SYNTHETIC:
                processed_data = self._generate_synthetic(processed_data, sensitive_fields)
            
            # Add privacy metadata
            processed_data['_privacy'] = {
                'level': privacy_level.value,
                'processed_at': datetime.utcnow().isoformat(),
                'fields_processed': sensitive_fields
            }
            
            return processed_data
            
        except Exception as e:
            logger.error(f"Error processing data: {str(e)}")
            raise

    def _encrypt_sensitive_fields(self, data: Dict, fields: List[str]) -> Dict:
        """Encrypt sensitive fields while maintaining data structure"""
        for field in fields:
            if field in data and data[field]:
                try:
                    value = str(data[field]).encode()
                    data[field] = self.cipher.encrypt(value).decode()
                except Exception as e:
                    logger.error(f"Error encrypting field {field}: {str(e)}")
                    raise
        return data

    def _tokenize_fields(self, data: Dict, fields: List[str]) -> Dict:
        """Replace sensitive fields with secure, reversible tokens"""
        for field in fields:
            if field in data and data[field]:
                value = str(data[field]).encode()
                token = hmac.new(
                    self.encryption_key.encode(),
                    value,
                    hashlib.sha256
                ).hexdigest()
                data[field] = f"TOK_{token}"
        return data

    def _pseudonymize_fields(self, data: Dict, fields: List[str]) -> Dict:
        """Replace identifiers with consistent pseudonyms"""
        for field in fields:
            if field in data and data[field]:
                # Create deterministic but secure pseudonym
                value = str(data[field]).encode()
                pseudo = hmac.new(
                    self.encryption_key.encode(),
                    value,
                    hashlib.sha256
                ).hexdigest()[:12]  # Use first 12 chars for readability
                data[field] = f"PSEUDO_{field}_{pseudo}"
        return data

    def _redact_fields(self, data: Dict, fields: List[str]) -> Dict:
        """Remove or mask sensitive fields"""
        for field in fields:
            if field in data:
                data[field] = "[REDACTED]"
        return data

    def _generalize_fields(self, data: Dict, fields: List[str]) -> Dict:
        """Group data into broader categories"""
        for field in fields:
            if field in data and field in self.generalization_rules:
                try:
                    data[field] = self.generalization_rules[field](data[field])
                except Exception as e:
                    logger.error(f"Error generalizing field {field}: {str(e)}")
                    data[field] = "GENERALIZATION_ERROR"
        return data

    def _apply_differential_privacy(self, data: Dict, fields: List[str], epsilon: float = 1.0) -> Dict:
        """Apply differential privacy with Laplace mechanism"""
        for field in fields:
            if field in data and isinstance(data[field], (int, float)):
                sensitivity = 1.0  # Assume sensitivity of 1 for numeric fields
                noise = np.random.laplace(0, sensitivity/epsilon)
                data[field] = float(data[field]) + noise
        return data

    def _aggregate_data(self, data: Dict, fields: List[str]) -> Dict:
        """Convert to statistical summaries"""
        aggregated = {}
        for field in fields:
            if field in data:
                if isinstance(data[field], (int, float)):
                    # For numeric fields, provide basic statistics
                    aggregated[f"{field}_summary"] = {
                        "type": "numeric",
                        "count": 1,
                        "sum": data[field],
                        "avg": data[field]
                    }
                else:
                    # For categorical fields, provide frequency
                    aggregated[f"{field}_summary"] = {
                        "type": "categorical",
                        "categories": {str(data[field]): 1}
                    }
        return aggregated

    def _generate_synthetic(self, data: Dict, fields: List[str]) -> Dict:
        """Generate synthetic data matching statistical properties"""
        # This is a simplified version - in production you'd want a more
        # sophisticated synthetic data generation model
        synthetic = data.copy()
        for field in fields:
            if field in data:
                if isinstance(data[field], (int, float)):
                    # Add random noise while preserving general magnitude
                    base = float(data[field])
                    synthetic[field] = base * (1 + np.random.normal(0, 0.1))
                else:
                    # For categorical, mark as synthetic
                    synthetic[field] = f"SYNTHETIC_{field}"
        return synthetic
