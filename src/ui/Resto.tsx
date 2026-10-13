import { carDef } from '../game/data'
import { PIECE_COUNT, RESTO_PIECES, piecesOf } from '../game/resto'
import { CarThumb } from '../scene/BuildingPreview'

// A resto-mod as a 2x2 puzzle: the car's shadow, with each piece you hold showing its
// quarter of the car in colour. `fresh` glows the piece just won; `done` shows it whole.
export function BuildArt({ model, have, fresh, done, size = 'sm' }: { model: string; have: number[]; fresh?: number; done?: boolean; size?: 'xs' | 'sm' | 'lg' }) {
  const d = carDef(model)
  const lit = done ? RESTO_PIECES.map((_, i) => i) : have
  // One mask layer per piece held: the quarter it shows.
  const mask = lit.map(() => 'linear-gradient(#000,#000)').join(',') || 'linear-gradient(transparent,transparent)'
  const pos = lit.map((i) => `${i % 2 ? 100 : 0}% ${i < 2 ? 0 : 100}%`).join(',')
  return (
    <span className={`build-art ${size}${done ? ' done' : ''}`}>
      <CarThumb size={size} body={d.body} model={d.id} color="#546e7a" />
      {lit.length > 0 && (
        <span className="ba-real" style={{ maskImage: mask, WebkitMaskImage: mask, maskPosition: pos, WebkitMaskPosition: pos }}>
          <CarThumb size={size} body={d.body} model={d.id} color={d.colors[0]} />
        </span>
      )}
      <span className="ba-grid">
        {RESTO_PIECES.map((p, i) => (
          <i key={i} className={`${lit.includes(i) ? 'got' : ''}${fresh === i && !done ? ' fresh' : ''}`}>{!lit.includes(i) && <em>{p.icon}</em>}</i>
        ))}
      </span>
    </span>
  )
}

// How many of a car's pieces you hold, as "2/4".
export const pieceCount = (parts: readonly string[] | null | undefined, model: string) => `${piecesOf(parts, model).length}/${PIECE_COUNT}`
