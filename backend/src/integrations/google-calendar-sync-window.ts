export const DEFAULT_SYNC_DAYS_BACK = 30;
export const DEFAULT_SYNC_DAYS_FORWARD = 90;

export const SYNC_DAYS_BACK_PRESETS = [7, 14, 30, 90, 180, 365] as const;
export const SYNC_DAYS_FORWARD_PRESETS = [30, 90, 180, 365] as const;

export function clampSyncDaysBack(value: unknown): number {
  return clampToPreset(
    value,
    SYNC_DAYS_BACK_PRESETS,
    DEFAULT_SYNC_DAYS_BACK,
  );
}

export function clampSyncDaysForward(value: unknown): number {
  return clampToPreset(
    value,
    SYNC_DAYS_FORWARD_PRESETS,
    DEFAULT_SYNC_DAYS_FORWARD,
  );
}

function clampToPreset(
  value: unknown,
  presets: readonly number[],
  fallback: number,
): number {
  const n = typeof value === 'number' ? value : Number(value);
  return presets.includes(n) ? n : fallback;
}
