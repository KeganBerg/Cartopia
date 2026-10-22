// Lists every piece of English the player can read in src (JSX text, title, aria-label and
// placeholder attributes, and string or template literals that read as words), for the
// Spanish and Portuguese dictionaries in src/i18n. `{}` stands for anything filled in.
//   node scripts/i18n/extract.mjs            writes scripts/i18n/strings.json
//   node scripts/i18n/extract.mjs --missing  lists strings neither dictionary has yet
import ts from 'typescript'
import fs from 'fs'
import { execSync } from 'child_process'

const root = new URL('../../', import.meta.url).pathname
const files = execSync('git ls-files "src/**/*.tsx" "src/**/*.ts"', { cwd: root }).toString().trim().split('\n')
  .filter((f) => !/\.test\.|^src\/i18n\//.test(f))
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt']
const SKIP_ATTRS = ['className', 'key', 'id', 'href', 'src', 'type', 'role', 'd', 'fill', 'stroke', 'viewBox', 'name', 'rel', 'target', 'lang', 'mode', 'kind', 'variant', 'tab', 'icon', 'cam', 'game', 'panel']
// Reads as words: two letters in a row, and a capital or a space between words.
const wordy = (s) => /[A-Za-z]{2}/.test(s) && (/[a-z]{2,} [a-z]/i.test(s) || /^[^a-z]*[A-Z][a-z]/.test(s) || /^[^A-Za-z]*[A-Z]{2,}( [A-Z]{2,})*[!?]?$/.test(s.trim()))
// Not prose: SVG paths, CSS, class lists, colours, ids, urls, code.
const codey = (s) => /^[MmLlHhVvQqCcSsAaZz0-9 .,-]+$/.test(s) || /var\(|px\b|rgba?\(|#[0-9a-f]{3,8}\b|https?:|\.(ts|tsx|png|jpg|svg|mp3|json)\b|=>|;|\{(?!\})|(?<!\{)\}|^[a-z0-9]+(-[a-z0-9]+)+( [a-z0-9-]+)*$|^[a-z]+[A-Z]\w*$|^(Key|Arrow|Shift|Control|Digit)\w+$/.test(s) || /^[\w-]+:[\w-]+$/.test(s)

export function extract() {
  const out = new Map()
  const add = (s, f) => {
    s = s.replace(/\s+/g, ' ').trim()
    if (s.length < 2 || s.length > 400 || !wordy(s) || codey(s)) return
    if (!out.has(s)) out.set(s, f)
  }
  for (const f of files) {
    const src = ts.createSourceFile(f, fs.readFileSync(root + f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const walk = (n) => {
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return
      if (ts.isJsxText(n)) add(n.text, f)
      else if (ts.isJsxElement(n) && n.children.some((k) => ts.isJsxText(k) && k.text.trim()) && n.children.some((k) => ts.isJsxExpression(k) && k.expression)) {
        // <b>Win {n} races</b> reaches the page as one line of text nodes (see src/i18n/dom.ts).
        if (n.children.every((k) => ts.isJsxText(k) || (ts.isJsxExpression(k) && (!k.expression || !/^\s*</.test(k.expression.getText())))))
          add(n.children.map((k) => (ts.isJsxText(k) ? k.text : k.expression ? '{}' : '')).join(''), f)
      }
      else if (ts.isJsxAttribute(n) && SKIP_ATTRS.includes(n.name.getText())) return
      else if (ts.isJsxAttribute(n) && ATTRS.includes(n.name.getText()) && n.initializer && ts.isStringLiteral(n.initializer)) add(n.initializer.text, f)
      else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        // Keys and comparisons aren't shown: obj['x'], a === 'x', case 'x':
        const p = n.parent
        if (ts.isElementAccessExpression(p) || ts.isCaseClause(p) || (ts.isBinaryExpression(p) && /=/.test(p.operatorToken.getText())) || ts.isPropertyAssignment(p) && p.name === n) return
        add(n.text, f)
      } else if (ts.isTemplateExpression(n)) {
        add([n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join('{}'), f)
      }
      ts.forEachChild(n, walk)
    }
    walk(src)
  }
  return out
}

const all = extract()
if (process.argv.includes('--missing')) {
  const es = JSON.parse(fs.readFileSync(root + 'src/i18n/es.json', 'utf8'))
  const pt = JSON.parse(fs.readFileSync(root + 'src/i18n/pt.json', 'utf8'))
  const miss = [...all].filter(([s]) => !(s in es) || !(s in pt))
  for (const [s, f] of miss) console.log(`${f}\t${s}`)
  console.error(`${miss.length} of ${all.size} not translated yet`)
} else {
  fs.writeFileSync(root + 'scripts/i18n/strings.json', JSON.stringify(Object.fromEntries([...all].sort((a, b) => a[1].localeCompare(b[1]))), null, 1) + '\n')
  console.log(all.size, 'strings')
}
