from abc import ABC, abstractmethod

import pandas as pd


class Connector(ABC):
    """Read-only data source connector interface."""

    @abstractmethod
    def test(self) -> bool:
        ...

    @abstractmethod
    def list_databases(self) -> list[str]:
        ...

    @abstractmethod
    def list_tables(self, database: str) -> list[str]:
        ...

    @abstractmethod
    def list_columns(self, database: str, table: str) -> list[dict]:
        ...

    @abstractmethod
    def fetch(self, query: str) -> pd.DataFrame:
        ...
