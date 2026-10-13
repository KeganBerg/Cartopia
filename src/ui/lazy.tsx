import { useEffect, useState, type ComponentType } from 'react'

// A component whose code loads the first time it shows. Shows nothing for the
// moment the file is loading, then the component with the same props. (A plain
// state flip rather than React.lazy, which never showed the panel in the dev server.)
export function onDemand<M, P extends object = object>(load: () => Promise<M>, pick: (m: M) => ComponentType<P>) {
  let Loaded: ComponentType<P> | null = null
  return function OnDemand(props: P) {
    const [, setReady] = useState(false)
    useEffect(() => {
      if (!Loaded) void load().then((m) => { Loaded = pick(m); setReady(true) })
    }, [])
    return Loaded ? <Loaded {...props} /> : null
  }
}
