# Globe Data Analytics Service

A high-performance, scalable analytics service built with FastAPI and TypeScript that provides comprehensive user behavior tracking and analysis capabilities.

## Features

- Real-time event tracking and processing
- Support for multiple event types:
  - Pageviews
  - Clicks
  - Scrolling
  - Media interactions
  - Form submissions
  - Conversions
  - Errors
  - Performance metrics
  - Visibility changes
  - Location tracking
  - Tab interactions
  - Storage operations
  - Resource loading
  - Idle states
  - Custom events
- Efficient batch processing with compression
- Automatic retry mechanism for failed requests
- Session management
- Robust error handling and validation
- Dynamic element tracking
- Conversion tracking
- Comprehensive system information collection

## Architecture

### Backend (FastAPI)

- RESTful API built with FastAPI
- MongoDB for data storage
- Async/await pattern for high performance
- Pydantic models for validation
- Middleware for compression, CORS, and security
- Comprehensive logging

### Frontend (TypeScript)

- Web Worker for background processing
- IndexedDB for offline storage
- Batch processing with retry logic
- Mutation observer for dynamic content
- Intersection observer for visibility tracking

## API Endpoints

- `POST /api/analytics/batch` - Process batches of analytics events
- `GET /api/analytics/events` - Retrieve analytics events with filtering
- `POST /api/sessions` - Create new analytics sessions
- `PATCH /api/sessions/{session_id}` - Update session information

## Data Models

Comprehensive type definitions for all analytics events including:

- Base Event interface
- System information models
- Specific event type models
- Request/response models
