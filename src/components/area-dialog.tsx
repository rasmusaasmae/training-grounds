import type { EventSourceFuncInfo } from '@fullcalendar/react'
import etLocale from '@fullcalendar/react/locales/et'
import { cn } from 'cn'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

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
import { type Closure, type Status, stretchesBetween, TIME_ZONE } from '@/lib/schedule'

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
  // Open stretches fill whatever range the calendar shows.
  const events = useCallback(
    async (range: EventSourceFuncInfo) =>
      stretchesBetween(closures, range.start.valueOf(), range.end.valueOf()).map((s) => ({
        start: s.start,
        end: s.end,
        title: s.closed ? closedTitle(s.closure) : 'Open',
        color: s.closed ? STATUS_COLORS.closed : STATUS_COLORS.open,
      })),
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
            // Smaller labels than the theme's, so rows can be short.
            slotHeaderInnerClass: (info) =>
              cn('relative -top-2 ms-2 me-3 text-xs', info.isFirst && 'hidden'),
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
        slotHeaderFormat={TIME_FORMAT}
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
