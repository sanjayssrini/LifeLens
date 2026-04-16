import hashlib
import math
import uuid
from datetime import datetime, timezone
from collections import defaultdict, deque
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

        self.client = (
            QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key, check_compatibility=False)
            if settings.qdrant_url and settings.qdrant_api_key
            else None
        )
        self.local_memory: Dict[str, deque] = defaultdict(lambda: deque(maxlen=80))

    def ensure_collection(self) -> None:
        if self.client is None:
            return
        existing = [c.name for c in self.client.get_collections().collections]
        if self.collection_name not in existing:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
            )
        try:
            self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name="user_id",
                field_schema=PayloadSchemaType.KEYWORD,
            )
        except Exception:
            pass

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
        if not self.gemini_enabled:
            return self._hash_embedding(text)

        try:
            result = genai.embed_content(
                model=self.settings.embedding_model,
                content=text,
                task_type="SEMANTIC_SIMILARITY",
            )
            values = result.get("embedding", [])
            if not values:
                return self._hash_embedding(text)
            return [float(v) for v in values]
        except Exception:
            return self._hash_embedding(text)

    def store_interaction(self, user_id: str, transcript: str, intent: IntentAnalysis, metadata: Dict[str, Any]) -> None:
        local_payload = {
            "user_id": user_id,
            "transcript": transcript,
            "intent": intent.model_dump(),
            "metadata": metadata,
        }
        self.local_memory[user_id].append(local_payload)

        if self.client is None:
            return

        vector = self.embed(transcript)
        payload = {
            "user_id": user_id,
            "transcript": transcript,
            "intent": intent.model_dump(),
            "metadata": metadata,
        }
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload=payload,
                )
            ],
        )

    def _local_similarity_search(self, transcript: str, user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
        query_tokens = {token for token in transcript.lower().split() if len(token) > 2}
        if not query_tokens:
            return list(self.local_memory[user_id])[-limit:]

        scored: List[tuple[float, Dict[str, Any]]] = []
        for index, item in enumerate(self.local_memory[user_id]):
            candidate = item.get("transcript", "")
            candidate_tokens = {token for token in candidate.lower().split() if len(token) > 2}
            overlap = len(query_tokens & candidate_tokens)
            union = len(query_tokens | candidate_tokens) or 1
            jaccard = overlap / union
            recency_bonus = index / 1000
            scored.append((jaccard + recency_bonus, item))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [item for score, item in scored[:limit] if item.get("transcript") and score >= 0.12]

    def search_similar(self, transcript: str, user_id: str, limit: int = 3) -> List[Dict[str, Any]]:
        if self.client is None:
            return self._local_similarity_search(transcript, user_id, limit)

        vector = self.embed(transcript)
        try:
            hits = self.client.search(
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
            if payloads:
                return payloads
            return self._local_similarity_search(transcript, user_id, limit)
        except Exception:
            return self._local_similarity_search(transcript, user_id, limit)

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
        }
        self.local_memory[user_id].append(entry)

        if self.client is None:
            return entry

        vector = self.embed(content)
        self.client.upsert(
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

    def retrieve_user_memory(self, user_id: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        return self.search_similar(transcript=query, user_id=user_id, limit=limit)

    def recent_user_memory(self, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        if self.client is None:
            items = list(self.local_memory[user_id])
            return items[-limit:][::-1]

        try:
            records, _ = self.client.scroll(
                collection_name=self.collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="user_id",
                            match=MatchValue(value=user_id),
                        )
                    ]
                ),
                limit=max(1, limit),
                with_payload=True,
                with_vectors=False,
            )
            payloads = [record.payload for record in records if record.payload]
            if payloads:
                return payloads[::-1]
        except Exception:
            pass

        items = list(self.local_memory[user_id])
        return items[-limit:][::-1]

    def clear_user_memory(self, user_id: str) -> None:
        self.local_memory[user_id].clear()

        if self.client is None:
            return

        try:
            self.client.delete(
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
        except Exception:
            pass
