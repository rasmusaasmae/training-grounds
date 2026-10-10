import { lazy, Suspense, useMemo, useState } from 'react'

import { AreaPicker } from '@/components/area-picker'
import { type MapView, TrainingMap } from '@/components/training-map'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { clock, STATUS_COLORS, STATUS_LABELS } from '@/lib/format'
import { useGrounds, useNow, useSelectedIds } from '@/lib/hooks'
import { closuresFor, statusAt } from '@/lib/schedule'

// The calendar is most of the page's code, so load it on the first click.
const AreaDialog = lazy(() =>
  import('@/components/area-dialog').then((m) => ({ default: m.AreaDialog })),
)

export default function App() {
  const { data, error } = useGrounds()
  const [ids, setIds] = useSelectedIds()
  const now = useNow()
  // The shown area stays set while the dialog animates closed.
  const [shownId, setShownId] = useState<string>()
  const [dialogOpen, setDialogOpen] = useState(false)

  const grounds = useMemo(() => data?.grounds ?? [], [data])
  const selected = useMemo(() => {
    const byId = new Map(
      grounds.flatMap((ground) => ground.objects.map((object) => [object.id, { object, ground }])),
    )
    return ids
      .flatMap((id) => byId.get(id) ?? [])
      .map(({ object, ground }) => ({
        object,
        ground: ground.name,
        closures: closuresFor(object.code, ground.exercises),
      }))
  }, [grounds, ids])
  const items = selected.map((item) => ({ ...item, status: statusAt(item.closures, now) }))
  const shown = items.find((item) => item.object.id === shownId)

  // Frame the selection whenever it changes, and once the data is in.
  const view: MapView = {
    key: `${data ? 'ready' : 'loading'}:${ids.join(',')}`,
    objects: selected.map((s) => s.object),
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <TrainingMap
        grounds={grounds}
        items={items}
        view={view}
        onSelect={(id) => {
          setShownId(id)
          setDialogOpen(true)
        }}
      />
      {shownId && (
        <Suspense>
          <AreaDialog
            area={shown}
            now={now}
            open={dialogOpen && !!shown}
            onOpenChange={setDialogOpen}
          />
        </Suspense>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 *:pointer-events-auto sm:w-md">
        <Card>
          <CardHeader>
            <CardTitle>Training Grounds</CardTitle>
            <CardDescription>
              {data ? (
                <>
                  From{' '}
                  <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                    mil.ee
                  </a>
                  , updated {clock(data.fetchedAt)}.
                </>
              ) : error ? (
                "Couldn't load the schedule."
              ) : (
                'Loading the schedule…'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <AreaPicker grounds={grounds} selectedIds={ids} onChange={setIds} />
            {data && !ids.length && (
              <p className="text-sm text-muted-foreground">
                Pick the areas you care about, then tap one on the map to see when it is open.
              </p>
            )}
            {!!ids.length && (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {(['closed', 'today', 'open'] as const).map((kind) => (
                  <li key={kind} className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: STATUS_COLORS[kind] }}
                    />
                    {STATUS_LABELS[kind]}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
