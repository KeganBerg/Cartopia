import { useEffect } from 'react'
import { useGame } from '../game/store'
import { supabase } from '../lib/supabase'
import { battleChests, demoBattle, refreshCrewBattle, useCrewBattle } from '../lib/battles'
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
  useEffect(() => {
    if (panel !== 'clan' && panel !== 'battle') return
    refreshCrewBattle()
    const id = setInterval(refreshCrewBattle, 60_000)
    return () => clearInterval(id)
  }, [panel])
}
