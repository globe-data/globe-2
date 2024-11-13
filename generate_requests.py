import random
import json
from datetime import datetime, timedelta
from uuid import uuid4
from typing import Dict, Any, Union

def generate_base_event(event_type: str) -> Dict[str, Any]:
    return {
        "event_id": str(uuid4()),
        "timestamp": (datetime.utcnow()).isoformat(),
        "session_id": f"sess_{uuid4().hex[:8]}",
        "user_id": f"user_{random.randint(1000, 9999)}",
        "client_timestamp": (datetime.utcnow() - timedelta(milliseconds=random.randint(100, 1000))).isoformat(),
        "event_type": event_type,
    }

def generate_pageview() -> Dict[str, Any]:
    paths = ["/", "/products", "/about", "/contact", "/blog", "/checkout"]
    path = random.choice(paths)
    return {
        **generate_base_event("pageview"),
        "data": {
            "url": f"https://example.com{path}",
            "referrer": random.choice([None, "https://google.com", "https://facebook.com"]),
            "title": f"Example - {path.capitalize()[1:]}",
            "path": path,
            "viewport": {
                "width": random.choice([1920, 1440, 1024, 768]),
                "height": random.choice([900, 1080, 768, 1024])
            },
            "load_time": round(random.uniform(0.5, 3.0), 2)
        }
    }

def generate_click() -> Dict[str, Any]:
    elements = ["button.buy-now", "a.nav-link", "div.product-card", "button.add-to-cart"]
    return {
        **generate_base_event("click"),
        "data": {
            "element_path": f"div#main > {random.choice(elements)}",
            "element_text": "Click me",
            "x_pos": random.randint(0, 1920),
            "y_pos": random.randint(0, 1080),
            "href": random.choice([None, "/checkout", "/product/123"])
        }
    }

def generate_scroll() -> Dict[str, Any]:
    max_depth = random.randint(2000, 5000)
    current_depth = random.randint(0, max_depth)
    return {
        **generate_base_event("scroll"),
        "data": {
            "depth": current_depth,
            "direction": random.choice(["up", "down"]),
            "max_depth": max_depth,
            "relative_depth": round(current_depth / max_depth, 2)
        }
    }

def generate_media() -> Dict[str, Any]:
    duration = random.randint(30, 300)
    current = random.randint(0, duration)
    return {
        **generate_base_event("media"),
        "data": {
            "media_type": random.choice(["video", "audio"]),
            "action": random.choice(["play", "pause", "complete"]),
            "media_url": "https://example.com/media/video-1.mp4",
            "playback_time": current,
            "duration": duration,
            "title": "Sample Media"
        }
    }

def generate_form() -> Dict[str, Any]:
    return {
        **generate_base_event("form"),
        "data": {
            "form_id": f"form_{random.randint(1, 5)}",
            "action": random.choice(["submit", "abandon", "error"]),
            "fields": ["email", "name", "message"],
            "success": random.choice([True, False]),
            "error_message": "Invalid email" if random.random() < 0.2 else None
        }
    }

def generate_conversion() -> Dict[str, Any]:
    return {
        **generate_base_event("conversion"),
        "data": {
            "conversion_type": random.choice(["purchase", "signup", "download"]),
            "value": round(random.uniform(10, 1000), 2),
            "currency": "USD",
            "products": [f"prod_{i}" for i in random.sample(range(1, 10), 3)] if random.random() > 0.5 else None
        }
    }

def generate_error() -> Dict[str, Any]:
    return {
        **generate_base_event("error"),
        "data": {
            "error_type": random.choice(["js", "api", "network"]),
            "message": "Something went wrong",
            "stack_trace": "Error: Failed to fetch\n    at API.getData (/src/api.js:123)",
            "component": random.choice(["ProductList", "Checkout", "Cart"])
        }
    }

def generate_performance() -> Dict[str, Any]:
    return {
        **generate_base_event("performance"),
        "data": {
            "metric_name": random.choice(["fcp", "lcp", "cls", "ttfb"]),
            "value": round(random.uniform(0.1, 5.0), 3),
            "navigation_type": random.choice(["navigate", "reload", "back_forward"]),
            "effective_connection_type": random.choice(["4g", "3g", "2g", "slow-2g"])
        }
    }

def generate_events(count: int) -> Dict[str, list]:
    generators = {
        "pageview": generate_pageview,
        "click": generate_click,
        "scroll": generate_scroll,
        "media": generate_media,
        "form": generate_form,
        "conversion": generate_conversion,
        "error": generate_error,
        "performance": generate_performance
    }
    
    events = []
    for _ in range(count):
        generator = random.choice(list(generators.values()))
        events.append(generator())
    
    return {"events": events}

if __name__ == "__main__":
    x = 20
    # Generate x random events
    event_data = generate_events(x)
    
    # Save to file
    with open('test_events.json', 'w') as f:
        json.dump(event_data, f, indent=2)
    
    print(f"Generated test_events.json with {x} random events")