from uuid import UUID
from bson import Binary
from typing import Any, Dict, Union

def to_mongo_uuid(uuid_str: Union[str, UUID]) -> Binary:
    """Convert string or UUID to MongoDB Binary UUID format"""
    if isinstance(uuid_str, str):
        uuid_obj = UUID(uuid_str)
    elif isinstance(uuid_str, UUID):
        uuid_obj = uuid_str
    else:
        raise ValueError(f"Invalid UUID format: {uuid_str}")
    return Binary.from_uuid(uuid_obj)

def from_mongo_uuid(binary_uuid: Binary) -> str:
    """Convert MongoDB Binary UUID to string format"""
    if not isinstance(binary_uuid, Binary):
        return str(binary_uuid)
    return str(binary_uuid.as_uuid())

def convert_uuids_to_binary(data: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively convert all UUIDs in a dict to MongoDB Binary format"""
    converted = {}
    for key, value in data.items():
        if isinstance(value, dict):
            converted[key] = convert_uuids_to_binary(value)
        elif isinstance(value, (str, UUID)) and key.endswith('_id'):
            try:
                converted[key] = to_mongo_uuid(value)
            except ValueError:
                converted[key] = value
        else:
            converted[key] = value
    return converted

def convert_binary_to_uuids(data: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively convert all MongoDB Binary UUIDs to strings"""
    converted = {}
    for key, value in data.items():
        if isinstance(value, dict):
            converted[key] = convert_binary_to_uuids(value)
        elif isinstance(value, Binary):
            converted[key] = from_mongo_uuid(value)
        else:
            converted[key] = value
    return converted 