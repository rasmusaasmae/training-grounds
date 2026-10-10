import { ListChecksIcon } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { TrainingGround } from '@/lib/grounds'

type Props = {
  grounds: TrainingGround[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

const byCode = (a: { code: string }, b: { code: string }) =>
  a.code.localeCompare(b.code, 'et', { numeric: true })

/** A button naming the picked areas; it opens a dialog to change them. */
export function AreaPicker({ grounds, selectedIds, onChange }: Props) {
  const groups = useMemo(
    () =>
      grounds
        .filter((ground) => ground.objects.length)
        .map((ground) => ({ name: ground.name, objects: ground.objects.toSorted(byCode) })),
    [grounds],
  )
  const selected = new Set(selectedIds)
  // "Männiku LA1, LA2 · Klooga A", in list order.
  const summary = groups
    .map((g) => ({ name: g.name, codes: g.objects.filter((o) => selected.has(o.id)) }))
    .filter((g) => g.codes.length)
    .map((g) => `${g.name} ${g.codes.map((o) => o.code).join(', ')}`)
    .join(' · ')

  const toggle = (id: string) =>
    onChange(selected.has(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id])

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="lg" className="w-full justify-between" />}
        disabled={!groups.length}
      >
        <span className="truncate">{summary || 'Pick areas to watch'}</span>
        <ListChecksIcon data-icon="inline-end" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Areas to watch</DialogTitle>
          <DialogDescription>
            Your choice is kept in the page address, so bookmark it.
          </DialogDescription>
        </DialogHeader>
        <Command className="-m-1 h-auto w-auto bg-transparent">
          <CommandInput placeholder="Search, e.g. Männiku LA1" />
          <CommandList className="max-h-[min(24rem,55dvh)]">
            <CommandEmpty>No areas match.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.name} heading={group.name}>
                {group.objects.map((object) => (
                  <CommandItem
                    key={object.id}
                    value={object.id}
                    keywords={[group.name, object.code, object.name]}
                    data-checked={selected.has(object.id)}
                    onSelect={() => toggle(object.id)}
                  >
                    <span className="font-medium">{object.code}</span>
                    <span className="truncate text-muted-foreground">{object.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <DialogFooter>
          <Button variant="ghost" disabled={!selectedIds.length} onClick={() => onChange([])}>
            Clear
          </Button>
          <DialogClose render={<Button />}>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
