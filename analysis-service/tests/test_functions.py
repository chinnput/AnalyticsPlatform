import math
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import functions as registry  # noqa: E402
from app.functions import FunctionError  # noqa: E402


def _close(actual, expected) -> bool:
    if isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(_close(actual[k], expected[k]) for k in expected)
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(_close(a, e) for a, e in zip(actual, expected))
    if expected is None or actual is None:
        return actual is expected
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        return math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-12)
    return actual == expected


# ---- registry / contract ----

def test_all_function_files_load():
    assert registry.errors() == {}


def test_h_factor_is_registered():
    assert "h_factor" in registry.names()


@pytest.mark.parametrize("name", registry.names())
def test_example_matches_expected(name):
    ex = registry.get_module(name).EXAMPLE
    out = registry.run(name, ex["data"], ex.get("params", {}))
    assert _close(out, ex["expected"]), f"{name}: {out} != {ex['expected']}"


def _data(temps):
    ts = [f"2026-10-01T{8 + i:02d}:00:00" for i in range(len(temps))]
    return {"timestamps": ts, "series": {"TEMP": temps}}


def test_missing_required_tag_param_is_rejected():
    with pytest.raises(FunctionError, match="ขาด parameter"):
        registry.run("h_factor", _data([100.0]), {})


def test_unknown_param_is_rejected():
    with pytest.raises(FunctionError, match="ไม่รู้จัก"):
        registry.run("h_factor", _data([100.0]), {"temp_tag": "TEMP", "x": 1})


def test_tag_not_in_data_is_rejected():
    with pytest.raises(FunctionError, match="ไม่มี tag"):
        registry.run("h_factor", _data([100.0]), {"temp_tag": "OTHER"})


def test_length_mismatch_is_rejected():
    bad = {"timestamps": ["2026-10-01T08:00:00"], "series": {"TEMP": [1.0, 2.0]}}
    with pytest.raises(FunctionError, match="ความยาว"):
        registry.run("h_factor", bad, {"temp_tag": "TEMP"})


def test_unknown_function_is_rejected():
    with pytest.raises(FunctionError, match="ไม่พบฟังก์ชัน"):
        registry.run("no_such_function", _data([1.0]), {})


def test_bad_output_shape_is_rejected():
    with pytest.raises(FunctionError, match="kind"):
        registry._check_output("series", {"kind": "scalar", "value": 1.0}, _data([1.0]))
    with pytest.raises(FunctionError, match="ความยาว"):
        registry._check_output(
            "series",
            {"kind": "series", "timestamps": _data([1.0])["timestamps"], "series": {"x": [1.0, 2.0]}},
            _data([1.0]),
        )


def test_scalar_output_must_be_finite():
    with pytest.raises(FunctionError, match="ตัวเลขจำกัด"):
        registry._check_output("scalar", {"kind": "scalar", "value": float("nan")}, _data([1.0]))


# ---- H-factor ----

def test_h_factor_one_hour_at_100C_is_about_1_02():
    out = registry.run("h_factor", _data([100.0, 100.0]), {"temp_tag": "TEMP"})
    expected = math.exp(43.2 - 16113 / 373.15)
    assert math.isclose(out["series"]["H-factor"][1], expected, rel_tol=1e-9)
    assert 1.0 < out["series"]["H-factor"][1] < 1.05


def test_h_factor_missing_temperature_gives_none_and_skips_its_interval():
    # 08:00 = 100°C, 09:00 = ว่าง, 10:00 = 100°C
    # ช่วง 08→09 ตัดทิ้ง (ไม่มีอุณหภูมิที่ปลายช่วง) เหลือเฉพาะช่วง 09→10 ที่ใช้ rate ของ 10:00
    out = registry.run("h_factor", _data([100.0, None, 100.0]), {"temp_tag": "TEMP"})
    h = out["series"]["H-factor"]
    assert h[1] is None
    assert math.isclose(h[2], math.exp(43.2 - 16113 / 373.15), rel_tol=1e-9)


def test_h_factor_accepts_custom_constants():
    out = registry.run("h_factor", _data([100.0, 100.0]), {"temp_tag": "TEMP", "a": 0, "b": 0})
    assert math.isclose(out["series"]["H-factor"][1], 1.0, rel_tol=1e-9)
