"""
Encryption helper for customer's Facebook session data.

Uses Fernet (AES-128-CBC + HMAC-SHA256) — the standard symmetric
encryption recipe in the `cryptography` library. Industry standard;
key length and authentication are handled by the library.

Why encrypt:
  Customer authorized VIIV to act on their behalf. Their session
  data is sensitive — AES at rest protects against accidental
  exposure (DB dump, backup leak, support access).

Key management:
  Key lives in env var FB_SESSION_ENCRYPTION_KEY.
  Generate with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  Rotation: future — store key_id alongside ciphertext, support
  multi-key decrypt while migrating.
"""
import os

from cryptography.fernet import Fernet, InvalidToken


def _get_cipher() -> Fernet:
    key = os.environ.get("FB_SESSION_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "FB_SESSION_ENCRYPTION_KEY not set in environment"
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_session(plaintext: str) -> str:
    """
    Encrypt customer's session data for DB storage.
    Input: JSON string of session state.
    Output: encrypted text (base64) safe for DB text column.
    """
    cipher = _get_cipher()
    return cipher.encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_session(ciphertext: str) -> str:
    """
    Decrypt customer's session data from DB.
    Returns plaintext JSON string.
    Raises InvalidToken if data is tampered or wrong key.
    """
    cipher = _get_cipher()
    return cipher.decrypt(ciphertext.encode("ascii")).decode("utf-8")


__all__ = ["encrypt_session", "decrypt_session", "InvalidToken"]
