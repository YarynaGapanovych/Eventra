export type OverlapRange = {
  start: Date | string | number;
  end: Date | string | number;
};

export type OverlapEvent = OverlapRange & {
  id: string;
  title: string;
  busy?: boolean;
};

const RECURRENCE_INSTANCE_SEP = '::';

function toMs(value: Date | string | number): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

function masterId(id: string): string {
  const index = id.indexOf(RECURRENCE_INSTANCE_SEP);
  return index === -1 ? id : id.slice(0, index);
}

export function rangesOverlap(a: OverlapRange, b: OverlapRange): boolean {
  const aStart = toMs(a.start);
  const aEnd = toMs(a.end);
  const bStart = toMs(b.start);
  const bEnd = toMs(b.end);
  if (
    Number.isNaN(aStart) ||
    Number.isNaN(aEnd) ||
    Number.isNaN(bStart) ||
    Number.isNaN(bEnd)
  ) {
    return false;
  }
  return aStart < bEnd && bStart < aEnd;
}

export function findOverlappingEvents<T extends OverlapEvent>(
  events: T[],
  range: OverlapRange,
  options?: { excludeId?: string | null },
): T[] {
  const excludeId = options?.excludeId ?? null;
  const excludeMaster = excludeId ? masterId(excludeId) : null;
  return events.filter((event) => {
    if (event.busy === false) return false;
    if (excludeId) {
      if (event.id === excludeId) return false;
      if (excludeMaster && masterId(event.id) === excludeMaster) return false;
    }
    return rangesOverlap(event, range);
  });
}
