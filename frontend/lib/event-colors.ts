export const GOOGLE_EVENT_COLOR_FALLBACK = "#4285F4";
export const TASK_BLOCK_COLOR = "#0F766E";

/** Google Calendar week-view / color-picker colors (not colors.get `.background`). */
export const EVENT_COLOR_PALETTE = [
  { id: "1", label: "Lavender", hex: "#7986CB", apiHex: "#A4BDFC" },
  { id: "2", label: "Sage", hex: "#33B679", apiHex: "#7AE7BF" },
  { id: "3", label: "Grape", hex: "#8E24AA", apiHex: "#DBADFF" },
  { id: "4", label: "Flamingo", hex: "#E67C73", apiHex: "#FF887C" },
  { id: "5", label: "Banana", hex: "#F6BF26", apiHex: "#FBD75B" },
  { id: "6", label: "Tangerine", hex: "#F4511E", apiHex: "#FFB878" },
  { id: "7", label: "Peacock", hex: "#039BE5", apiHex: "#46D6DB" },
  { id: "8", label: "Graphite", hex: "#616161", apiHex: "#E1E1E1" },
  { id: "9", label: "Blueberry", hex: "#3F51B5", apiHex: "#5484ED" },
  { id: "10", label: "Basil", hex: "#0B8043", apiHex: "#51B749" },
  { id: "11", label: "Tomato", hex: "#D50000", apiHex: "#DC2127" },
] as const;

export const DEFAULT_EVENTRA_EVENT_COLOR = EVENT_COLOR_PALETTE[8].hex;

const API_OR_DISPLAY_TO_UI: Record<string, string> = {
  ...Object.fromEntries(
    EVENT_COLOR_PALETTE.map((c) => [c.apiHex, c.hex]),
  ),
  ...Object.fromEntries(EVENT_COLOR_PALETTE.map((c) => [c.hex, c.hex])),
  // Google calendar color 14 (calendarList.backgroundColor) → UI peacock-blue
  "#9FE1E7": "#039BE5",
  "#9FC6E7": "#4285F4",
  "#4986E7": "#3F51B5",
};

export function normalizeEventColor(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return hex.toUpperCase();
}

/** Map API chip / stored hex to the color Google Calendar actually paints. */
export function toGoogleDisplayColor(value?: string | null): string | null {
  const hex = normalizeEventColor(value);
  if (!hex) return null;
  return API_OR_DISPLAY_TO_UI[hex] ?? hex;
}

export function eventContrastText(hex: string): string {
  const n = hex.startsWith("#") ? hex.slice(1) : hex;
  if (n.length !== 6) return "#FFFFFF";
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#202124" : "#FFFFFF";
}
