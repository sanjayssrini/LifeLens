from typing import Any

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(tags=["vapi"])

_CALL_USER_CACHE: dict[str, str] = {}


def _deep_find_first(payload: Any, keys: set[str], depth: int = 0, max_depth: int = 6) -> str:
    if depth > max_depth:
        return ""

    if isinstance(payload, dict):
        for key, value in payload.items():
            if key in keys and value not in (None, ""):
                return str(value).strip()
        for value in payload.values():
            found = _deep_find_first(value, keys, depth + 1, max_depth)
            if found:
                return found
        return ""

    if isinstance(payload, list):
        for item in payload:
            found = _deep_find_first(item, keys, depth + 1, max_depth)
            if found:
                return found
    return ""


def _extract_call_id(payload: dict[str, Any]) -> str:
    direct = payload.get("call_id") or payload.get("callId")
    if direct:
        return str(direct).strip()

    call_data = payload.get("call")
    if isinstance(call_data, dict):
        call_id = call_data.get("id") or call_data.get("call_id") or call_data.get("callId")
        if call_id:
            return str(call_id).strip()

    return _deep_find_first(payload, {"call_id", "callId"})


@router.post("/vapi-webhook")
async def vapi_webhook(request: Request) -> dict:
    settings = request.app.state.settings
    if settings.vapi_private_key:
        header_key = request.headers.get("x-vapi-private-key")
        auth = request.headers.get("authorization", "")
        token = auth.replace("Bearer", "").strip() if auth else ""
        if header_key != settings.vapi_private_key and token != settings.vapi_private_key:
            raise HTTPException(status_code=401, detail="Invalid Vapi credentials")

    payload = await request.json()
    metadata = payload.get("metadata") or {}
    session_service = request.app.state.session_service
    call_id = _extract_call_id(payload)

    resolved_user_id = (
        payload.get("user_id")
        or payload.get("userId")
        or metadata.get("user_id")
        or metadata.get("userId")
        or _deep_find_first(payload, {"user_id", "userId"})
    )

    session_token = (
        metadata.get("session_token")
        or metadata.get("sessionToken")
        or _deep_find_first(payload, {"session_token", "sessionToken"})
        or request.headers.get("x-lifelens-session-token")
    )

    if not resolved_user_id:
        resolved_user_id = session_service.resolve(session_token)

    if not resolved_user_id and call_id:
        resolved_user_id = _CALL_USER_CACHE.get(call_id, "")

    if resolved_user_id and call_id:
        _CALL_USER_CACHE[call_id] = resolved_user_id

    if resolved_user_id:
        payload["user_id"] = resolved_user_id
        if not isinstance(payload.get("metadata"), dict):
            payload["metadata"] = {}
        payload["metadata"]["user_id"] = resolved_user_id
    if session_token:
        if not isinstance(payload.get("metadata"), dict):
            payload["metadata"] = {}
        payload["metadata"]["session_token"] = session_token

    handler = request.app.state.vapi_handler
    return handler.handle_webhook(payload)
