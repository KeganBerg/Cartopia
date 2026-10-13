import { useGame } from '../game/store'
import { COLOR_THEMES, LAMP_POSTS, LIGHT_TONES, lampPost, lightTone } from '../game/cityLook'

// Menu > Town: street light colour, lamp post design and a colour theme for the whole town.
export function CityLook() {
  const lights = useGame((s) => s.lights)
  const theme = useGame((s) => s.cityTheme)
  const setLights = useGame((s) => s.setLights)
  const setTheme = useGame((s) => s.setCityTheme)
  const tone = lightTone(lights).id
  const post = lampPost(lights)
  return (
    <div className="city-look">
      <h3>💡 Street lights</h3>
      <div className="theme-strip">
        {LIGHT_TONES.map((t) => (
          <button key={t.id} className={`theme-dot${tone === t.id ? ' sel' : ''}`} style={{ background: t.c }} title={t.name} aria-label={t.name} onClick={() => setLights({ tone: t.id })} />
        ))}
      </div>
      <div className="lamp-posts">
        {LAMP_POSTS.map((p) => (
          <button key={p.id} className={post === p.id ? 'sel' : ''} onClick={() => setLights({ post: p.id })}><span>{p.icon}</span>{p.name}</button>
        ))}
      </div>
      <h3>🎨 Town colours</h3>
      <div className="theme-strip">
        <button className={`theme-dot${!theme ? ' sel' : ''}`} title="Own colours" aria-label="Own colours" onClick={() => setTheme(null)}>🏠</button>
        {COLOR_THEMES.map((t) => (
          <button key={t.id} className={`theme-dot${theme === t.id ? ' sel' : ''}`} style={{ background: t.c }} title={t.name} aria-label={t.name} onClick={() => setTheme(t.id)} />
        ))}
      </div>
    </div>
  )
}
