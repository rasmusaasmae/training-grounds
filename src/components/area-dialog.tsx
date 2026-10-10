import type { EventSourceFuncInfo } from '@fullcalendar/react'
import etLocale from '@fullcalendar/react/locales/et'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { EventCalendar } from '@/components/event-calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { clock, describeStatus, endTime, STATUS_COLORS } from '@/lib/format'
import type { TrainingObject } from '@/lib/grounds'
import {
  type Closure,
  type Status,
  type Stretch,
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
  const { ref, hourHeight } = useHourHeight()
  // Blocks are drawn a day past either edge of the range, so the edges don't
  // read as changes; labels use each stretch's real start and end.
  const events = useCallback(
    async (range: EventSourceFuncInfo) => {
      const from = range.start.valueOf() - DAY
      const to = range.end.valueOf() + DAY
      return stretchesBetween(closures, from, to).map((s) => ({
        start: Math.max(s.start, from),
        end: Math.min(s.end, to),
        title: s.closed ? closedTitle(s.closure) : 'Open',
        color: s.closed ? STATUS_COLORS.closed : STATUS_COLORS.open,
        extendedProps: { stretch: s },
      }))
    },
    [closures],
  )

  return (
    <div ref={ref}>
      <EventCalendar
        height="min(36rem, calc(100dvh - 10rem))"
        borderless
        availableViews={['timeGridThreeDay', 'listWeek']}
        views={{
          timeGridThreeDay: { type: 'timeGrid', duration: { days: 3 } },
          timeGrid: {
            tableBodyClass: 'area-calendar-body',
            // No hour labels or titles, as the colour says open or closed:
            // each block shows when it starts and ends.
            slotHeaderInnerClass: 'invisible w-0 text-xs',
            columnEventInnerClass: 'h-full px-2 py-0.5 text-xs',
            eventContent: (info) => {
              const stretch: Stretch = info.event.extendedProps.stretch
              if (info.isStart && stretch.end === Infinity) {
                return <div className="font-medium">from {clock(stretch.start)}</div>
              }
              if (info.isStart) {
                // Wraps before the end time on narrow columns.
                return (
                  <div className="font-medium">
                    {clock(stretch.start)} –{' '}
                    <span className="whitespace-nowrap">{endTime(stretch.end, stretch.start)}</span>
                  </div>
                )
              }
              if (info.isEnd) {
                return (
                  <div className="font-medium">until {endTime(stretch.end, stretch.end - 1)}</div>
                )
              }
              return null
            },
          },
        }}
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
        nowIndicator
        noEventsText="Nothing scheduled"
        slotMinHeight={hourHeight}
        scrollTime="06:00"
      />
    </div>
  )
}

/**
 * Hour rows an 18th of the time grid's height, so 06:00–24:00 fill the view
 * and the night is a scroll up.
 */
function useHourHeight() {
  const ref = useRef<HTMLDivElement>(null)
  const [hourHeight, setHourHeight] = useState<number>()
  useLayoutEffect(() => {
    const wrapper = ref.current
    if (!wrapper) return
    const measure = () => {
      const body = wrapper.querySelector('.area-calendar-body')
      if (body) setHourHeight(Math.floor(body.clientHeight / 18))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(wrapper)
    measure()
    return () => observer.disconnect()
  }, [])
  return { ref, hourHeight }
}

/** "Closed: shooting, tactics" */
function closedTitle(closure: Closure | undefined) {
  const types = [...new Set(closure?.exercises.map((e) => e.type))]
  return types.length ? `Closed: ${types.join(', ')}` : 'Closed'
}
