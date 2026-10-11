import { useGame, fuelCap } from '../game/store'
import { buildingDef, isOpen, xpToNext, FUEL_REGEN_SECONDS, RACE_FUEL, refillBucks, type BuildingDef } from '../game/data'
import { useNow } from '../scene/useNow'
import { Panel } from './Menus'

const LABEL = { coins: 'coins', parts: 'parts', fuel: 'fuel', bucks: 'gems', level: 'a higher level' } as const
const ICON = { coins: '$', parts: '⚙', fuel: '⛽', bucks: '💎', level: '⭐' } as const

type Source = { icon: string; title: string; detail: string; action?: { label: string; run: () => void; disabled?: boolean } }

// "How do I get more X?" shown whenever the player is short of something.
export function NeedPanel() {
  const s = useGame()
  const now = useNow()
  const need = s.need
  if (!need) return null

  const build = (id: string): Source['action'] => {
    const d: BuildingDef = buildingDef(id)
    if (s.level < d.unlockLevel) return { label: `🔒 Level ${d.unlockLevel}`, run: () => {}, disabled: true }
    if (d.unique && s.buildings.some((b) => b.def === id)) return { label: '✔ Built', run: () => {}, disabled: true }
    return { label: `Build · $${d.price.toLocaleString()}`, run: () => s.openShop(id) }
  }
  const isJob = (def: string) => !!buildingDef(def).jobSeconds && buildingDef(def).kind !== 'obstacle'
  const idle = s.buildings.filter((b) => isJob(b.def) && b.jobEndsAt === null && isOpen(buildingDef(b.def), now)).length
  const ready = s.buildings.filter((b) => isJob(b.def) && b.jobEndsAt !== null && now >= b.jobEndsAt).length
  const jobDefs = [...new Set(s.buildings.filter((b) => isJob(b.def)).map((b) => b.def))]
  const showJobs = () => s.showMe(jobDefs, ready ? 'Tap the flashing $ bubbles to collect.' : 'Tap a flashing ⛽ bubble to start a job.')
  const showParts = (id: string) => () => s.showMe([id], `Tap the flashing bubble on your ${buildingDef(id).name} to start a parts job.`)
  const owned = (id: string) => s.buildings.filter((b) => b.def === id).length
  // Skip the upgrade tip when the upgrade itself is what they're short for.
  const upgradableOwned = !need.what?.startsWith('upgrading') && s.buildings.some((b) => isJob(b.def))

  let sources: Source[] = []
  let summary = ''
  if (need.res === 'coins') {
    summary = need.missing ? `You need ${need.missing.toLocaleString()} more coins${need.what ? ` for ${need.what}` : ''}.` : `You have ${s.coins.toLocaleString()} coins. Here's how to earn more.`
    sources = [
      { icon: '🏪', title: 'Run jobs at your businesses', detail: `Tap the ⛽ bubble to start a job, then the $ bubble to collect. ${ready} ready to collect, ${idle} idle right now.`, action: { label: 'Show me', run: showJobs } },
      ...(upgradableOwned ? [{ icon: '⬆', title: 'Upgrade your businesses', detail: 'Upgraded businesses pay more coins per job and finish sooner. Find them under Upgrades in the Shop.', action: { label: 'Upgrades', run: () => s.openShop('upgrades') } }] : []),
      { icon: '🔍', title: "Search at Rusty's", detail: 'Searches can turn up coin stashes along with cars.', action: owned('rescue') ? { label: "Rusty's", run: () => s.openPanel('rescue') } : build('rescue') },
      { icon: '🏆', title: 'Win drag races', detail: `Each race costs ${RACE_FUEL} fuel and pays a few hundred coins.`, action: { label: 'Race', run: () => s.openPanel('race') } },
      { icon: '📋', title: 'Finish goals', detail: 'Goals pay coins, XP and sometimes gems.', action: { label: 'Goals', run: () => s.openPanel('goals') } },
      { icon: '👫', title: 'Help other towns', detail: 'Visit a town once a day and tap Help out.', action: { label: 'Friends', run: () => s.openPanel('friends') } },
      { icon: '📅', title: 'Daily bonus', detail: 'Come back every day for up to $1,200.' },
    ]
  } else if (need.res === 'parts') {
    summary = `${need.missing ? `You need ${need.missing} more parts${need.what ? ` for ${need.what}` : ''}.` : `You have ${s.parts} parts.`} Parts (the ⚙ gears) come from these businesses:`
    sources = [
      { icon: '🔧', title: "Rusty's Rescue searches", detail: owned('rescue') ? 'Searches turn up parts, and you can scrap cars in storage for 3 to 12 parts.' : 'Build Rusty\'s to search for cars and parts.', action: owned('rescue') ? { label: "Rusty's", run: () => s.openPanel('rescue') } : build('rescue') },
      { icon: '🛞', title: 'Tire Shop · 6 parts per job (level 2)', detail: `You have ${owned('tires')}. Build more for more parts.`, action: owned('tires') ? { label: 'Show me', run: showParts('tires') } : build('tires') },
      { icon: '🛢', title: 'Lube & Go · 8 parts per job (level 4)', detail: `You have ${owned('lube')}.`, action: owned('lube') ? { label: 'Show me', run: showParts('lube') } : build('lube') },
      { icon: '📦', title: 'Parts Depot · 15 parts per job (level 5)', detail: `You have ${owned('parts')}.`, action: owned('parts') ? { label: 'Show me', run: showParts('parts') } : build('parts') },
      { icon: '🏁', title: 'Tuner Shop · 25 parts per job (level 7)', detail: `You have ${owned('tuner')}.`, action: owned('tuner') ? { label: 'Show me', run: showParts('tuner') } : build('tuner') },
      { icon: '📅', title: 'Daily bonus day 4', detail: '+5 parts on the fourth day of your streak.' },
    ]
  } else if (need.res === 'fuel') {
    const cap = fuelCap(s)
    const next = s.fuel >= cap ? null : Math.max(0, FUEL_REGEN_SECONDS - Math.floor((now - s.fuelUpdatedAt) / 1000))
    summary = need.missing ? `You need ${need.missing} more fuel${need.what ? ` for ${need.what}` : ''}. You have ${s.fuel}/${cap}.` : `You have ${s.fuel}/${cap} fuel.`
    const refill = refillBucks(cap - s.fuel)
    sources = [
      { icon: '⛽', title: `Fill up with gems · 💎 ${refill}`, detail: s.fuel >= cap ? 'Your tank is full.' : `Fill your tank to ${cap} right now. You have ${s.bucks} gems.`, action: { label: `Fill up · 💎 ${refill}`, run: s.refillFuel, disabled: s.fuel >= cap } },
      { icon: '⏱', title: 'Wait for a refill', detail: next === null ? 'Your tank is full.' : `Fuel refills 1 every minute. Next one in ${next}s.` },
      { icon: '⛽', title: 'Build a Gas Station', detail: `Each one adds +10 to your max fuel. You have ${owned('gas')}.`, action: build('gas') },
      ...(owned('house') ? [{ icon: '🏡', title: 'Upgrade your homes', detail: 'Every home level adds +1 to your max fuel. Find them under Upgrades in the Shop.', action: { label: 'Upgrades', run: () => s.openShop('upgrades') } }] : []),
      { icon: '⭐', title: 'Level up', detail: 'Leveling up refills your tank and raises the max.' },
      { icon: '📅', title: 'Daily bonus day 3', detail: '+5 fuel on the third day of your streak.' },
    ]
  } else if (need.res === 'bucks') {
    summary = need.missing ? `You need ${need.missing} more gems${need.what ? ` for ${need.what}` : ''}.` : `You have ${s.bucks} gems.`
    sources = [
      { icon: '🏦', title: 'Visit the Bank', detail: 'Buy gems in packs. Bigger packs come with bonus gems, coins and parts.', action: { label: 'Bank', run: () => s.openPanel('bank') } },
      { icon: '⭐', title: 'Level up', detail: 'Every new level gives +1 gem.' },
      { icon: '📋', title: 'Finish goals', detail: 'Bigger goals pay gems.', action: { label: 'Goals', run: () => s.openPanel('goals') } },
      { icon: '📅', title: 'Daily bonus day 5', detail: '+1 gem on the fifth day of your streak.' },
    ]
  } else {
    const toGo = xpToNext(s.level) - s.xp
    summary = `${need.what ?? 'This'} unlocks at level ${need.missing}. You're level ${s.level}, ${toGo.toLocaleString()} XP from level ${s.level + 1}.`
    sources = [
      { icon: '🏪', title: 'Collect from businesses', detail: 'Every job you collect gives XP.', action: { label: 'Show me', run: showJobs } },
      { icon: '🏗', title: 'Build and buy', detail: 'New buildings, cars and upgrades all give XP.', action: { label: 'Shop', run: () => s.openPanel('shop') } },
      { icon: '🏆', title: 'Race', detail: 'Wins give 30 XP.', action: { label: 'Race', run: () => s.openPanel('race') } },
      { icon: '📋', title: 'Goals', detail: 'Goals give big XP rewards.', action: { label: 'Goals', run: () => s.openPanel('goals') } },
    ]
  }

  return (
    <Panel title={`How to get ${LABEL[need.res]}`}>
      <div className="need-head">
        <span className={`ico need-ico need-${need.res}`}>{ICON[need.res]}</span>
        <p>{summary}</p>
      </div>
      <div className="sources">
        {sources.map((src) => (
          <div key={src.title} className="source">
            <span className="source-icon">{src.icon}</span>
            <div>
              <b>{src.title}</b>
              <div className="card-stat">{src.detail}</div>
            </div>
            {src.action && (
              <button className="buy small" disabled={src.action.disabled} onClick={src.action.run}>{src.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}
