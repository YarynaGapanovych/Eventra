import { validateFrontendRedirectUri } from '../auth/frontend-redirect';

export const DEFAULT_FRONTEND_REDIRECT =
  'http://localhost:3000/settings?google_calendar=callback';

export function validateCalendarRedirectUri(uri: string): string {
  return validateFrontendRedirectUri(uri);
}
