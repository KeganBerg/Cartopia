// Finds on-screen copy in TSX source for the UI rules check (docs/ui-rules.md):
// JSX text and string or template literals that end up as JSX children. Tooltips
// (title), screen-reader labels (aria-*) and alt text are skipped, since players
// only see those on hover or never.
import ts from 'typescript'

export type Copy = { line: number; text: string; words: number }

const HIDDEN_ATTRS = new Set(['title', 'alt', 'aria-label', 'aria-description', 'placeholder', 'className', 'style', 'key', 'id', 'href', 'src', 'role'])

// Words a player reads: placeholders like ${x} count as one word each.
export function wordCount(text: string) {
  return text.replace(/\$\{[^}]*\}/g, ' X ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

export function visibleCopy(source: string, file = 'x.tsx'): Copy[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: Copy[] = []
  const add = (node: ts.Node, text: string) => {
    const t = text.replace(/\s+/g, ' ').trim()
    if (!t) return
    out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: t, words: wordCount(t) })
  }
  // Is this literal shown as a JSX child (possibly through ?:, && or ||)?
  const shownInJsx = (node: ts.Node): boolean => {
    let n = node.parent
    while (n) {
      if (ts.isJsxExpression(n)) return !!n.parent && !ts.isJsxAttribute(n.parent)
      if (ts.isConditionalExpression(n) || ts.isBinaryExpression(n) || ts.isParenthesizedExpression(n)) { n = n.parent; continue }
      return false
    }
    return false
  }
  const inHiddenAttr = (node: ts.Node) => {
    for (let n = node.parent; n; n = n.parent) {
      if (ts.isJsxAttribute(n)) return HIDDEN_ATTRS.has(n.name.getText(sf))
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) return false
    }
    return false
  }
  // A JSX element's own text, with {expressions} counted as one word each.
  const ownText = (el: ts.JsxElement) => el.children.map((c) => ts.isJsxText(c) ? c.text : ts.isJsxExpression(c) && c.expression ? ' X ' : '').join('')
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && node.children.some((c) => ts.isJsxText(c) && c.text.trim())) add(node, ownText(node))
    else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && shownInJsx(node) && !inHiddenAttr(node)) add(node, node.text)
    else if (ts.isTemplateExpression(node) && shownInJsx(node) && !inHiddenAttr(node)) add(node, node.getText(sf).slice(1, -1))
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}
