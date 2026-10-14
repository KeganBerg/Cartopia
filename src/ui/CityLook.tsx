import { useGame } from '../game/store'
import { COLOR_THEMES, LAMP_POSTS, LIGHT_TONES, lampPost, lightTone } from '../game/cityLook'

// Pictures of each choice, rendered from the real lamp posts and buildings
// (scripts/townlook renders them again): lamp-<post>-<tone>, theme-<id|own>.
const ART = import.meta.glob<string>('../assets/town-look/*.webp', { eager: true, import: 'default' })
const art = (name: string) => ART[`../assets/town-look/${name}.webp`]

// Menu > Town: lamp post design and street light colour, and a colour theme for the whole town.
export function CityLook() {
  const lights = useGame((s) => s.lights)
  const theme = useGame((s) => s.cityTheme)
  const setLights = useGame((s) => s.setLights)
  const setTheme = useGame((s) => s.setCityTheme)
  const tone = lightTone(lights)
  const post = lampPost(lights)
  const themes = [{ id: 'own', name: 'Own colours' }, ...COLOR_THEMES]
  return (
    <div className="city-look">
      <h3 className="cl-head">💡 Street lights</h3>
      <div className="cl-grid cl-lamps">
        {LAMP_POSTS.map((p) => (
          <button key={p.id} className={post === p.id ? 'cl-card sel' : 'cl-card'} aria-pressed={post === p.id} onClick={() => setLights({ post: p.id })}>
            <img src={art(`lamp-${p.id}-${tone.id}`)} alt="" draggable={false} />
            <span className="cl-name">{p.name}</span>
          </button>
        ))}
      </div>
      <div className="cl-bulbs" role="radiogroup" aria-label="Light colour">
        {LIGHT_TONES.map((t) => (
          <button key={t.id} role="radio" aria-checked={tone.id === t.id} className={tone.id === t.id ? 'cl-bulb sel' : 'cl-bulb'} style={{ ['--c' as string]: t.c }} title={t.name} aria-label={t.name} onClick={() => setLights({ tone: t.id })}>
            <i />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      <h3 className="cl-head">🎨 Town colours</h3>
      <div className="cl-grid cl-themes">
        {themes.map((t) => {
          const on = t.id === 'own' ? !theme : theme === t.id
          return (
            <button key={t.id} className={on ? 'cl-card sel' : 'cl-card'} aria-pressed={on} onClick={() => setTheme(t.id === 'own' ? null : t.id)}>
              <img src={art(`theme-${t.id}`)} alt="" draggable={false} />
              <span className="cl-name">{t.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
