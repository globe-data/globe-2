from confluent_kafka import Producer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
from app.events.schemas.events import AVRO_SCHEMAS
import json
import logging

logger = logging.getLogger(__name__)

class KafkaProducer:
    def __init__(self):
        self.producer = Producer({
            'bootstrap.servers': 'kafka:9092',
            'client.id': 'analytics-producer'
        })
        
        self.schema_registry = SchemaRegistryClient({
            'url': 'http://schema-registry:8081'
        })
        
        self.serializers = {
            'pageview': AvroSerializer(
                schema_str=json.dumps(AVRO_SCHEMAS['pageview']),
                schema_registry_client=self.schema_registry,
                to_dict=lambda pv, ctx: pv.dict()
            )
        }

    async def produce_event(self, topic: str, event: dict):
        try:
            serializer = self.serializers.get(topic)
            if serializer:
                event_data = serializer(event, None)
            else:
                event_data = json.dumps(event).encode('utf-8')
                
            self.producer.produce(
                topic=f'analytics.{topic}',
                value=event_data,
                on_delivery=self.delivery_report
            )
            self.producer.poll(0)  # Trigger delivery reports
            
        except Exception as e:
            logger.error(f"Failed to produce event: {e}")
            raise

    def delivery_report(self, err, msg):
        if err is not None:
            logger.error(f'Message delivery failed: {err}')
        else:
            logger.debug(f'Message delivered to {msg.topic()} [{msg.partition()}]') 