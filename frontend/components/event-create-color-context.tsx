"use client";

import {
  DEFAULT_EVENTRA_EVENT_COLOR,
  normalizeEventColor,
} from "@/lib/event-colors";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type EventCreateColorContextValue = {
  color: string;
  setColor: (hex: string) => void;
};

const EventCreateColorContext =
  createContext<EventCreateColorContextValue | null>(null);

export function EventCreateColorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [color, setColorState] = useState(DEFAULT_EVENTRA_EVENT_COLOR);

  const setColor = useCallback((hex: string) => {
    setColorState(normalizeEventColor(hex) ?? DEFAULT_EVENTRA_EVENT_COLOR);
  }, []);

  const value = useMemo(() => ({ color, setColor }), [color, setColor]);

  return (
    <EventCreateColorContext.Provider value={value}>
      {children}
    </EventCreateColorContext.Provider>
  );
}

export function useEventCreateColor(): EventCreateColorContextValue {
  const ctx = useContext(EventCreateColorContext);
  if (!ctx) {
    return {
      color: DEFAULT_EVENTRA_EVENT_COLOR,
      setColor: () => {},
    };
  }
  return ctx;
}
