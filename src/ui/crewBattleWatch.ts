import { useEffect } from 'react'
import { useGame } from '../game/store'
import { supabase } from '../lib/supabase'
import { battleChests, demoBattle, refreshCrewBattle, useCrewBattle, warPoints } from '../lib/battles'
import { sfx } from '../lib/sound'

// Keeps the battle fresh while the crew screens are open, and says when a victory chest is waiting.
let toldWeek = ''
export function useCrewBattleWatcher() {
  const panel = useGame((s) => s.panel)
  useEffect(() => {
    // ?battle=demo opens a made-up battle straight away.
    if (demoBattle()) {
      refreshCrewBattle()
      const t = setTimeout(() => useGame.getState().openPanel('battle'), 1500)
      return () => clearTimeout(t)
    }
    if (!supabase) return
    const sub = supabase.auth.onAuthStateChange(() => setTimeout(async () => {
      await refreshCrewBattle()
      const b = useCrewBattle.getState().battle
      const due = b && b.payable ? battleChests(b.last, b.rules) : []
      if (due.length && b!.last && toldWeek !== b!.last.week) {
        toldWeek = b!.last.week
        sfx.notify()
        useGame.getState().toast(b!.last.result === 'win' ? '⚔️ Your crew won its battle! Claim your victory chest.' : '⚔️ Your crew battle ended in a draw. Claim your chest.')
      }
    }, 5000))
    return () => sub.data.subscription.unsubscribe()
  }, [])
  // Every race counts for the war: say how much, for which crew, as the race ends. The server adds the
  // points when the town saves, so the board refreshes a little later.
  useEffect(() => useGame.subscribe((s, p) => {
    const races = (s.stats.races ?? 0) - (p.stats.races ?? 0)
    if (races <= 0 || s.visiting) return
    const b = useCrewBattle.getState().battle
    const cur = b?.current
    if (!cur || cur.result) return
    const pts = warPoints(races, Math.max(0, (s.racesWon ?? 0) - (p.racesWon ?? 0)), b!.rules)
    useGame.getState().toast(`⚔️ +${pts} war points for ${cur.us.tag}`)
    if (!demoBattle()) setTimeout(refreshCrewBattle, 15_000)
  }), [])
  useEffect(() => {
    if (panel !== 'clan' && panel !== 'battle') return
    refreshCrewBattle()
    const id = setInterval(refreshCrewBattle, 60_000)
    return () => clearInterval(id)
  }, [panel])
}
