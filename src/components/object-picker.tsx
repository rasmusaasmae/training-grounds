import { Fragment, useMemo } from 'react'

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import type { TrainingGround } from '@/lib/grounds'

type Item = { id: string; code: string; name: string; ground: string }

type Props = {
  grounds: TrainingGround[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

const byCode = (a: Item, b: Item) => a.code.localeCompare(b.code, 'et', { numeric: true })

/** Picks objects across grounds; each ground is a group in the list. */
export function ObjectPicker({ grounds, selectedIds, onChange }: Props) {
  const anchor = useComboboxAnchor()

  const groups = useMemo(
    () =>
      grounds
        .filter((ground) => ground.objects.length)
        .map((ground) => ({
          value: ground.name,
          items: ground.objects
            .map((o) => ({ id: o.id, code: o.code, name: o.name, ground: ground.name }))
            .toSorted(byCode),
        })),
    [grounds],
  )
  const itemsById = useMemo(
    () => new Map(groups.flatMap((g) => g.items).map((item) => [item.id, item])),
    [groups],
  )
  const value = selectedIds.flatMap((id) => itemsById.get(id) ?? [])

  return (
    <Combobox
      multiple
      autoHighlight
      items={groups}
      value={value}
      onValueChange={(items: Item[], details) => {
        // Escape on the closed list would clear everything; the selection is
        // the user's bookmark, so only the chips' remove buttons drop items.
        if (details.reason === 'escape-key') return
        onChange(items.map((item) => item.id))
      }}
      itemToStringLabel={(item: Item) => `${item.ground} ${item.code} ${item.name}`}
      isItemEqualToValue={(a: Item, b: Item) => a.id === b.id}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(items: Item[]) => (
            <Fragment>
              {items.map((item) => (
                <ComboboxChip key={item.id}>
                  {item.ground} {item.code}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                aria-label="Areas to watch"
                placeholder={items.length ? 'Add…' : 'Pick areas to watch, e.g. Männiku LA1'}
              />
            </Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No areas match.</ComboboxEmpty>
        <ComboboxList>
          {(group: (typeof groups)[number]) => (
            <ComboboxGroup key={group.value} items={group.items}>
              <ComboboxLabel>{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(item: Item) => (
                  <ComboboxItem key={item.id} value={item}>
                    {item.code} · {item.name}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
