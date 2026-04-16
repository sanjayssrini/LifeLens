from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class IntentAnalysis(BaseModel):
    primary_intent: str
    derived_intents: List[str] = Field(default_factory=list)
    urgency: Literal["low", "medium", "high"] = "medium"
    confidence: float = 0.7
    reasoning: str = ""


class ActionResult(BaseModel):
    action: str
    status: Literal["success", "failed"]
    details: str


class MemoryRecord(BaseModel):
    user_id: str
    text: str
    intent: Optional[IntentAnalysis] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class VapiToolCall(BaseModel):
    id: Optional[str] = None
    function: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


class VapiEvent(BaseModel):
    type: str
    user_id: str = "anonymous"
    transcript: str = ""
    tool_calls: List[VapiToolCall] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SystemState(BaseModel):
    transcript: str = ""
    ai_response: str = ""
    actions: List[ActionResult] = Field(default_factory=list)
    last_intent: Optional[IntentAnalysis] = None


class LifeInsight(BaseModel):
    summary: str = ""
    insights: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    confidence: float = 0.7
    importance: Literal["low", "medium", "high"] = "medium"
