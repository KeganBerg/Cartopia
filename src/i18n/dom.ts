import { translateText, type Compiled } from './translate'

// Puts the page into another language as React draws it, without touching any component:
// every piece of text and every title, aria-label, placeholder and alt is swapped for its
// translation as it appears or changes. What React wrote is kept, so switching back to
// English (or to another language) puts it back. Text inside [data-no-i18n] (chat,
// player names), inputs and editable boxes is left alone.

const ATTRS = ['title', 'aria-label', 'placeholder', 'alt']
// Text in these is never touched; the attributes of a text box (its placeholder) still are.
const SKIP = 'script,style,[contenteditable],[data-no-i18n]'
const TEXT_SKIP = `${SKIP},textarea`

let dict: Compiled | null = null
let observer: MutationObserver | null = null
// What React put in each text node, and what we last wrote over it.
const source = new WeakMap<Text, string>()
const wrote = new WeakMap<Text, string>()
const attrSource = new WeakMap<Element, Map<string, string>>()
const attrWrote = new WeakMap<Element, Map<string, string>>()

const skipped = (el: Element | null) => !!el?.closest(SKIP)

// An element whose children are all text ("Win ", "5", " races" from <b>Win {n} races</b>)
// is translated as one line, so a pattern can see the whole sentence.
function textOnly(el: Element) {
  const kids = el.childNodes
  if (kids.length < 2) return null
  const out: Text[] = []
  for (const k of kids) {
    if (k.nodeType !== Node.TEXT_NODE) return null
    out.push(k as Text)
  }
  return out
}

function original(t: Text) {
  const now = t.nodeValue ?? ''
  // React changed it since we last wrote: what it says now is the new English.
  if (wrote.get(t) !== now) source.set(t, now)
  return source.get(t) ?? now
}

function write(t: Text, v: string) {
  wrote.set(t, v)
  if (t.nodeValue !== v) t.nodeValue = v
}

function doText(t: Text) {
  const el = t.parentElement
  if (!el || el.closest(TEXT_SKIP)) return
  const group = textOnly(el)
  if (group) return doGroup(group)
  const en = original(t)
  write(t, (dict && translateText(dict, en)) ?? en)
}

function doGroup(nodes: Text[]) {
  const ens = nodes.map(original)
  const joined = dict && translateText(dict, ens.join(''))
  if (joined !== null && joined !== undefined) {
    nodes.forEach((n, i) => write(n, i === 0 ? joined : ''))
    return
  }
  // No line for the whole: try each piece on its own.
  nodes.forEach((n, i) => write(n, (dict && translateText(dict, ens[i])) ?? ens[i]))
}

function doAttrs(el: Element) {
  if (skipped(el)) return
  for (const a of ATTRS) {
    const now = el.getAttribute(a)
    if (now === null) continue
    const src = attrSource.get(el) ?? new Map<string, string>()
    const mine = attrWrote.get(el) ?? new Map<string, string>()
    if (mine.get(a) !== now) src.set(a, now)
    const en = src.get(a)!
    const to = (dict && translateText(dict, en)) ?? en
    mine.set(a, to)
    attrSource.set(el, src)
    attrWrote.set(el, mine)
    if (to !== now) el.setAttribute(a, to)
  }
}

function doTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  if (skipped(el)) return
  doAttrs(el)
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeType === Node.ELEMENT_NODE && (n as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const seen = new Set<Element>()
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) doAttrs(n as Element)
    else {
      const p = n.parentElement
      if (p && textOnly(p)) {
        if (seen.has(p)) continue
        seen.add(p)
      }
      doText(n as Text)
    }
  }
}

function onMutate(list: MutationRecord[]) {
  for (const m of list) {
    if (m.type === 'characterData') doText(m.target as Text)
    else if (m.type === 'attributes') doAttrs(m.target as Element)
    else {
      for (const n of m.addedNodes) doTree(n)
      // A text node added or removed next to others changes the line they make together.
      if (m.target.nodeType === Node.ELEMENT_NODE && textOnly(m.target as Element)) doText((m.target as Element).firstChild as Text)
    }
  }
}

// Switch the page to this dictionary (null: back to the English as written).
export function applyDict(next: Compiled | null) {
  dict = next
  if (!observer && next) {
    observer = new MutationObserver(onMutate)
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS })
  }
  doTree(document.body)
  // Our own writes come back as mutations; they find nothing new to do.
  observer?.takeRecords()
  if (!next && observer) {
    observer.disconnect()
    observer = null
  }
}
