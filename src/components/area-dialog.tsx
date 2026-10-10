import type { EventSourceFuncInfo, SlotHeaderInfo } from '@fullcalendar/react'
import etLocale from '@fullcalendar/react/locales/et'
import { cn } from 'cn'
import { useCallback, useMemo, useRef, useState } from 'react'

import { EventCalendar } from '@/components/event-calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { describeStatus, STATUS_COLORS } from '@/lib/format'
import type { TrainingObject } from '@/lib/grounds'
import {
  type Closure,
  type Status,
  cutoffsBetween,
  stretchesBetween,
  TIME_ZONE,
} from '@/lib/schedule'

export type AreaDetails = {
  object: TrainingObject
  ground: string
  closures: Closure[]
  status: Status
}

type Props = {
  area: AreaDetails | undefined
  now: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TIME_FORMAT = { hour: '2-digit', minute: '2-digit' } as const
const DAY = 86_400_000

/** An area's status and a calendar of when it is open and closed, three days at a time. */
export function AreaDialog({ area, now, open, onOpenChange }: Props) {
  // Focus the dialog itself rather than ringing the calendar's first button.
  const popup = useRef<HTMLDivElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={popup} initialFocus={popup} className="sm:max-w-3xl">
        {area && (
          <>
            <DialogHeader>
              <DialogTitle>
                {area.ground} {area.object.code}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: STATUS_COLORS[area.status.kind] }}
                />
                {area.object.name}: {describeStatus(area.status, now).toLowerCase()}
              </DialogDescription>
            </DialogHeader>
            <AreaCalendar closures={area.closures} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AreaCalendar({ closures }: { closures: Closure[] }) {
  // Blocks are drawn a day past either edge of the range, so the edges don't
  // read as changes.
  const events = useCallback(
    async (range: EventSourceFuncInfo) => {
      const from = range.start.valueOf() - DAY
      const to = range.end.valueOf() + DAY
      return stretchesBetween(closures, from, to).map((s) => ({
        start: Math.max(s.start, from),
        end: Math.min(s.end, to),
        title: s.closed ? closedTitle(s.closure) : 'Open',
        color: s.closed ? STATUS_COLORS.closed : STATUS_COLORS.open,
      }))
    },
    [closures],
  )

  // The side shows 00:00, 24:00 and the times the area opens or closes in
  // the days on screen, instead of every hour.
  const [range, setRange] = useState<{ start: number; end: number }>()
  const labels = useMemo(
    () => axisLabels(range ? cutoffsBetween(closures, range.start, range.end) : []),
    [closures, range],
  )
  const views = useMemo(
    () => ({
      timeGridThreeDay: { type: 'timeGrid', duration: { days: 3 } },
      timeGrid: {
        slotHeaderClass: 'relative self-stretch',
        slotHeaderInnerClass: '',
        slotHeaderContent: ({ time }: SlotHeaderInfo) => {
          const from = (time?.milliseconds ?? 0) / 60_000
          return (
            <>
              {/* Sizes the side's width and the rows' least height. */}
              <span className="invisible block ps-3 pe-2 text-xs leading-none tabular-nums">
                24:00
              </span>
              {labels
                .filter(
                  (m) => m >= from && (m < from + 60 || (m === DAY_MINUTES && from + 60 === m)),
                )
                .map((m) => (
                  <span
                    key={m}
                    className={cn(
                      'absolute end-2 text-xs leading-none text-muted-foreground tabular-nums',
                      // Centred on their line; the day's edges would be cut off.
                      m === 0 ? '' : m === DAY_MINUTES ? '-translate-y-full' : '-translate-y-1/2',
                    )}
                    style={{ top: `${((m - from) / 60) * 100}%` }}
                  >
                    {formatMinutes(m)}
                  </span>
                ))}
            </>
          )
        },
        // The colour says open or closed and the side says when.
        eventContent: () => null,
        // Every day's piece of a block is rounded, so each day reads as its
        // own 00:00–24:00 column, even where a block runs past midnight.
        columnEventClass: 'mb-px rounded-sm border ring ring-background',
      },
    }),
    [labels],
  )

  return (
    <EventCalendar
      height="min(36rem, calc(100dvh - 10rem))"
      borderless
      availableViews={['timeGridThreeDay', 'listWeek']}
      views={views}
      buttons={{ timeGridThreeDay: { text: '3 days' }, listWeek: { text: 'List' } }}
      // Estonian dates and times, English words like the rest of the page.
      locale={etLocale}
      todayText="Today"
      allDayText="All day"
      todayHint="Today"
      prevHint="Earlier"
      nextHint="Later"
      timeZone={TIME_ZONE}
      events={events}
      eventContrastColor="#fff"
      eventTimeFormat={TIME_FORMAT}
      allDaySlot={false}
      slotDuration="01:00"
      // The whole day fills the view, without scrolling: blocks keep their
      // true height, so a short one at midnight can't poke past the end.
      expandRows
      eventMinHeight={0}
      nowIndicator
      noEventsText="Nothing scheduled"
      datesSet={(info) =>
        setRange((r) =>
          r?.start === info.start.valueOf() && r.end === info.end.valueOf()
            ? r
            : { start: info.start.valueOf(), end: info.end.valueOf() },
        )
      }
    />
  )
}

const DAY_MINUTES = 24 * 60
/** Axis labels this many minutes apart or closer would overlap. */
const MIN_GAP = 50

/** Minutes of the day to label: the cutoffs that fit, framed by 00:00 and 24:00. */
function axisLabels(cutoffs: { hour: number; minute: number }[]) {
  const shown: number[] = []
  for (const m of cutoffs.map((c) => c.hour * 60 + c.minute)) {
    if (!shown.length || m - shown.at(-1)! >= MIN_GAP) shown.push(m)
  }
  if ((shown[0] ?? DAY_MINUTES) >= MIN_GAP) shown.unshift(0)
  if (DAY_MINUTES - shown.at(-1)! >= MIN_GAP) shown.push(DAY_MINUTES)
  return shown
}

/** 750 → "12:30", 1440 → "24:00" */
function formatMinutes(m: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** "Closed: shooting, tactics" */
function closedTitle(closure: Closure | undefined) {
  const types = [...new Set(closure?.exercises.map((e) => e.type))]
  return types.length ? `Closed: ${types.join(', ')}` : 'Closed'
}
