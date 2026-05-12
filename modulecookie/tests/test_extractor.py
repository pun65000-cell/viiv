import sqlite3
import tempfile
from pathlib import Path

import pytest

from modulecookie.extractor import (
    FBCookies,
    CookiesCorruptedError,
    CookiesNotFoundError,
    _parse_sqlite,
    _validate_fb_cookies,
)


def _make_test_sqlite(rows: list[tuple]) -> Path:
    """Create temp sqlite with moz_cookies schema + rows."""
    tmp = Path(tempfile.mkdtemp()) / "test.sqlite"
    conn = sqlite3.connect(tmp)
    conn.execute("""
        CREATE TABLE moz_cookies (
            id INTEGER PRIMARY KEY,
            name TEXT, value TEXT, host TEXT
        )
    """)
    for r in rows:
        conn.execute("INSERT INTO moz_cookies(name,value,host) VALUES(?,?,?)", r)
    conn.commit()
    conn.close()
    return tmp


def test_parse_extracts_fb_cookies():
    p = _make_test_sqlite([
        ("xs", "abc123", ".facebook.com"),
        ("c_user", "100012345678901", ".facebook.com"),
        ("datr", "xyz", ".facebook.com"),
        ("other", "ignore", ".google.com"),
    ])
    result = _parse_sqlite(p)
    assert result == {"xs": "abc123", "c_user": "100012345678901", "datr": "xyz"}


def test_parse_filters_non_facebook():
    p = _make_test_sqlite([
        ("session", "x", ".google.com"),
        ("user", "y", ".twitter.com"),
    ])
    result = _parse_sqlite(p)
    assert result == {}


def test_parse_prefers_generic_domain():
    p = _make_test_sqlite([
        ("datr", "subdomain_value", "www.facebook.com"),
        ("datr", "generic_value", ".facebook.com"),
    ])
    result = _parse_sqlite(p)
    assert result["datr"] == "generic_value"


def test_validate_ok():
    parsed = {
        "xs": "x" * 60,
        "c_user": "100012345678901",
        "datr": "d" * 24,
    }
    fb = _validate_fb_cookies(parsed)
    assert isinstance(fb, FBCookies)
    assert fb.c_user == "100012345678901"


def test_validate_missing_xs():
    with pytest.raises(CookiesNotFoundError, match="xs"):
        _validate_fb_cookies({"c_user": "1234567890", "datr": "d" * 24})


def test_validate_c_user_not_numeric():
    with pytest.raises(CookiesNotFoundError, match="c_user"):
        _validate_fb_cookies({
            "xs": "x" * 60,
            "c_user": "abc12345",
            "datr": "d" * 24,
        })


def test_validate_xs_too_short():
    with pytest.raises(CookiesNotFoundError, match="xs"):
        _validate_fb_cookies({
            "xs": "short",
            "c_user": "1234567890",
            "datr": "d" * 24,
        })


def test_corrupted_sqlite():
    p = Path(tempfile.mkdtemp()) / "broken.sqlite"
    p.write_bytes(b"not a sqlite file")
    with pytest.raises(CookiesCorruptedError):
        _parse_sqlite(p)


def test_fbcookies_repr_redacts_values():
    fb = FBCookies(xs="secret_xs_value", c_user="100012345", datr="dddd")
    s = repr(fb)
    assert "secret_xs_value" not in s
    assert "100012345" not in s
    assert "<15b>" in s  # len("secret_xs_value") == 15
