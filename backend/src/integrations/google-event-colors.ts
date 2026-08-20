/** Google Calendar UI event colors (week view / color picker), keyed by colorId. */
export const GOOGLE_EVENT_COLORS: Record<string, string> = {
  '1': '#7986CB',
  '2': '#33B679',
  '3': '#8E24AA',
  '4': '#E67C73',
  '5': '#F6BF26',
  '6': '#F4511E',
  '7': '#039BE5',
  '8': '#616161',
  '9': '#3F51B5',
  '10': '#0B8043',
  '11': '#D50000',
};

/** colors.get `.background` chips → UI display colors. */
const API_BACKGROUND_TO_UI: Record<string, string> = {
  '#A4BDFC': '#7986CB',
  '#7AE7BF': '#33B679',
  '#DBADFF': '#8E24AA',
  '#FF887C': '#E67C73',
  '#FBD75B': '#F6BF26',
  '#FFB878': '#F4511E',
  '#46D6DB': '#039BE5',
  '#E1E1E1': '#616161',
  '#5484ED': '#3F51B5',
  '#51B749': '#0B8043',
  '#DC2127': '#D50000',
  '#9FE1E7': '#039BE5',
  '#9FC6E7': '#4285F4',
  '#4986E7': '#3F51B5',
};

export const GOOGLE_EVENT_COLOR_FALLBACK = '#4285F4';

export function normalizeHexColor(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return hex.toUpperCase();
}

export function toGoogleDisplayColor(value?: string | null): string | null {
  const hex = normalizeHexColor(value);
  if (!hex) return null;
  return API_BACKGROUND_TO_UI[hex] ?? hex;
}

export function resolveGoogleEventColor(
  colorId: string | undefined,
  eventColors: Record<string, string>,
  calendarColor: string,
): string {
  const fromId = colorId
    ? toGoogleDisplayColor(
        eventColors[colorId] ?? GOOGLE_EVENT_COLORS[colorId],
      )
    : null;
  return fromId ?? toGoogleDisplayColor(calendarColor) ?? calendarColor;
}
