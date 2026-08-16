"use client";

import React from "react";
import { WidgetHeader } from "../widget-header";
import { useWidgetHost } from "../../context/widget-host";
import { useWidgetNavigation } from "../../hooks/use-widget-navigation";
import { WidgetScreens, WidgetTabs } from "../../constants";
import { Button } from "../../../ui";
import {
  buildStreamChatUser,
  getOrCreateVisitorId,
  requestHumanHandoff,
} from "../../..";
import { useThreadStore } from "../../store/thread-store";

export function WidgetContact() {
  const { config, user } = useWidgetHost();
  const { navigate } = useWidgetNavigation();
  const { currentThreadId, setCurrentThreadId, setThreads } = useThreadStore();
  const branding = config.branding;
  const secondary = branding.secondaryTextColor;
  const [name, setName] = React.useState(user?.name ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [threadId, setThreadId] = React.useState(currentThreadId);
  const [state, setState] = React.useState<
    "loading" | "contact" | "success" | "error"
  >("loading");
  const [error, setError] = React.useState("");
  const startedRef = React.useRef(false);

  const chatUser = React.useMemo(
    () =>
      buildStreamChatUser({
        id: user?.id,
        name: user?.name,
        email: user?.email,
        profile_image: user?.profile_image,
        anonymousVisitorId: getOrCreateVisitorId(),
      }),
    [user?.email, user?.id, user?.name, user?.profile_image],
  );

  const applyResult = React.useCallback(
    (data: {
      threadId: string;
      escalated: boolean;
      contactRequired?: boolean;
      status: string;
    }) => {
      setThreadId(data.threadId);
      setCurrentThreadId(data.threadId);
      setThreads({
        id: data.threadId,
        user: chatUser.id,
        title: "Human support request",
        escalated: data.escalated,
        conversation_status:
          data.status === "human_pending" ? "human_pending" : "awaiting_contact",
        created_at: new Date().toISOString(),
      });
      setState(data.contactRequired ? "contact" : "success");
    },
    [chatUser.id, setCurrentThreadId, setThreads],
  );

  React.useEffect(() => {
    if (startedRef.current || config.staticDemo) {
      if (config.staticDemo) setState("contact");
      return;
    }
    startedRef.current = true;
    void requestHumanHandoff({
      threadId: currentThreadId,
      user: chatUser,
      reason: "Customer opened the Contact tab",
    }).then((result) => {
      if (!result.success || !result.data) {
        setError(result.error ?? "Could not start the handoff");
        setState("error");
        return;
      }
      applyResult(result.data);
    });
  }, [applyResult, chatUser, config.staticDemo, currentThreadId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("loading");
    setError("");
    const result = await requestHumanHandoff({
      threadId,
      user: chatUser,
      name,
      email,
      reason: "Customer requested human support",
    });
    if (!result.success || !result.data) {
      setError(result.error ?? "Could not submit your details");
      setState("contact");
      return;
    }
    applyResult(result.data);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <WidgetHeader
        className="sticky top-0"
        header={config.messages.feedbackTitle || "Talk to the team"}
        action={() =>
          navigate(WidgetTabs.Home, WidgetScreens.HomeScreens.Home)
        }
      />

      <div className="flex flex-col px-4 sm:px-5 py-4 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-sm" style={{ color: secondary }}>
            {branding.name?.trim()
              ? `Reach ${branding.name.trim()} directly. A person will follow up with context from your visit.`
              : "Reach the team directly. A person will follow up with context from your visit."}
          </p>
        </div>

        {state === "loading" ? (
          <div className="rounded-xl border border-black/10 bg-white px-4 py-3.5 text-sm text-zinc-600">
            Preparing your conversation…
          </div>
        ) : null}

        {state === "contact" ? (
          <form onSubmit={submit} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium">Name</span>
              <input
                required
                minLength={2}
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/35"
                autoComplete="name"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">Email</span>
              <input
                required
                type="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/35"
                autoComplete="email"
              />
            </label>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full cursor-pointer">
              Send to the team
            </Button>
          </form>
        ) : null}

        {state === "success" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-700/15 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-900">
              Your conversation has been escalated. Our team will contact you
              shortly.
            </div>
            {threadId ? (
              <Button
                type="button"
                variant="outline"
                className="w-full cursor-pointer"
                onClick={() =>
                  navigate(
                    WidgetTabs.Messages,
                    WidgetScreens.MessagesScreens.Messages,
                    { threadId, title: "Human support request" },
                  )
                }
              >
                View conversation
              </Button>
            ) : null}
          </div>
        ) : null}

        {state === "error" ? (
          <div className="rounded-xl border border-red-700/15 bg-red-50 px-4 py-3.5 text-sm text-red-800">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
