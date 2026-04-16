from __future__ import annotations

import secrets
from threading import Lock
from typing import Dict


class SessionService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._sessions: Dict[str, str] = {}

    def create(self, user_id: str) -> str:
        token = secrets.token_urlsafe(32)
        with self._lock:
            self._sessions[token] = user_id
        return token

    def resolve(self, token: str | None) -> str | None:
        if not token:
            return None
        with self._lock:
            return self._sessions.get(token)

    def revoke(self, token: str | None) -> None:
        if not token:
            return
        with self._lock:
            self._sessions.pop(token, None)
