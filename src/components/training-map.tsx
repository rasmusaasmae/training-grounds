import 'leaflet/dist/leaflet.css'
import { latLngBounds, type LatLngBoundsExpression, type LatLngTuple } from 'leaflet'
import { useEffect, useRef } from 'react'
import { MapContainer, Polygon, TileLayer, useMap, ZoomControl } from 'react-leaflet'

import { STATUS_COLORS } from '@/lib/format'
import type { MultiPolygon, TrainingGround, TrainingObject } from '@/lib/grounds'
import type { Status } from '@/lib/schedule'

const ESTONIA: LatLngBoundsExpression = [
  [57.5, 21.8],
  [59.8, 28.2],
]

// Maa- ja Ruumiamet's orthophoto with its road and place-name overlay.
const TILES = 'https://tiles.maaamet.ee/tm/tms/1.0.0'
const ATTRIBUTION = '&copy; <a href="https://maaruum.ee">Maa- ja Ruumiamet</a>'

export type MapItem = { object: TrainingObject; status: Status }

/** Changing `key` moves the map to fit `objects` (or all of Estonia). */
export type MapView = { key: string; objects: TrainingObject[] }

type Props = {
  grounds: TrainingGround[]
  items: MapItem[]
  view: MapView
  /** Called with an object's id when its shape is clicked. */
  onSelect: (id: string) => void
}

export function TrainingMap({ grounds, items, view, onSelect }: Props) {
  return (
    <MapContainer
      bounds={ESTONIA}
      zoomSnap={0.25}
      zoomControl={false}
      className="absolute inset-0 z-0 bg-neutral-900"
    >
      <TileLayer
        url={`${TILES}/foto@GMC/{z}/{x}/{y}.jpg`}
        tms
        maxNativeZoom={18}
        maxZoom={19}
        attribution={ATTRIBUTION}
      />
      <TileLayer url={`${TILES}/hybriid@GMC/{z}/{x}/{y}.png`} tms maxNativeZoom={18} maxZoom={19} />
      <ZoomControl position="bottomright" />

      {grounds.map(
        (ground) =>
          ground.boundary && <GroundOutline key={ground.slug} boundary={ground.boundary} />,
      )}

      {items.map(({ object, status }) => (
        <Polygon
          key={object.id}
          positions={toLatLngs(object.geometry)}
          pathOptions={{
            color: STATUS_COLORS[status.kind],
            fillColor: STATUS_COLORS[status.kind],
            fillOpacity: 0.35,
            weight: 2,
          }}
          eventHandlers={{ click: () => onSelect(object.id) }}
        />
      ))}

      <FollowView view={view} />
    </MapContainer>
  )
}

function GroundOutline({ boundary }: { boundary: MultiPolygon }) {
  return (
    <Polygon
      positions={toLatLngs(boundary)}
      interactive={false}
      pathOptions={{ color: '#fff', weight: 1.5, opacity: 0.8, dashArray: '4 6', fill: false }}
    />
  )
}

function FollowView({ view }: { view: MapView }) {
  const map = useMap()
  // Only a new key moves the map, so data refreshes leave the user's pan alone.
  const shownKey = useRef<string>(undefined)
  useEffect(() => {
    if (shownKey.current === view.key) return
    shownKey.current = view.key
    const options = flyOptions(map.getSize().x)
    if (!view.objects.length) return void map.flyToBounds(ESTONIA, options)
    map.flyToBounds(
      latLngBounds(view.objects.flatMap((o) => toLatLngs(o.geometry).flat(2))),
      options,
    )
  }, [map, view])
  return null
}

// Keep shapes clear of the picker card: on the left on wide screens, along
// the top on phones.
function flyOptions(width: number) {
  const wide = width >= 640
  return {
    paddingTopLeft: (wide ? [464, 24] : [16, 180]) as [number, number],
    paddingBottomRight: [16, 16] as [number, number],
    maxZoom: 17,
    duration: 0.6,
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
}

function toLatLngs(geometry: MultiPolygon): LatLngTuple[][][] {
  return geometry.coordinates.map((polygon) =>
    polygon.map((ring) => ring.map(([lon, lat]) => [lat, lon])),
  )
}
