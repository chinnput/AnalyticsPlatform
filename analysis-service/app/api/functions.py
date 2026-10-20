from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import functions as registry

router = APIRouter(prefix="/functions", tags=["functions"])


class RunRequest(BaseModel):
    data: dict  # {"timestamps": [...], "series": {tag: [...]}} — รูปแบบเดียวกับผลจาก /data
    params: dict = {}


@router.get("")
def list_functions():
    return {"functions": registry.list_meta(), "errors": registry.errors()}


@router.post("/{name}/run")
def run_function(name: str, req: RunRequest):
    try:
        return {"name": name, "output": registry.run(name, req.data, req.params)}
    except registry.FunctionError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # noqa: BLE001 — error ภายในตัวฟังก์ชันเอง
        raise HTTPException(status_code=500, detail=f"ฟังก์ชัน '{name}' error: {exc}")
