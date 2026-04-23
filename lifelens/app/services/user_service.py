from __future__ import annotations

import uuid
from typing import Any, Dict, List

from fastapi import HTTPException
from qdrant_client.models import Distance, FieldCondition, Filter, MatchAny, MatchValue, PayloadSchemaType, PointStruct, VectorParams

from app.services.memory_service import MemoryService


class UserService:
    def __init__(self, memory_service: MemoryService) -> None:
        self.memory_service = memory_service
        self.client = memory_service.client
        self.collection_name = "users"

    def ensure_collection(self) -> None:
        client = self._require_client()
        existing = [c.name for c in client.get_collections().collections]
        if self.collection_name not in existing:
            client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=self.memory_service.vector_size, distance=Distance.COSINE),
            )
        for field_name in ["user_id", "phone_or_email"]:
            try:
                client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name=field_name,
                    field_schema=PayloadSchemaType.KEYWORD,
                )
            except Exception:
                pass

    def _require_client(self):
        if self.client is None:
            raise HTTPException(status_code=503, detail="Qdrant is required for user storage.")
        return self.client

    def _sanitize(self, value: str) -> str:
        return value.strip()

    def _identity_text(self, name: str, phone_or_email: str) -> str:
        return f"name:{name.lower()} contact:{phone_or_email.lower()}"

    def create_user(self, name: str, phone_or_email: str) -> Dict[str, Any]:
        clean_name = self._sanitize(name)
        clean_contact = self._sanitize(phone_or_email).lower()
        if not clean_name or not clean_contact:
            raise HTTPException(status_code=400, detail="Name and phone/email are required.")

        user_id = str(uuid.uuid4())
        profile_text = self._identity_text(clean_name, clean_contact)
        vector = self.memory_service.embed(profile_text)
        payload = {
            "user_id": user_id,
            "name": clean_name,
            "phone_or_email": clean_contact,
            "embedding": vector,
            "memory": [],
        }

        client = self._require_client()
        existing = self.find_by_contact(clean_contact)
        if existing:
            raise HTTPException(status_code=409, detail="User already exists. Please log in.")

        client.upsert(
            collection_name=self.collection_name,
            points=[PointStruct(id=user_id, vector=vector, payload=payload)],
        )
        return payload

    def find_by_contact(self, phone_or_email: str) -> Dict[str, Any] | None:
        clean_contact = self._sanitize(phone_or_email).lower()
        client = self._require_client()
        records, _ = client.scroll(
            collection_name=self.collection_name,
            scroll_filter=Filter(
                must=[FieldCondition(key="phone_or_email", match=MatchValue(value=clean_contact))]
            ),
            limit=1,
            with_payload=True,
            with_vectors=False,
        )
        if not records:
            return None
        return records[0].payload

    def find_by_user_id(self, user_id: str) -> Dict[str, Any] | None:
        parsed_user_id = str(user_id).strip()
        if not parsed_user_id:
            return None

        client = self._require_client()
        try:
            parsed_user_id = str(uuid.UUID(parsed_user_id))
        except (ValueError, AttributeError, TypeError):
            return None

        points = client.retrieve(
            collection_name=self.collection_name,
            ids=[parsed_user_id],
            with_payload=True,
            with_vectors=False,
        )
        if not points:
            return None
        return points[0].payload

    def find_by_similarity(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        client = self._require_client()
        vector = self.memory_service.embed(query)
        hits = client.search(
            collection_name=self.collection_name,
            query_vector=vector,
            limit=limit,
        )
        return [hit.payload for hit in hits if hit.payload]

    def login(self, identifier: str) -> Dict[str, Any]:
        user = self.find_by_contact(identifier)
        if user:
            return user

        user = self.find_by_user_id(identifier)
        if user:
            return user

        candidates = self.find_by_similarity(identifier, limit=5)
        normalized = identifier.strip().lower()
        for candidate in candidates:
            candidate_contact = str(candidate.get("phone_or_email", "")).lower()
            candidate_name = str(candidate.get("name", "")).lower()
            if normalized == candidate_contact or normalized == candidate_name:
                return candidate
        raise HTTPException(status_code=404, detail="User not found. Please sign up.")

    def append_user_memory(self, user_id: str, memory_item: Dict[str, Any], max_items: int = 30) -> None:
        user = self.find_by_user_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        current_memory = user.get("memory") or []
        if not isinstance(current_memory, list):
            current_memory = []
        current_memory.append(memory_item)
        clipped = current_memory[-max_items:]

        payload_update = dict(user)
        payload_update["memory"] = clipped
        vector = user.get("embedding")
        if not isinstance(vector, list) or not vector:
            vector = self.memory_service.embed(self._identity_text(str(user.get("name", "")), str(user.get("phone_or_email", ""))))
            payload_update["embedding"] = vector

        client = self._require_client()

        client.upsert(
            collection_name=self.collection_name,
            points=[PointStruct(id=user_id, vector=[float(v) for v in vector], payload=payload_update)],
        )

    def clear_user_memory(self, user_id: str) -> None:
        user = self.find_by_user_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        payload_update = dict(user)
        payload_update["memory"] = []
        vector = user.get("embedding")
        if not isinstance(vector, list) or not vector:
            vector = self.memory_service.embed(
                self._identity_text(str(user.get("name", "")), str(user.get("phone_or_email", "")))
            )
            payload_update["embedding"] = vector

        client = self._require_client()

        client.upsert(
            collection_name=self.collection_name,
            points=[PointStruct(id=user_id, vector=[float(v) for v in vector], payload=payload_update)],
        )

    def bulk_get_users(self, user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        if not user_ids:
            return {}

        client = self._require_client()
        records, _ = client.scroll(
            collection_name=self.collection_name,
            scroll_filter=Filter(
                must=[FieldCondition(key="user_id", match=MatchAny(any=user_ids))]
            ),
            limit=len(user_ids),
            with_payload=True,
            with_vectors=False,
        )
        result: Dict[str, Dict[str, Any]] = {}
        for record in records:
            payload = record.payload or {}
            uid = str(payload.get("user_id", ""))
            if uid:
                result[uid] = payload
        return result
