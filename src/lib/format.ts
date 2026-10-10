import { type Status, TIME_ZONE, tallinnMidnight } from './schedule'

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})
const weekdayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short' })
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

export const clock = (t: number) => timeFormat.format(t)

/** "17:00" today, "Sun 17:00" this week, or "Mon 26 Oct 08:00" further out. */
export function when(t: number, now: number) {
  const daysAway = Math.round((tallinnMidnight(t) - tallinnMidnight(now)) / 86_400_000)
  if (daysAway === 0) return clock(t)
  if (daysAway < 7) return `${weekdayFormat.format(t)} ${clock(t)}`
  return `${dateFormat.format(t)} ${clock(t)}`
}

/** An area's state and until when it holds. */
export function describeStatus(status: Status, now: number) {
  if (status.kind === 'closed') {
    return { label: 'Closed', until: `until ${when(status.closure.end, now)}` }
  }
  if (!status.closure) return { label: 'Open', until: 'nothing scheduled' }
  return { label: 'Open', until: `until ${when(status.closure.start, now)}` }
}

/** Tailwind's red-600, orange-500 and green-600. */
export const STATUS_COLORS: Record<Status['kind'], string> = {
  closed: '#dc2626',
  today: '#f97316',
  open: '#16a34a',
}
