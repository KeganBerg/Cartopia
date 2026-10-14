// My Garage shows every copy of one car model as a single stack. The stack's face is the
// highest-PI copy, unless the player has picked another copy of it.
export type StackRow = { c: { uid: string; model: string }; pi: number }

export type Stack<R extends StackRow> = { model: string; copies: R[]; top: R }

// Groups rows by model, keeping the incoming order of first appearance. Copies run top PI first.
export function stackCars<R extends StackRow>(rows: R[]): Stack<R>[] {
  const by = new Map<string, R[]>()
  for (const r of rows) {
    const g = by.get(r.c.model)
    if (g) g.push(r)
    else by.set(r.c.model, [r])
  }
  return [...by].map(([model, copies]) => {
    copies.sort((a, b) => b.pi - a.pi)
    return { model, copies, top: copies[0] }
  })
}

// The copy a stack shows: the selected one when it is in this stack, else the top-PI copy.
export function stackFace<R extends StackRow>(s: Stack<R>, selected: string | null | undefined): R {
  return s.copies.find((r) => r.c.uid === selected) ?? s.top
}
