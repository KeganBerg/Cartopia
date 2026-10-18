import { useLayoutEffect, useRef } from 'react'
import { InShell, Panel } from './Menus'
import { ClanPanel, LeadersPanel, SOCIAL_TITLE, SocialTabs } from './Social'
import { FriendsPanel } from './Friends'
import { MeetPanel } from './Meet'
import { KeepTabs } from './KeepTabs'

export type SocialTab = 'friends' | 'clan' | 'meet' | 'leaders'
export const isSocialTab = (p: string | null): p is SocialTab => p === 'friends' || p === 'clan' || p === 'meet' || p === 'leaders'

// Friends, Crew, Meet and Leaderboards in one window that stays open while the tabs swap: only
// what's under the tab row changes, and it starts from the top. Tabs seen once are kept (KeepTabs).
export function SocialPanel({ tab }: { tab: SocialTab }) {
  const top = useRef<HTMLDivElement>(null)
  // Only on a new tab: showing the kept window again on the same one leaves it where it was.
  const was = useRef(tab)
  useLayoutEffect(() => {
    if (was.current === tab) return
    was.current = tab
    const body = top.current?.closest('.panel-body')
    if (body) body.scrollTop = 0
  }, [tab])
  return (
    <Panel title={SOCIAL_TITLE} wide className="social-panel">
      <div ref={top} />
      <SocialTabs current={tab} />
      <InShell.Provider value={true}>
        <KeepTabs tab={tab} render={(t) => (t === 'friends' ? <FriendsPanel /> : t === 'clan' ? <ClanPanel /> : t === 'meet' ? <MeetPanel /> : <LeadersPanel />)} />
      </InShell.Provider>
    </Panel>
  )
}
