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

    @staticmethod
    def _quote_ident(name: str) -> str:
        # ตรวจ identifier กัน SQL injection แล้วครอบ [] ตามรูปแบบ SQL Server
        if not name or "]" in name or "[" in name:
            raise ValueError(f"identifier ไม่ถูกต้อง: {name!r}")
        return f"[{name}]"

    def fetch_timeseries(
        self,
        database: str,
        table: str,
        time_col: str,
        value_col: str,
        start: str,
        end: str,
    ) -> pd.DataFrame:
        """ดึง time-series 1 คอลัมน์ (parameterized ค่าเวลา, ครอบ identifier)."""
        if "." in table:
            schema, name = table.split(".", 1)
        else:
            schema, name = "dbo", table
        tbl = f"{self._quote_ident(schema)}.{self._quote_ident(name)}"
        tcol = self._quote_ident(time_col)
        vcol = self._quote_ident(value_col)
        query = (
            f"SELECT {tcol} AS timestamp, {vcol} AS value "
            f"FROM {tbl} "
            f"WHERE {tcol} >= %s AND {tcol} <= %s "
            f"ORDER BY {tcol}"
        )
        with self._connect(database) as conn:
            return pd.read_sql(query, conn, params=(start, end))
