"""Registry ของฟังก์ชันคำนวณ

ทุกไฟล์ในโฟลเดอร์นี้ (ยกเว้นชื่อที่ขึ้นต้นด้วย _) ต้องมี:
- META: {name, title, params, output}   output = "series" | "scalar"
- run(data, params) -> dict            data = {"timestamps": [...], "series": {tag: [...]}}
- EXAMPLE: {data, params, expected}    ใช้ตรวจใน tests/test_functions.py

ไฟล์ที่ META/run/EXAMPLE ไม่ครบจะไม่ถูกลงทะเบียน และแสดงใน errors() แทนที่จะทำให้ทั้ง service พัง
"""

import importlib
import math
import pkgutil
from types import ModuleType

PARAM_TYPES = {"tag", "float", "int", "bool", "str"}
OUTPUTS = {"series", "scalar"}
META_KEYS = {"name", "title", "params", "output"}


class FunctionError(ValueError):
    """ข้อผิดพลาดจากการเรียกฟังก์ชัน (เช่น params ผิด, data ผิดรูป) — ส่งกลับเป็น 400"""


_modules: dict[str, ModuleType] = {}
_errors: dict[str, str] = {}


def _check_module(mod: ModuleType) -> str:
    """ตรวจสัญญาของโมดูล คืนชื่อฟังก์ชัน หรือ raise FunctionError"""
    meta = getattr(mod, "META", None)
    if not isinstance(meta, dict):
        raise FunctionError("ไม่มี META")
    missing = META_KEYS - meta.keys()
    if missing:
        raise FunctionError(f"META ขาด field: {', '.join(sorted(missing))}")
    if meta["output"] not in OUTPUTS:
        raise FunctionError(f"output ไม่รองรับ: {meta['output']}")
    for pname, spec in meta["params"].items():
        if spec.get("type") not in PARAM_TYPES:
            raise FunctionError(f"param '{pname}' มี type ไม่รองรับ: {spec.get('type')}")
    if not callable(getattr(mod, "run", None)):
        raise FunctionError("ไม่มีฟังก์ชัน run")
    if not isinstance(getattr(mod, "EXAMPLE", None), dict):
        raise FunctionError("ไม่มี EXAMPLE")
    return meta["name"]


def _load() -> None:
    _modules.clear()
    _errors.clear()
    package = __name__
    for info in pkgutil.iter_modules(__path__):
        if info.name.startswith("_"):
            continue
        try:
            mod = importlib.import_module(f"{package}.{info.name}")
            name = _check_module(mod)
            if name in _modules:
                raise FunctionError(f"ชื่อซ้ำ: {name}")
            _modules[name] = mod
        except Exception as exc:  # noqa: BLE001 — ไฟล์เดียวเสียไม่ควรทำให้ทั้ง registry พัง
            _errors[info.name] = str(exc)


def names() -> list[str]:
    return sorted(_modules)


def errors() -> dict[str, str]:
    return dict(_errors)


def get_module(name: str) -> ModuleType:
    if name not in _modules:
        raise FunctionError(f"ไม่พบฟังก์ชัน: {name}")
    return _modules[name]


def list_meta() -> list[dict]:
    return [_modules[n].META for n in names()]


def _check_data(data: dict) -> None:
    if not isinstance(data, dict) or "timestamps" not in data or "series" not in data:
        raise FunctionError("data ต้องมี timestamps และ series")
    n = len(data["timestamps"])
    for tag, values in data["series"].items():
        if not isinstance(values, list) or len(values) != n:
            raise FunctionError(f"ความยาวของ '{tag}' ไม่เท่ากับจำนวน timestamps")


def _coerce_params(meta: dict, params: dict, data: dict) -> dict:
    unknown = set(params) - set(meta["params"])
    if unknown:
        raise FunctionError(f"parameter ไม่รู้จัก: {', '.join(sorted(unknown))}")
    out: dict = {}
    for pname, spec in meta["params"].items():
        value = params.get(pname, spec.get("default"))
        if value is None:
            raise FunctionError(f"ขาด parameter: {pname}")
        t = spec["type"]
        try:
            if t == "int":
                if isinstance(value, bool):
                    raise ValueError
                value = int(value)
            elif t == "float":
                value = float(value)
            elif t == "bool":
                value = bool(value)
            else:  # str / tag
                value = str(value)
        except (TypeError, ValueError):
            raise FunctionError(f"parameter '{pname}' ต้องเป็น {t}")
        if t in ("int", "float"):
            if "min" in spec and value < spec["min"]:
                raise FunctionError(f"parameter '{pname}' ต้องไม่น้อยกว่า {spec['min']}")
            if "max" in spec and value > spec["max"]:
                raise FunctionError(f"parameter '{pname}' ต้องไม่มากกว่า {spec['max']}")
        if t == "tag" and value not in data["series"]:
            raise FunctionError(f"ไม่มี tag '{value}' ในข้อมูลที่ส่งมา")
        out[pname] = value
    return out


def _check_output(kind: str, out: dict, data: dict) -> None:
    if not isinstance(out, dict) or out.get("kind") != kind:
        raise FunctionError(f"output ต้องมี kind = '{kind}'")
    if kind == "series":
        n = len(data["timestamps"])
        if out.get("timestamps") != data["timestamps"]:
            raise FunctionError("output series ต้องคืน timestamps เดิม")
        for tag, values in out.get("series", {}).items():
            if not isinstance(values, list) or len(values) != n:
                raise FunctionError(f"output '{tag}' ความยาวไม่ตรงกับ timestamps")
    else:
        v = out.get("value")
        if v is not None and not (isinstance(v, (int, float)) and math.isfinite(v)):
            raise FunctionError("output scalar ต้องเป็นตัวเลขจำกัด หรือ None")


def run(name: str, data: dict, params: dict | None = None) -> dict:
    mod = get_module(name)
    meta = mod.META
    _check_data(data)
    p = _coerce_params(meta, params or {}, data)
    out = mod.run(data, p)
    _check_output(meta["output"], out, data)
    return out


_load()
