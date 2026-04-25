import hashlib
import math
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from threading import Lock
from time import monotonic
from typing import Any, Dict, List

import google.generativeai as genai
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, FieldCondition, Filter, MatchValue, PayloadSchemaType, PointStruct, VectorParams

from app.services.schemas import IntentAnalysis
from app.services.settings import Settings


class MemoryService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.collection_name = "user_memory"
        self.vector_size = 768 if settings.gemini_api_key else 256
        self.gemini_enabled = bool(settings.gemini_api_key)
        if self.gemini_enabled:
            genai.configure(api_key=settings.gemini_api_key)

        if not settings.qdrant_url:
            raise RuntimeError("QDRANT_URL is required. Local memory storage is disabled.")

        self.client = QdrantClient(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key or None,
            check_compatibility=False,
        )
        self._embedding_cache: OrderedDict[str, List[float]] = OrderedDict()
        self._embedding_cache_lock = Lock()
        self._embedding_cache_max = 512
        self._recent_cache: Dict[str, tuple[float, List[Dict[str, Any]]]] = {}
        self._recent_cache_ttl_sec = 2.0
        self._recent_cache_lock = Lock()

    def _get_cached_embedding(self, text: str) -> List[float] | None:
        with self._embedding_cache_lock:
            cached = self._embedding_cache.get(text)
            if cached is None:
                return None
            self._embedding_cache.move_to_end(text)
            return list(cached)

    def _set_cached_embedding(self, text: str, vector: List[float]) -> None:
        with self._embedding_cache_lock:
            self._embedding_cache[text] = list(vector)
            self._embedding_cache.move_to_end(text)
            while len(self._embedding_cache) > self._embedding_cache_max:
                self._embedding_cache.popitem(last=False)

    def _invalidate_recent_cache(self, user_id: str) -> None:
        with self._recent_cache_lock:
            self._recent_cache.pop(user_id, None)

    def _require_client(self) -> QdrantClient:
        if self.client is None:
            raise RuntimeError("Qdrant client is unavailable. Local memory storage is disabled.")
        return self.client

    def ensure_collection(self) -> None:
        client = self._require_client()
        try:
            existing = [c.name for c in client.get_collections().collections]
            if self.collection_name not in existing:
                client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
                )
            try:
                client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="user_id",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
            except Exception:
                pass
            try:
                client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="entry_type",
                    field_schema=PayloadSchemaType.KEYWORD,
                )
            except Exception:
                pass
        except Exception as exc:
            raise RuntimeError(
                "Qdrant initialization failed. Verify QDRANT_URL and QDRANT_API_KEY."
            ) from exc

    def _hash_embedding(self, text: str) -> List[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        vals = [b / 255.0 for b in digest]
        vector = []
        for idx in range(self.vector_size):
            x = vals[idx % len(vals)]
            y = vals[(idx * 7) % len(vals)]
            vector.append((x + y) / 2)
        mag = math.sqrt(sum(v * v for v in vector)) or 1.0
        return [v / mag for v in vector]

    def embed(self, text: str) -> List[float]:
        cached = self._get_cached_embedding(text)
        if cached is not None:
            return cached

        if not self.gemini_enabled:
            vector = self._hash_embedding(text)
            self._set_cached_embedding(text, vector)
            return vector

        try:
            result = genai.embed_content(
                model=self.settings.embedding_model,
                content=text,
                task_type="SEMANTIC_SIMILARITY",
            )
            values = result.get("embedding", [])
            if not values:
                vector = self._hash_embedding(text)
                self._set_cached_embedding(text, vector)
                return vector
            vector = [float(v) for v in values]
            self._set_cached_embedding(text, vector)
            return vector
        except Exception:
            vector = self._hash_embedding(text)
            self._set_cached_embedding(text, vector)
            return vector

    def store_interaction(self, user_id: str, transcript: str, intent: IntentAnalysis, metadata: Dict[str, Any]) -> None:
        client = self._require_client()
        vector = self.embed(transcript)
        payload = {
            "user_id": user_id,
            "transcript": transcript,
            "intent": intent.model_dump(),
            "metadata": metadata,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "entry_type": "interaction",
        }
        client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload=payload,
                )
            ],
        )
        self._invalidate_recent_cache(user_id)

    def search_similar(self, transcript: str, user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
        client = self._require_client()
        vector = self.embed(transcript)
        try:
            hits = client.search(
                collection_name=self.collection_name,
                query_vector=vector,
                limit=limit,
                query_filter=Filter(
                    must=[
                        FieldCondition(
                            key="user_id",
                            match=MatchValue(value=user_id),
                        )
                    ]
                ),
            )
            payloads = [hit.payload for hit in hits if hit.payload and getattr(hit, "score", 0.0) >= 0.35]
            return payloads
        except Exception as exc:
            raise RuntimeError("Failed to retrieve similar memory from Qdrant.") from exc

    def store_memory_entry(
        self,
        user_id: str,
        content: str,
        intent: str = "general",
        preferences: Dict[str, Any] | None = None,
        metadata: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        entry = {
            "user_id": user_id,
            "transcript": content,
            "intent": {"primary_intent": intent},
            "preferences": preferences or {},
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "entry_type": "memory",
        }
        client = self._require_client()
        vector = self.embed(content)
        client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload=entry,
                )
            ],
        )
        self._invalidate_recent_cache(user_id)
        return entry

    def retrieve_user_memory(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        return self.search_similar(transcript=query, user_id=user_id, limit=limit)

    def recent_user_memory(self, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        now = monotonic()
        with self._recent_cache_lock:
            cached = self._recent_cache.get(user_id)
            if cached and (now - cached[0]) <= self._recent_cache_ttl_sec:
                return cached[1][: max(1, limit)]

        client = self._require_client()
        try:
            fetch_limit = max(24, max(1, limit) * 6)
            records, _ = client.scroll(
                collection_name=self.collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="user_id",
                            match=MatchValue(value=user_id),
                        )
                    ]
                ),
                limit=fetch_limit,
                with_payload=True,
                with_vectors=False,
            )
            payloads = [record.payload for record in records if record.payload]
            if payloads:
                payloads.sort(key=lambda item: str(item.get("timestamp") or ""), reverse=True)
                result = payloads[: max(1, limit)]
                with self._recent_cache_lock:
                    self._recent_cache[user_id] = (now, payloads[:12])
                return result
            return []
        except Exception as exc:
            raise RuntimeError("Failed to fetch recent user memory from Qdrant.") from exc

    def store_feedback(
        self,
        user_id: str,
        response_id: str,
        feedback: str,
        metadata: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        normalized_feedback = "positive" if feedback == "positive" else "negative"
        entry = {
            "user_id": user_id,
            "response_id": response_id,
            "feedback": normalized_feedback,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "entry_type": "feedback",
            "reinforcement": "reinforce_pattern" if normalized_feedback == "positive" else "reduce_similar_suggestions",
        }
        client = self._require_client()
        vector = self.embed(f"{response_id} {normalized_feedback} {entry['reinforcement']}")
        client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload=entry,
                )
            ],
        )
        return entry

    def clear_user_memory(self, user_id: str) -> None:
        client = self._require_client()
        try:
            client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="user_id",
                            match=MatchValue(value=user_id),
                        )
                    ]
                ),
            )
            self._invalidate_recent_cache(user_id)
        except Exception as exc:
            raise RuntimeError("Failed to clear user memory in Qdrant.") from exc

    def store_insight(
        self,
        user_id: str,
        message: str,
        insight_payload: Dict[str, Any],
        metadata: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        entry = {
            "user_id": user_id,
            "transcript": message,
            "insight": insight_payload,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "entry_type": "life_insight",
        }
        client = self._require_client()
        vector = self.embed(f"{message} {' '.join(insight_payload.get('insights', []))}")
        client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload=entry,
                )
            ],
        )
        self._invalidate_recent_cache(user_id)
        return entry

    def recent_insights(self, user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
        client = self._require_client()
        try:
            records, _ = client.scroll(
                collection_name=self.collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                        FieldCondition(key="entry_type", match=MatchValue(value="life_insight")),
                    ]
                ),
                limit=max(1, limit),
                with_payload=True,
                with_vectors=False,
            )
            insights = [record.payload for record in records if record.payload]
            return insights[-limit:][::-1]
        except Exception as exc:
            raise RuntimeError("Failed to fetch recent insights from Qdrant.") from exc
