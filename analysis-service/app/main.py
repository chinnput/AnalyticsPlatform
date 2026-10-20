from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.api.health import router as health_router
from app.api.connections import router as connections_router
from app.api.pi import router as pi_router
from app.api.data import router as data_router
from app.api.analyze import router as analyze_router
from app.api.filter import router as filter_router
from app.api.files import router as files_router
from app.api.functions import router as functions_router

app = FastAPI(title="Analytics Platform - Analysis Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(connections_router)
app.include_router(pi_router)
app.include_router(data_router)
app.include_router(analyze_router)
app.include_router(filter_router)
app.include_router(files_router)
app.include_router(functions_router)


@app.get("/")
def root():
    return {"service": "analysis-service", "version": "0.1.0"}
