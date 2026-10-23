// Usage : npm run build, puis node scripts/generer-pont-console.cjs <sortie.css>
// Regenere le pont console des neutres beiges (bloc en fin de globals.css).
// La sortie liste aussi, sur la console, les beiges apportes par @apply.
const fs = require('fs'), path = require('path')
const postcss = require(path.resolve('node_modules/postcss'))
const lire = d => fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? lire(p) : p.endsWith('.css') ? [fs.readFileSync(p, 'utf8')] : [] })
const css = lire('.next/static/chunks').join('\n')
const MAP = { 50: '--surface-sunken', 100: '--line', 200: '--card-border', 300: '--line-strong', 400: '--brand-icon',
              500: '--brand-muted', 600: '--brand-label', 700: '--ink-muted', 800: '--console-etat-neutre-encre', 900: '--ink' }
const PREFIXE = ':root[data-espace="console"] '
const vus = new Map()
postcss.parse(css).walkRules(rule => {
  if (!rule.selector.includes('warm-')) return
  for (const sel of rule.selectors) {
    if (!sel.includes('warm-') || sel.startsWith(':root')) continue
    const m = sel.match(new RegExp('warm-(\\d+)(?:\\\\/(\\d+))?'))
    if (!m || !MAP[m[1]]) continue
    const base = `var(${MAP[m[1]]})`
    const val = m[2] ? `color-mix(in srgb, ${base} ${m[2]}%, transparent)` : base
    const decls = []
    rule.walkDecls(d => {
      if (/^--tw-.*opacity$/.test(d.prop)) return
      if (!/rgb|#/.test(d.value)) return
      decls.push(`${d.prop}: ${val}`)
    })
    if (!decls.length) continue
    const media = rule.parent.type === 'atrule' ? `@${rule.parent.name} ${rule.parent.params}` : ''
    const ligne = `${PREFIXE}${sel} { ${decls.join('; ')}; }`
    vus.set(media + '|' + ligne, { media, ligne })
  }
})
// Beiges apportes par @apply dans des classes de composant : reperes a leur valeur.
const RGB = { '250 248 246': 50, '240 236 232': 100, '224 217 209': 200, '208 198 186': 300, '192 179 163': 400,
              '182 167 152': 500, '154 142 129': 600, '120 109 100': 700, '86 78 71': 800, '51 46 42': 900 }
const reRgb = /rgb\((\d+ \d+ \d+)\s*(?:\/\s*([^)]+))?\)/
const parApply = []
postcss.parse(css).walkRules(rule => {
  if (rule.selector.includes('warm-') || rule.selector.startsWith(':root') || rule.selector.includes('data-theme')) return
  const decls = []
  rule.walkDecls(d => {
    const m = d.value.match(reRgb)
    if (!m || !RGB[m[1]]) return
    const base = `var(${MAP[RGB[m[1]]]})`
    const alpha = m[2] && !m[2].includes('var(') ? m[2].trim() : null
    const pct = alpha ? (alpha.endsWith('%') ? alpha : `${Math.round(parseFloat(alpha) * 100)}%`) : null
    decls.push(`${d.prop}: ${pct ? `color-mix(in srgb, ${base} ${pct}, transparent)` : base}`)
  })
  if (!decls.length) return
  const media = rule.parent.type === 'atrule' ? `@${rule.parent.name} ${rule.parent.params}` : ''
  const ligne = `${rule.selectors.map(s => PREFIXE + s).join(', ')} { ${decls.join('; ')}; }`
  parApply.push(media ? `${media} { ${ligne} }` : ligne)
})
console.log('--- par valeur (@apply) ---\n' + parApply.join('\n'))
const sans = [...vus.values()].filter(v => !v.media).map(v => v.ligne).sort()
const avec = [...vus.values()].filter(v => v.media)
let out = sans.join('\n') + '\n'
for (const v of avec) out += `${v.media} { ${v.ligne} }\n`
fs.writeFileSync(process.argv[2], out)
console.log(sans.length, 'regles,', avec.length, 'sous @media')
