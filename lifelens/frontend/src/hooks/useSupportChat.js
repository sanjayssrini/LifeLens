import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CHAT_REQUEST_TIMEOUT_MS = 25000;
const MAX_MESSAGES = 60;

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "I am here with you. Tell me what is going on, and I will help you with immediate next steps and practical support.",
  meta: {
    source: "system"
  }
};

export function useSupportChat({ onAssistantReply } = {}) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState("");
  const [lastModel, setLastModel] = useState("");
  const [memoryUsed, setMemoryUsed] = useState(false);
  const [lastLatencyMs, setLastLatencyMs] = useState(0);
  const [lifeInsight, setLifeInsight] = useState(null);
  const [recentInsights, setRecentInsights] = useState([]);
  const [recommendedActions, setRecommendedActions] = useState([]);
  const [insightPending, setInsightPending] = useState(false);
  const queueRef = useRef([]);
  const processingRef = useRef(false);
  const insightTimerRef = useRef(null);

  const appendMessage = useCallback((message) => {
    setMessages((current) => [...current, message].slice(-MAX_MESSAGES));
  }, []);

  useEffect(() => {
    return () => {
      if (insightTimerRef.current) {
        clearTimeout(insightTimerRef.current);
      }
    };
  }, []);

  const processNext = useCallback(async () => {
    if (processingRef.current) {
      return;
    }

    const next = queueRef.current.shift();
    if (!next) {
      return;
    }

    processingRef.current = true;
    setIsThinking(true);
    setError("");

    let timeoutId = null;
    try {
      const controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: next.message,
          user_id: next.userId || "",
          session_token: next.sessionToken || "",
          source: next.source,
          demo_mode: Boolean(next.demoMode),
          voice_metadata: next.voiceMetadata || {}
        })
      });

      if (!response.ok) {
        let detail = "The assistant could not respond right now.";
        try {
          const errorPayload = await response.json();
          detail = String(errorPayload?.detail || errorPayload?.message || detail);
        } catch {
          // Keep the default fallback message.
        }
        throw new Error(detail);
      }

      const data = await response.json();
      console.log("FULL RESPONSE:", data);
      setLastModel(String(data.model_used || ""));
      setMemoryUsed(Boolean(data.memory_used));
      setLastLatencyMs(Number(data.processing_ms || 0));
      setRecommendedActions(Array.isArray(data.recommended_actions) ? data.recommended_actions : []);
      setRecentInsights(Array.isArray(data.recent_insights) ? data.recent_insights.filter(Boolean) : []);

      const assistantText = (data.reply || "I am still here with you. Please try that again.").trim();
      const responseId = String(data.response_id || `chat-${Date.now()}`);
      appendMessage({
        id: responseId,
        role: "assistant",
        content: assistantText,
        meta: {
          source: "lifelens",
          responseId,
          urgency: data.intent?.urgency || "medium",
          latencyMs: Number(data.processing_ms || 0),
          language: data.language || "en",
          emotion: data.emotion || "neutral",
          intensity: Number(data.intensity || 0),
          strategy: data.strategy || "calm",
          extra_action: data.extra_action ?? null,
        }
      });
      onAssistantReply?.(assistantText);

      if (insightTimerRef.current) {
        clearTimeout(insightTimerRef.current);
      }
      const incomingInsight = data.life_insight && data.life_insight.summary ? data.life_insight : null;
      if (incomingInsight) {
        setInsightPending(true);
        insightTimerRef.current = setTimeout(() => {
          setLifeInsight(incomingInsight);
          setInsightPending(false);
        }, data.demo_mode ? 160 : 180);
      } else {
        setInsightPending(false);
      }
    } catch (sendError) {
      const isTimeout = sendError?.name === "AbortError";
      const messageText = isTimeout
        ? "The request took too long. Please try once more."
        : (sendError?.message || "The assistant request failed.");
      setError(messageText);
      appendMessage({
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content: messageText,
        meta: { source: "fallback", error: true }
      });
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      processingRef.current = false;
      setIsThinking(false);
      if (queueRef.current.length > 0) {
        processNext();
      }
    }
  }, [appendMessage, onAssistantReply]);

  const sendMessage = useCallback((message, source = "text", options = {}) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    appendMessage({
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      meta: { source }
    });

    queueRef.current.push({
      message: trimmed,
      source,
      userId: options.userId || "",
      sessionToken: options.sessionToken || "",
      demoMode: Boolean(options.demoMode),
      voiceMetadata: options.voiceMetadata || {}
    });
    processNext();
  }, [appendMessage, processNext]);

  const resetChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setError("");
    setLastModel("");
    setMemoryUsed(false);
    setLastLatencyMs(0);
    setLifeInsight(null);
    setRecentInsights([]);
    setRecommendedActions([]);
    setInsightPending(false);
    if (insightTimerRef.current) {
      clearTimeout(insightTimerRef.current);
    }
  }, []);

  const sendFeedback = useCallback(async (messageId, feedback, options = {}) => {
    const normalizedFeedback = feedback === "positive" ? "positive" : "negative";

    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              meta: {
                ...(message.meta || {}),
                feedbackStatus: "sending",
                feedback: normalizedFeedback
              }
            }
          : message,
      ),
    );

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: options.userId || "",
          session_token: options.sessionToken || "",
          response_id: options.responseId || messageId,
          feedback: normalizedFeedback,
          metadata: options.metadata || {}
        })
      });

      if (!response.ok) {
        throw new Error("Feedback failed");
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                meta: {
                  ...(message.meta || {}),
                  feedbackStatus: "sent",
                  feedback: normalizedFeedback
                }
              }
            : message,
        ),
      );

      window.setTimeout(() => {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  meta: {
                    ...(message.meta || {}),
                    feedbackHidden: true
                  }
                }
              : message,
          ),
        );
      }, 1200);
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                meta: {
                  ...(message.meta || {}),
                  feedbackStatus: "idle"
                }
              }
            : message,
        ),
      );
    }
  }, []);

  return useMemo(
    () => ({
      messages,
      isThinking,
      error,
      lastModel,
      memoryUsed,
      lastLatencyMs,
      lifeInsight,
      recentInsights,
      recommendedActions,
      insightPending,
      sendMessage,
      sendFeedback,
      resetChat
    }),
    [
      messages,
      isThinking,
      error,
      lastModel,
      memoryUsed,
      lastLatencyMs,
      lifeInsight,
      recentInsights,
      recommendedActions,
      insightPending,
      sendMessage,
      sendFeedback,
      resetChat,
    ],
  );
}
