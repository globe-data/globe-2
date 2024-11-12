from confluent_kafka import Producer, Consumer
from app.core.config import Settings

class KafkaService:
    def __init__(self, settings: Settings):
        self.producer = Producer({
            'bootstrap.servers': settings.KAFKA_SERVERS,
            'client.id': 'analytics-producer'
        })
