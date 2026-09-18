import pandas as pd
import requests

from app.connectors.base import Connector


class PiServerConnector(Connector):
    """Read-only PI Server connector via MI_CUBE PI Web API (REST)."""

    def __init__(self, api_url: str, token: str, pi_server: str, timeout: int = 40):
        self.api_url = api_url
        self.token = token
        self.pi_server = pi_server
        self.timeout = timeout

    def _headers(self) -> dict:
        return {"Content-Type": "application/json", "Accept": "application/json"}

    def _payload(self, tags: list[str], start, end, interval: str) -> dict:
        fmt = "%Y-%m-%d %H:%M:%S"
        return {
            "token": self.token,
            "server": self.pi_server,
            "tags": tags,
            "start_time": pd.Timestamp(start).strftime(fmt),
            "end_time": pd.Timestamp(end).strftime(fmt),
            "interval": interval,
        }

    def _post(self, payload: dict) -> dict:
        resp = requests.post(
            self.api_url, json=payload, headers=self._headers(), timeout=self.timeout
        )
        if resp.status_code == 401:
            raise RuntimeError("PI token ไม่ถูกต้องหรือหมดอายุ (401)")
        resp.raise_for_status()
        if not resp.text:
            raise RuntimeError("PI API ตอบกลับว่าง (เช็ค tag/ช่วงเวลา/interval)")
        return resp.json()

    def test(self) -> bool:
        # ยิง request จริงช่วงสั้นๆ เพื่อยืนยัน token + endpoint ใช้ได้
        end = pd.Timestamp.now()
        start = end - pd.Timedelta(hours=1)
        self._post(self._payload(["PULP-LINE2-KAPPA-PRESS1"], start, end, "1h"))
        return True

    # PI ไม่มีโครงสร้าง database/table/column — เลือกด้วย tag โดยตรง
    def list_databases(self) -> list[str]:
        raise NotImplementedError("PI Server ไม่มี database ให้เลือก ใช้ tag โดยตรง")

    def list_tables(self, database: str) -> list[str]:
        raise NotImplementedError("PI Server ไม่มี table ให้เลือก ใช้ tag โดยตรง")

    def list_columns(self, database: str, table: str) -> list[dict]:
        raise NotImplementedError("PI Server ไม่มี column ให้เลือก ใช้ tag โดยตรง")

    def fetch(
        self,
        tags: list[str],
        start: str,
        end: str,
        interval: str = "1h",
    ) -> pd.DataFrame:
        """ดึง interpolated values หลาย tag เป็น DataFrame (คอลัมน์ = tag)."""
        data = self._post(self._payload(tags, start, end, interval))
        return self._to_dataframe(data)

    @staticmethod
    def _to_dataframe(payload: dict) -> pd.DataFrame:
        """แปลง response {results: {tag: [{timestamp, value}, ...]}} เป็น DataFrame."""
        results = (payload or {}).get("results") or {}
        frames: list[pd.DataFrame] = []
        for tag, points in results.items():
            if not points:
                continue
            df = pd.DataFrame(points)[["timestamp", "value"]].rename(
                columns={"value": tag}
            )
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            frames.append(df.set_index("timestamp"))
        if not frames:
            return pd.DataFrame(columns=["timestamp"])
        return pd.concat(frames, axis=1).reset_index()
