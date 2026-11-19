import { create } from 'zustand'
import { compile, lookup, type Compiled, type Dict } from './translate'
import { applyDict } from './dom'

// The language the game is shown in. English is written in the code; Spanish and
// Portuguese come from dictionaries loaded only by players who use them.
export type Lang = 'en' | 'es' | 'pt'
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'pt', label: 'Português' },
]

const KEY = 'cartopia-lang'
const LOADERS: Record<Exclude<Lang, 'en'>, () => Promise<{ default: Dict }>> = {
  es: () => import('./es.json'),
  pt: () => import('./pt.json'),
}

// The device's own language when the player hasn't picked one.
export function deviceLang(langs: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]): Lang {
  for (const l of langs) {
    const base = l.toLowerCase().slice(0, 2)
    if (base === 'en') return 'en'
    if (base === 'es' || base === 'pt') return base
  }
  return 'en'
}

function saved(): Lang | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'en' || v === 'es' || v === 'pt' ? v : null
  } catch {
    return null
  }
}

export const useLang = create<{ lang: Lang }>(() => ({ lang: 'en' }))
let current: Compiled | null = null

async function show(lang: Lang) {
  const dict = lang === 'en' ? null : compile((await LOADERS[lang]()).default)
  // A newer pick may have landed while this one loaded.
  if (useLang.getState().lang !== lang) return
  current = dict
  document.documentElement.lang = lang
  applyDict(dict)
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    // Storage blocked: the pick lasts for this visit.
  }
  useLang.setState({ lang })
  void show(lang)
}

// Called once at start-up.
export function startLang() {
  const lang = saved() ?? deviceLang()
  useLang.setState({ lang })
  if (lang !== 'en') void show(lang)
}

// A line of English in the current language, for things drawn outside the page's text
// (the spoken tutorial). Untranslated lines come back as they are.
export const tr = (en: string) => (current && lookup(current, en.replace(/\s+/g, ' ').trim())) ?? en
