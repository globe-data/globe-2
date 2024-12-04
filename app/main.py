from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api import api_router
from app.core.config import Settings
from app.core.logging import setup_logging
from app.db.factory import get_storage

settings = Settings()
logger = setup_logging(settings)

# Initialize storage
storage = get_storage()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Add CORS middleware
origins = [
    "chrome-extension://*",
    "moz-extension://*",
    "safari-extension://*",
    "safari-web-extension://*",
    "http://localhost",  # For testing
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/dist", StaticFiles(directory="dist"), name="dist")

# Include the API router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)