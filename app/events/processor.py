from typing import Dict, Any
from app.events.schemas.events import EVENT_TYPE_MAPPING, BaseEvent
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
import json
from app.core.logging import get_logger

logger = get_logger(__name__)

class EventProcessor:
    def __init__(self, schema_registry_client: SchemaRegistryClient):
        self.schema_registry = schema_registry_client
        self.serializers: Dict[str, AvroSerializer] = {}
        
        # Initialize serializers for each event type
        for event_type, (_, avro_schema) in EVENT_TYPE_MAPPING.items():
            if avro_schema:
                self.serializers[event_type] = AvroSerializer(
                    schema_str=avro_schema,
                    schema_registry_client=self.schema_registry,
                    to_dict=lambda x, ctx: x.dict()
                )

    async def process_event(self, event_type: str, data: Dict[str, Any]) -> BaseEvent:
        if event_type not in EVENT_TYPE_MAPPING:
            raise ValueError(f"Unknown event type: {event_type}")
            
        event_class, _ = EVENT_TYPE_MAPPING[event_type]
        event = event_class(**data)
        
        return event

    def serialize_event(self, event: BaseEvent) -> bytes:
        serializer = self.serializers.get(event.event_type)
        if serializer:
            return serializer(event.dict(), None)
        return json.dumps(event.dict()).encode('utf-8') 

async def process_events(events):
    logger.info("Processing events", extra={"count": len(events)})
    try:
        # Process events
        logger.debug("Events processed successfully")
    except Exception as e:
        logger.error("Failed to process events", exc_info=True)
        raise