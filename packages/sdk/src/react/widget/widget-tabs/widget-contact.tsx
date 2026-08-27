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
import { contrastForeground } from "../../color-contrast";

type ContactType = "email" | "phone" | "linkedin";

const CONTACT_TYPES: { key: ContactType; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "linkedin", label: "LinkedIn" },
];

export function WidgetContact() {
  const { config, user } = useWidgetHost();
  const { navigate } = useWidgetNavigation();
  const { currentThreadId, setCurrentThreadId, setThreads } = useThreadStore();
  const branding = config.branding;
  const secondary = branding.secondaryTextColor;
  const primary = branding.primaryTextColor;
  const surface = branding.surfaceColor;
  const border = branding.borderColor;
  const [name, setName] = React.useState(user?.name ?? "");
  const [contactType, setContactType] = React.useState<ContactType>("email");
  const [contact, setContact] = React.useState(user?.email ?? "");
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
      const hasName = name.trim().length >= 2;
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
      setState(data.contactRequired || !hasName ? "contact" : "success");
    },
    [chatUser.id, name, setCurrentThreadId, setThreads],
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

  const selectType = (type: ContactType) => {
    setContactType(type);
    // Don't carry a value across kinds — an email in the phone box is confusing.
    setContact(type === "email" ? (user?.email ?? "") : "");
    setError("");
  };

  /** Returns an error message for the active contact type, or null if valid. */
  const validateContact = (value: string): string | null => {
    if (!value) return "Please add a way for us to reach you";
    if (contactType === "email") {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? null
        : "Please enter a valid email address";
    }
    if (contactType === "phone") {
      const digits = value.replace(/\D/g, "");
      return /^[+\d][\d\s()-]*$/.test(value) && digits.length >= 7
        ? null
        : "Please enter a valid phone number";
    }
    return /linkedin\.com\/.+/i.test(value) || /^[a-zA-Z0-9._-]{2,}$/.test(value)
      ? null
      : "Enter your LinkedIn URL or handle";
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Please enter your name");
      return;
    }
    const value = contact.trim();
    const invalid = validateContact(value);
    if (invalid) {
      setError(invalid);
      return;
    }
    setState("loading");
    setError("");
    const result = await requestHumanHandoff({
      threadId,
      user: chatUser,
      name,
      // Keep sending `email` for back-compat when email is the chosen type.
      email: contactType === "email" ? value : undefined,
      contact: { type: contactType, value },
      reason: "Customer requested human support",
    });
    if (!result.success || !result.data) {
      setError(result.error ?? "Could not submit your details");
      setState("contact");
      return;
    }
    applyResult(result.data);
  };

  // Input adapts to the chosen contact type (keyboard, placeholder, autofill).
  // LinkedIn uses type=text (not url) so a bare handle doesn't trip native
  // URL validation before our own check runs.
  const contactInputProps: React.InputHTMLAttributes<HTMLInputElement> =
    contactType === "email"
      ? {
          type: "email",
          inputMode: "email",
          maxLength: 254,
          autoComplete: "email",
          placeholder: "you@company.com",
        }
      : contactType === "phone"
        ? {
            type: "tel",
            inputMode: "tel",
            maxLength: 32,
            autoComplete: "tel",
            placeholder: "+1 555 123 4567",
          }
        : {
            type: "text",
            inputMode: "url",
            maxLength: 255,
            autoComplete: "url",
            placeholder: "linkedin.com/in/yourname",
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
          <div
            className="rounded-xl border px-4 py-3.5 text-sm"
            style={{ backgroundColor: surface, borderColor: border, color: secondary }}
          >
            Preparing your conversation…
          </div>
        ) : null}

        {state === "contact" ? (
          <form onSubmit={submit} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium" style={{ color: primary }}>
                Name
              </span>
              <input
                required
                minLength={2}
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ backgroundColor: surface, borderColor: border, color: primary }}
                autoComplete="name"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: primary }}>
                How should we reach you?
              </span>
              <div
                role="group"
                aria-label="Contact method"
                className="flex gap-1 rounded-lg border p-1"
                style={{ borderColor: border }}
              >
                {CONTACT_TYPES.map((opt) => {
                  const selected = contactType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => selectType(opt.key)}
                      aria-pressed={selected}
                      className="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                      style={
                        selected
                          ? { background: primary, color: contrastForeground(primary) }
                          : { background: "transparent", color: secondary }
                      }
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <input
                required
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{ backgroundColor: surface, borderColor: border, color: primary }}
                {...contactInputProps}
              />
              <p className="text-[11px]" style={{ color: secondary }}>
                We just need one — pick whichever you prefer.
              </p>
            </div>
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <Button
              type="submit"
              className="w-full cursor-pointer"
              style={{
                backgroundColor: branding.primaryTextBackground,
                color: branding.askButtonTextColor,
              }}
            >
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
                style={{
                  backgroundColor: surface,
                  borderColor: border,
                  color: primary,
                }}
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
