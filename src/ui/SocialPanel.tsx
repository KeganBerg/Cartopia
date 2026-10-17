import { useLayoutEffect, useRef } from 'react'
import { InShell, Panel } from './Menus'
import { ClanPanel, LeadersPanel, SOCIAL_TITLE, SocialTabs } from './Social'
import { FriendsPanel } from './Friends'
import { MeetPanel } from './Meet'

export type SocialTab = 'friends' | 'clan' | 'meet' | 'leaders'
export const isSocialTab = (p: string | null): p is SocialTab => p === 'friends' || p === 'clan' || p === 'meet' || p === 'leaders'

// Friends, Crew, Meet and Leaderboards in one window that stays open while the tabs swap: only
// what's under the tab row changes, and it starts from the top.
export function SocialPanel({ tab }: { tab: SocialTab }) {
  const top = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const body = top.current?.closest('.panel-body')
    if (body) body.scrollTop = 0
  }, [tab])
  return (
    <Panel title={SOCIAL_TITLE} wide className="social-panel">
      <div ref={top} />
      <SocialTabs current={tab} />
      <InShell.Provider value={true}>
        {tab === 'friends' ? <FriendsPanel /> : tab === 'clan' ? <ClanPanel /> : tab === 'meet' ? <MeetPanel /> : <LeadersPanel />}
      </InShell.Provider>
    </Panel>
  )
}
