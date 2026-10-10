import { useMemo } from 'react'

import { ObjectPicker } from '@/components/object-picker'
import { type MapView, TrainingMap } from '@/components/training-map'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { clock } from '@/lib/format'
import { useGrounds, useNow, useSelectedIds } from '@/lib/hooks'
import { closuresFor, statusAt } from '@/lib/schedule'

export default function App() {
  const { data, error } = useGrounds()
  const [ids, setIds] = useSelectedIds()
  const now = useNow()

  const grounds = useMemo(() => data?.grounds ?? [], [data])
  const selected = useMemo(() => {
    const byId = new Map(
      grounds.flatMap((ground) => ground.objects.map((object) => [object.id, { object, ground }])),
    )
    return ids
      .flatMap((id) => byId.get(id) ?? [])
      .map(({ object, ground }) => ({
        object,
        closures: closuresFor(object.code, ground.exercises),
      }))
  }, [grounds, ids])
  const items = selected.map((item) => ({ ...item, status: statusAt(item.closures, now) }))

  // Frame the selection whenever it changes, and once the data is in.
  const view: MapView = {
    key: `${data ? 'ready' : 'loading'}:${ids.join(',')}`,
    objects: selected.map((s) => s.object),
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <TrainingMap grounds={grounds} items={items} now={now} view={view} />

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
            <ObjectPicker grounds={grounds} selectedIds={ids} onChange={setIds} />
            {data && !ids.length && (
              <p className="text-sm text-muted-foreground">
                Pick the areas you care about. Your choice is kept in the page address, so bookmark
                it.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
