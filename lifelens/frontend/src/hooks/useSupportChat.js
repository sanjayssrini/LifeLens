import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: next.message,
          user_id: next.userId || "",
          session_token: next.sessionToken || "",
          source: next.source,
          demo_mode: Boolean(next.demoMode)
        })
      });

      if (!response.ok) {
        throw new Error("The assistant could not respond right now.");
      }

      const data = await response.json();
      setLastModel(String(data.model_used || ""));
      setMemoryUsed(Boolean(data.memory_used));
      setLastLatencyMs(Number(data.processing_ms || 0));
      setRecommendedActions(Array.isArray(data.recommended_actions) ? data.recommended_actions : []);
      setRecentInsights(Array.isArray(data.recent_insights) ? data.recent_insights.filter(Boolean) : []);

      const assistantText = (data.reply || "I am still here with you. Please try that again.").trim();
      const responseId = String(data.response_id || `chat-${Date.now()}`);
      setMessages((current) => [
        ...current,
        {
          id: responseId,
          role: "assistant",
          content: assistantText,
          meta: {
            source: "lifelens",
            responseId,
            urgency: data.intent?.urgency || "medium",
            latencyMs: Number(data.processing_ms || 0)
          }
        }
      ]);
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
        }, data.demo_mode ? 320 : 820);
      } else {
        setInsightPending(false);
      }

      if (next.userId) {
        fetch("/api/memory/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: next.userId,
            content: next.message,
            intent: "conversation",
            preferences: {},
            metadata: {
              source: next.source,
              session_token: next.sessionToken || "",
              model_used: data.model_used || "",
            }
          })
        }).catch(() => {
          // Non-blocking memory write.
        });
      }
    } catch (sendError) {
      const messageText = sendError?.message || "The assistant request failed.";
      setError(messageText);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: "I hit a connection issue. Please try again, I am still here.",
          meta: { source: "fallback" }
        }
      ]);
    } finally {
      processingRef.current = false;
      setIsThinking(false);
      if (queueRef.current.length > 0) {
        processNext();
      }
    }
  }, [onAssistantReply]);

  const sendMessage = useCallback((message, source = "text", options = {}) => {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        meta: { source }
      }
    ]);

    queueRef.current.push({
      message: trimmed,
      source,
      userId: options.userId || "",
      sessionToken: options.sessionToken || "",
      demoMode: Boolean(options.demoMode)
    });
    processNext();
  }, [processNext]);

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
      }, 2600);
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
