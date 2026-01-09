import { useErrorStore } from "@/store/error-store";
import { useInputStore } from "@/store/input-store";
import { useWidgetStore } from "@/store/widget-store";
import { useSessionStore } from "@/store/session-store";
import { useThreadMessageStore, useThreadStore } from "@/store/thread-store";

import { BASE_URL } from "@/lib/services/google-auth";

export function useWidgetMessageHandler() {
  const { user } = useSessionStore();
  const { updateMessage } = useThreadMessageStore();
  const { input, setInput, setDisableInput } = useInputStore();
  const { currentThreadId, setCurrentThreadId, setThreads } = useThreadStore();

  const { setMessage, setStatus } = useErrorStore();
  const { setAssistantTyping, setThinkingPhase } = useWidgetStore();

  const sendMessage = async () => {
    updateMessage((prev) => [
      ...(prev ?? []),
      {
        role: "user",
        content: input,
        id: crypto.randomUUID(),
        thread: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      },
    ]);

    setInput("");
    setDisableInput(true);
    setAssistantTyping(true);

    try {
      const response = await fetch(`${BASE_URL}/orchestration/api/v1/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: input,
          senderId: user?.id,
          threadId: currentThreadId,
        }),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        setAssistantTyping(false);

        setStatus("error");
        setMessage(
          errorData?.error || "An unexpected error occurred. Please try again.",
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let accumulatedText = "";
      let pendingBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const buffer = decoder.decode(value, { stream: true });
        const events = buffer.split("<|END_OF_EVENT|>");

        for (const event of events) {
          if (!event.trim()) continue;

          const payload = JSON.parse(event);

          switch (payload.event) {
            case "threadCreated":
              const thread = payload.data;

              if (thread) setThreads(thread);
              if (thread.id) setCurrentThreadId(thread.id);
              break;

            case "thinkingPhase":
              const thinking = payload.data;

              setAssistantTyping(thinking.thinking === "true");
              setThinkingPhase(thinking.thinkingPhase);
              break;

            case "fileUrls":
              const data = payload.data;
              if (data.type === "generated") setAssistantTyping(false);

              updateMessage((prev) => {
                if (!prev?.length) return prev;
                const last = prev[prev.length - 1];
                return [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    file_url: data.url,
                  },
                ];
              });
              break;

            case "assistantResponse":
              setAssistantTyping(false);

              const token = payload.data;
              pendingBuffer += token;

              const doubleStarMatches = (pendingBuffer.match(/\*\*/g) || [])
                .length;
              const hasUnclosedBold = doubleStarMatches % 2 !== 0;

              if (!hasUnclosedBold) {
                accumulatedText += pendingBuffer;
                pendingBuffer = "";

                updateMessage((prev) => {
                  if (!prev || prev.length === 0)
                    return [
                      {
                        role: "assistant",
                        id: crypto.randomUUID(),
                        thread: crypto.randomUUID(),
                        content: accumulatedText,
                        created_at: new Date().toISOString(),
                      },
                    ];

                  const last = prev[prev.length - 1];
                  if (last.role === "assistant")
                    return [
                      ...prev.slice(0, -1),
                      { ...last, content: accumulatedText },
                    ];

                  return [
                    ...prev,
                    {
                      role: "assistant",
                      id: crypto.randomUUID(),
                      thread: crypto.randomUUID(),
                      content: accumulatedText,
                      created_at: new Date().toISOString(),
                    },
                  ];
                });
              }

            case "done":
              setDisableInput(false);
              setAssistantTyping(false);
              break;

            case "error":
              setDisableInput(false);
              setAssistantTyping(false);

              setStatus("error");
              setMessage(payload.data.error);
              break;
          }
        }
      }
    } catch (error) {
      console.log("error: ", error);
      setDisableInput(false);
      setAssistantTyping(false);
    }
  };

  return { sendMessage };
}
