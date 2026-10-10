import { type Status, TIME_ZONE, tallinnMidnight } from './schedule'

// Estonian formats: 24-hour clock, day before month ("E, 12.10 08:00").
const timeFormat = new Intl.DateTimeFormat('et', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})
const dateFormat = new Intl.DateTimeFormat('et', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
})

export const clock = (t: number) => timeFormat.format(t)

/** "17:00" today, or "E, 12.10 08:00" on another day. */
export function when(t: number, now: number) {
  if (tallinnMidnight(t) === tallinnMidnight(now)) return clock(t)
  return `${dateFormat.format(t)} ${clock(t)}`
}

/**
 * The end of a stretch as seen from the day `from` falls on: "20:00", "24:00"
 * at midnight, or "L, 10.10 07:00" on a later day.
 */
export function endTime(end: number, from: number) {
  const last = end - 1 // A stretch ending at midnight ends on the day before.
  const time = tallinnMidnight(end) === end ? '24:00' : clock(end)
  if (tallinnMidnight(last) === tallinnMidnight(from)) return time
  return `${dateFormat.format(last)} ${time}`
}

/** "Closed until 17:00", "Open until E, 12.10 08:00" or "Open, nothing scheduled". */
export function describeStatus(status: Status, now: number) {
  const { closure } = status
  if (closure && closure.start <= now) return `Closed until ${when(closure.end, now)}`
  if (!closure) return 'Open, nothing scheduled'
  return `Open until ${when(closure.start, now)}`
}

/** Tailwind's red-600, orange-500 and green-600. */
export const STATUS_COLORS: Record<Status['kind'], string> = {
  closed: '#dc2626',
  today: '#f97316',
  open: '#16a34a',
}

export const STATUS_LABELS: Record<Status['kind'], string> = {
  closed: 'Closed for the rest of today',
  today: 'Opens or closes later today',
  open: 'Open for the rest of today',
}
