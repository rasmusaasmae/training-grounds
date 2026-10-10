// Shared by the server (parsing mil.ee) and the browser (status, timeline), so
// keep it free of Bun and DOM APIs.

export const TIME_ZONE = 'Europe/Tallinn'

const MINUTE = 60_000

/** `data-exercise-type` on mil.ee. */
export type ExerciseType = 'shooting' | 'blasting' | 'tactics'

/** `data-noise-level` on mil.ee. */
export type NoiseLevel = 'absent' | 'low' | 'average' | 'high' | 'very_high'

/** One row of a training ground's schedule. Times are epoch milliseconds. */
export type Exercise = {
  start: number
  end: number
  type: ExerciseType | (string & {})
  noise: NoiseLevel | (string & {})
  /** Object codes, e.g. `LA1`, as listed under "Väljaõppeobjektid". */
  objects: string[]
}

/** A stretch of time an object is closed, made of one or more exercises. */
export type Closure = {
  start: number
  end: number
  exercises: Exercise[]
}

export type Status =
  /** An exercise is on: going there is forbidden until `closure.end`. */
  | { kind: 'closed'; closure: Closure }
  /** Open now, but `closure` starts before midnight (Tallinn). */
  | { kind: 'today'; closure: Closure }
  /** Open for the rest of the day; `closure` is the next one, if any. */
  | { kind: 'open'; closure: Closure | undefined }

/**
 * The closures of one object. mil.ee splits multi-day exercises into one row
 * per day (… – 23:59, 00:00 – …), so back-to-back and overlapping exercises
 * are joined.
 */
export function closuresFor(code: string, exercises: Exercise[]): Closure[] {
  const closures: Closure[] = []
  const own = exercises
    .filter((e) => e.objects.includes(code))
    .toSorted((a, b) => a.start - b.start)
  for (const exercise of own) {
    const last = closures.at(-1)
    if (last && exercise.start <= last.end + MINUTE) {
      last.end = Math.max(last.end, exercise.end)
      last.exercises.push(exercise)
    } else {
      closures.push({ start: exercise.start, end: exercise.end, exercises: [exercise] })
    }
  }
  return closures
}

export function statusAt(closures: Closure[], now: number): Status {
  const current = closures.find((c) => c.start <= now && now < c.end)
  if (current) return { kind: 'closed', closure: current }
  const next = closures.find((c) => c.start > now)
  if (next && next.start < tallinnMidnight(now, 1)) return { kind: 'today', closure: next }
  return { kind: 'open', closure: next }
}

const tallinnParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
})

/** Wall-clock date and time in Tallinn at the instant `t`. */
export function tallinnWallClock(t: number) {
  const parts = Object.fromEntries(
    tallinnParts.formatToParts(t).map((p) => [p.type, Number(p.value)]),
  )
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
  }
}

function tallinnOffset(t: number) {
  const w = tallinnWallClock(t)
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - (t - (t % MINUTE))
}

/** The instant at `hour:minute` on `date` (YYYY-MM-DD) in Tallinn. */
export function tallinnTime(date: string, hour: number, minute: number): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  // The offset at `wall` read as UTC is off by up to three hours, which only
  // matters near a DST switch; correct with the offset at the first guess.
  return wall - tallinnOffset(wall - tallinnOffset(wall))
}

/** Midnight in Tallinn of the day `t` falls on, `days` days later. */
export function tallinnMidnight(t: number, days = 0): number {
  const w = tallinnWallClock(t)
  const date = new Date(Date.UTC(w.year, w.month - 1, w.day + days))
  return tallinnTime(date.toISOString().slice(0, 10), 0, 0)
}
