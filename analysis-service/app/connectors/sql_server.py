import pandas as pd
import pymssql

from app.connectors.base import Connector


class SqlServerConnector(Connector):
    """Read-only SQL Server connector using pymssql."""

    def __init__(
        self,
        host: str,
        user: str,
        password: str,
        database: str | None = None,
        port: int = 1433,
    ):
        self.host = host
        self.user = user
        self.password = password
        self.database = database
        self.port = port

    def _connect(self, database: str | None = None):
        return pymssql.connect(
            server=self.host,
            user=self.user,
            password=self.password,
            database=database or self.database or "master",
            port=str(self.port),
            login_timeout=10,
            timeout=30,
        )

    def test(self) -> bool:
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchone()
        return True

    def list_databases(self) -> list[str]:
        sql = (
            "SELECT name FROM sys.databases "
            "WHERE database_id > 4 ORDER BY name"
        )
        with self._connect() as conn:
            cur = conn.cursor()
            cur.execute(sql)
            return [row[0] for row in cur.fetchall()]

    def list_tables(self, database: str) -> list[str]:
        sql = (
            "SELECT TABLE_SCHEMA + '.' + TABLE_NAME "
            "FROM INFORMATION_SCHEMA.TABLES "
            "WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW') "
            "ORDER BY TABLE_SCHEMA, TABLE_NAME"
        )
        with self._connect(database) as conn:
            cur = conn.cursor()
            cur.execute(sql)
            return [row[0] for row in cur.fetchall()]

    def list_columns(self, database: str, table: str) -> list[dict]:
        if "." in table:
            schema, name = table.split(".", 1)
        else:
            schema, name = "dbo", table
        sql = (
            "SELECT COLUMN_NAME, DATA_TYPE "
            "FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s "
            "ORDER BY ORDINAL_POSITION"
        )
        with self._connect(database) as conn:
            cur = conn.cursor()
            cur.execute(sql, (schema, name))
            return [{"name": r[0], "type": r[1]} for r in cur.fetchall()]

    def fetch(self, query: str, database: str | None = None) -> pd.DataFrame:
        with self._connect(database) as conn:
            return pd.read_sql(query, conn)
