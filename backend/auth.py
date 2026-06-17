import hmac
import os

from fastapi import Header, HTTPException


def require_secret(authorization: str | None = Header(default=None)) -> None:
    """FastAPI dependency: require a shared bearer secret on every request.

    The GPU backend has no notion of users or credits — that gate lives in the
    Next.js layer. This dependency ensures the Modal app is only reachable by that
    trusted proxy (which authenticates the user and bills credits before calling),
    not by anyone who reads the public NEXT_PUBLIC_API_URL and hits it directly.

    The expected value is provided via the `BACKEND_API_SECRET` env var (Modal
    secret); the same value is held server-side by Next.js (never NEXT_PUBLIC).
    """
    expected = os.environ.get("BACKEND_API_SECRET")
    if not expected:
        # Fail closed: a misconfigured backend must not silently accept traffic.
        raise HTTPException(status_code=503, detail="Backend auth not configured")
    token = (authorization or "").removeprefix("Bearer ").strip()
    # Compare as bytes: hmac.compare_digest rejects str inputs containing any
    # non-ASCII character with a TypeError (even when the values are equal), and
    # the shared secret may contain such characters.
    if not token or not hmac.compare_digest(
        token.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")
