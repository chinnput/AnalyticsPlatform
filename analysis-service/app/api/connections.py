from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.connectors.sql_server import SqlServerConnector

router = APIRouter(prefix="/connections", tags=["connections"])


class SqlServerConfig(BaseModel):
    host: str
    user: str
    password: str
    database: str | None = None
    port: int = 1433


class TablesRequest(SqlServerConfig):
    database: str


class ColumnsRequest(SqlServerConfig):
    database: str
    table: str


def _connector(cfg: SqlServerConfig) -> SqlServerConnector:
    return SqlServerConnector(
        host=cfg.host,
        user=cfg.user,
        password=cfg.password,
        database=cfg.database,
        port=cfg.port,
    )


@router.post("/test")
def test_connection(cfg: SqlServerConfig):
    try:
        _connector(cfg).test()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/databases")
def list_databases(cfg: SqlServerConfig):
    try:
        return {"databases": _connector(cfg).list_databases()}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/tables")
def list_tables(req: TablesRequest):
    try:
        return {"tables": _connector(req).list_tables(req.database)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/columns")
def list_columns(req: ColumnsRequest):
    try:
        return {"columns": _connector(req).list_columns(req.database, req.table)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc))
