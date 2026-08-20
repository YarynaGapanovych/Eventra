"use client";

import {
  DEFAULT_EVENTRA_EVENT_COLOR,
  normalizeEventColor,
} from "@/lib/event-colors";
import type { CalendarDetailsInput } from "@/lib/calendar-details";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type EventCreateDraft = CalendarDetailsInput;

const DEFAULT_DRAFT: EventCreateDraft = {
  color: DEFAULT_EVENTRA_EVENT_COLOR,
  allDay: false,
  busy: true,
  visibility: "default",
  guestCanModify: false,
  guestCanInvite: true,
  guestCanSeeOthers: true,
  guests: [],
  reminders: [],
};

type EventCreateDraftContextValue = {
  draft: EventCreateDraft;
  setDraft: (draft: EventCreateDraft) => void;
  getDraft: () => EventCreateDraft;
};

const EventCreateDraftContext =
  createContext<EventCreateDraftContextValue | null>(null);

export function EventCreateColorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [draft, setDraftState] = useState<EventCreateDraft>(DEFAULT_DRAFT);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const setDraft = useCallback((next: EventCreateDraft) => {
    const color =
      normalizeEventColor(next.color ?? DEFAULT_EVENTRA_EVENT_COLOR) ??
      DEFAULT_EVENTRA_EVENT_COLOR;
    const merged = { ...next, color };
    draftRef.current = merged;
    setDraftState(merged);
  }, []);

  const getDraft = useCallback(() => draftRef.current, []);

  const value = useMemo(
    () => ({ draft, setDraft, getDraft }),
    [draft, setDraft, getDraft],
  );

  return (
    <EventCreateDraftContext.Provider value={value}>
      {children}
    </EventCreateDraftContext.Provider>
  );
}

export function useEventCreateDraft(): EventCreateDraftContextValue {
  const ctx = useContext(EventCreateDraftContext);
  if (!ctx) {
    return {
      draft: DEFAULT_DRAFT,
      setDraft: () => {},
      getDraft: () => DEFAULT_DRAFT,
    };
  }
  return ctx;
}

export function useEventCreateColor(): {
  color: string;
  setColor: (hex: string) => void;
} {
  const { draft, setDraft } = useEventCreateDraft();
  return {
    color: draft.color ?? DEFAULT_EVENTRA_EVENT_COLOR,
    setColor: (hex: string) => setDraft({ ...draft, color: hex }),
  };
}
