from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors import file_source

router = APIRouter(prefix="/files", tags=["files"])


class IngestRequest(BaseModel):
    project: str
    fileId: str
    ext: str  # ".csv" | ".xlsx"
    sheet: str | None = None
    timeColumn: str | None = None


# อ่านไฟล์ที่ web บันทึกไว้แล้ว → cache + คืน metadata (columns, ช่วงเวลา, sheets)
@router.post("/ingest")
def ingest(req: IngestRequest):
    try:
        return file_source.ingest(req.project, req.fileId, req.ext, req.sheet, req.timeColumn)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
