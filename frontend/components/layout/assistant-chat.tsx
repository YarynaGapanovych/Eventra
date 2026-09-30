"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useAskAssistant,
  useAssistantThreadQuery,
  useResetAssistantThread,
  type AssistantChatMessage,
} from "@/hooks/use-assistant";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { RotateCcw, Sparkles, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

const EXAMPLES = [
  "What's on my calendar tomorrow?",
  "Add a high-priority task: book venue",
  "What tasks are still todo?",
];

type VisibleMessage = AssistantChatMessage;

const BOLD_RE = /\*\*(.+?)\*\*/g;
const BULLET_RE = /^[*+\-]\s+(.*)$/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  const re = new RegExp(BOLD_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push(
      <strong key={`${keyPrefix}-${i}`} className="font-semibold">
        {match[1]}
      </strong>,
    );
    i += 1;
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts.length > 0 ? parts : [text];
}

function AssistantMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    if (BULLET_RE.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length) {
        const next = lines[i].match(BULLET_RE);
        if (!next) break;
        items.push(next[1]);
        i += 1;
      }
      const listKey = blocks.length;
      blocks.push(
        <ul
          key={`ul-${listKey}`}
          className="my-1 list-disc space-y-0.5 pl-4"
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `li-${listKey}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (lines[i].trim() === "") {
      i += 1;
      continue;
    }

    const paraKey = blocks.length;
    blocks.push(
      <p key={`p-${paraKey}`} className="m-0">
        {renderInline(lines[i], `p-${paraKey}`)}
      </p>,
    );
    i += 1;
  }

  return <div className="space-y-1">{blocks}</div>;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AssistantChat({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const ask = useAskAssistant();
  const resetThread = useResetAssistantThread();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<VisibleMessage[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const threadQuery = useAssistantThreadQuery({
    enabled: open && Boolean(user),
  });
  const serverMessages = useMemo(
    () => threadQuery.data?.messages ?? [],
    [threadQuery.data?.messages],
  );
  const messages = localMessages ?? serverMessages;
  const showReset = Boolean(user) && messages.length > 0;

  const closePanel = useCallback(() => {
    setOpen(false);
    setLocalMessages(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      closePanel();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [closePanel, open]);

  useEffect(() => {
    const last = listRef.current?.lastElementChild;
    last?.scrollIntoView({ block: "end" });
  }, [messages, ask.isPending, open]);

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || ask.isPending || resetThread.isPending || !user) return;

      const base = localMessages ?? serverMessages;
      setLocalMessages([
        ...base,
        {
          id: newId(),
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDraft("");
      setError(null);

      try {
        const reply = await ask.mutateAsync(content);
        setLocalMessages((prev) => [
          ...(prev ?? base),
          {
            id: newId(),
            role: "assistant",
            content: reply.content,
            createdAt: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not reach the assistant.",
        );
      }
    },
    [ask, localMessages, resetThread.isPending, serverMessages, user],
  );

  const onReset = useCallback(async () => {
    if (resetThread.isPending || ask.isPending) return;
    setError(null);
    try {
      await resetThread.mutateAsync();
      setLocalMessages([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reset the conversation.",
      );
    }
  }, [ask.isPending, resetThread]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };

  return (
    <div className={cn("relative", className)}>
      <div ref={buttonRef} className="inline-flex">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Eventra assistant"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? titleId : undefined}
          className="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onClick={() => {
            if (open) closePanel();
            else setOpen(true);
          }}
        >
          <Sparkles className="size-[22px]" aria-hidden strokeWidth={2} />
        </Button>
      </div>

      {open ? (
        <div
          ref={panelRef}
          className="fixed inset-x-3 top-16 z-[60] flex w-auto max-h-[calc(100dvh-8.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-[min(calc(100vw-2rem),24rem)] md:max-h-[min(75vh,36rem)] dark:border-zinc-800 dark:bg-zinc-950"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h2
              id={titleId}
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Assistant
            </h2>
            <div className="flex items-center gap-1">
              {showReset ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Reset conversation"
                  disabled={resetThread.isPending || ask.isPending}
                  onClick={() => void onReset()}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Close"
                onClick={closePanel}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {!user ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to chat about your tasks and calendar.
            </p>
          ) : (
            <>
              <div
                ref={listRef}
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3"
              >
                {messages.length === 0 ? (
                  <div className="space-y-3 py-2">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Ask about your schedule, or have me add a task.
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {EXAMPLES.map((example) => (
                        <button
                          key={example}
                          type="button"
                          className="rounded-lg border border-zinc-200 px-3 py-2 text-left text-xs text-zinc-700 transition-colors hover:border-teal-300 hover:bg-teal-50/60 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-teal-800 dark:hover:bg-teal-950/40"
                          onClick={() => void send(example)}
                          disabled={ask.isPending || resetThread.isPending}
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                        message.role === "user"
                          ? "ml-auto whitespace-pre-wrap bg-teal-600 text-white dark:bg-teal-500"
                          : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <AssistantMarkdown text={message.content} />
                      ) : (
                        message.content
                      )}
                    </div>
                  ))
                )}
                {ask.isPending ? (
                  <div className="max-w-[90%] rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Thinking…
                  </div>
                ) : null}
                {error ? (
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                ) : null}
              </div>

              <form
                className="shrink-0 border-t border-zinc-200 p-2 dark:border-zinc-800"
                onSubmit={onSubmit}
              >
                <label className="sr-only" htmlFor={`${titleId}-input`}>
                  Message
                </label>
                <div className="flex items-end gap-2">
                  <Textarea
                    id={`${titleId}-input`}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ask about tasks or events…"
                    rows={2}
                    className="min-h-16 max-h-32 resize-none text-sm"
                    disabled={ask.isPending || resetThread.isPending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(draft);
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      ask.isPending || resetThread.isPending || !draft.trim()
                    }
                  >
                    Send
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
