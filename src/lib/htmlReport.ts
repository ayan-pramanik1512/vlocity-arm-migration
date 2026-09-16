import {InventoryManifest, AnalysisResult} from './types.js'
import {buildExecutiveSummary, plainLanguageSeverity, Severity} from './executiveSummary.js'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#d97706',
  LOW: '#16a34a',
}

const SIZE_COLOR: Record<string, string> = {
  XS: '#16a34a',
  S: '#65a30d',
  M: '#d97706',
  L: '#ea580c',
  XL: '#dc2626',
}

// ── Donut chart (pure SVG, no client-side JS) ────────────────────────────────

function buildDonutChart(tierTotals: Record<Severity, number>): string {
  const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const total = order.reduce((s, t) => s + tierTotals[t], 0)
  const radius = 60
  const circumference = 2 * Math.PI * radius

  if (total === 0) {
    return `<svg viewBox="0 0 160 160" class="donut">
      <circle cx="80" cy="80" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="24" />
      <text x="80" y="85" text-anchor="middle" class="donut-center">0</text>
    </svg>`
  }

  let offset = 0
  const segments: string[] = []
  for (const tier of order) {
    const count = tierTotals[tier]
    if (count === 0) continue
    const fraction = count / total
    const dash = fraction * circumference
    segments.push(
      `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${SEVERITY_COLOR[tier]}" stroke-width="24" ` +
        `stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" ` +
        `stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 80 80)" />`,
    )
    offset += dash
  }

  return `<svg viewBox="0 0 160 160" class="donut">
    ${segments.join('\n    ')}
    <text x="80" y="76" text-anchor="middle" class="donut-center">${total}</text>
    <text x="80" y="94" text-anchor="middle" class="donut-sub">components</text>
  </svg>`
}

// ── Public entry point ────────────────────────────────────────────────────────

export function buildHtmlReport(manifest: InventoryManifest, analysis: AnalysisResult): string {
  const exec = buildExecutiveSummary(manifest, analysis)
  const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

  const statTiles = exec.stats
    .map(
      (s) => `<div class="tile">
        <div class="tile-value">${escapeHtml(s.value)}</div>
        <div class="tile-label">${escapeHtml(s.label)}</div>
      </div>`,
    )
    .join('\n')

  const legendRows = order
    .filter((t) => exec.tierTotals[t] > 0)
    .map(
      (t) => `<div class="legend-row">
        <span class="legend-dot" style="background:${SEVERITY_COLOR[t]}"></span>
        <span class="legend-label">${t}</span>
        <span class="legend-value">${exec.tierTotals[t]}</span>
      </div>`,
    )
    .join('\n')

  const maxDomainScore = Math.max(1, ...analysis.tshirt.domains.map((d) => d.domainScore))
  const domainBars = analysis.tshirt.domains
    .map((d) => {
      const widthPct = Math.max(2, (d.domainScore / maxDomainScore) * 100)
      const color = SIZE_COLOR[d.size] ?? '#6b7280'
      return `<div class="bar-row">
        <div class="bar-label">${escapeHtml(d.label)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${widthPct.toFixed(1)}%; background:${color}"></div>
        </div>
        <div class="bar-meta">${d.size} · ${escapeHtml(d.sprintRange)} · ${d.count} item(s)</div>
      </div>`
    })
    .join('\n')

  const findingCards = analysis.gapFindings
    .map(
      (f) => `<div class="finding" style="border-left-color:${SEVERITY_COLOR[f.severity]}">
        <div class="finding-header">
          <span class="badge" style="background:${SEVERITY_COLOR[f.severity]}">${f.severity}</span>
          <span class="finding-title">${escapeHtml(f.title)}</span>
        </div>
        <div class="finding-plain">${escapeHtml(plainLanguageSeverity(f.severity))}</div>
        <div class="finding-message">${escapeHtml(f.message)}</div>
        <div class="finding-remediation"><strong>Recommended action:</strong> ${escapeHtml(f.remediation)}</div>
      </div>`,
    )
    .join('\n')

  const domainTableRows = analysis.domains
    .filter((d) => d.count > 0)
    .map(
      (d) => `<tr>
        <td>${escapeHtml(d.label)}</td>
        <td>${d.count}</td>
        <td>${d.avgScore}</td>
        <td>${d.tierDistribution['LOW'] ?? 0}</td>
        <td>${d.tierDistribution['MEDIUM'] ?? 0}</td>
        <td>${d.tierDistribution['HIGH'] ?? 0}</td>
        <td>${d.tierDistribution['CRITICAL'] ?? 0}</td>
      </tr>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Revenue Cloud Migration Assessment — ${escapeHtml(manifest.org)}</title>
<style>
  :root {
    --ink: #111827;
    --muted: #6b7280;
    --border: #e5e7eb;
    --bg: #f9fafb;
    --card: #ffffff;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--ink);
    background: var(--bg);
    margin: 0;
    padding: 32px;
  }
  .container { max-width: 1000px; margin: 0 auto; }
  header { margin-bottom: 24px; }
  header h1 { font-size: 22px; margin: 0 0 4px; }
  header .meta { color: var(--muted); font-size: 13px; }
  section { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 24px; margin-bottom: 20px; }
  h2 { font-size: 16px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
  .headline { font-size: 18px; font-weight: 600; margin-bottom: 20px; }
  .size-badge { display: inline-block; font-size: 28px; font-weight: 700; padding: 4px 14px; border-radius: 8px; background: #111827; color: #fff; margin-right: 10px; }
  .sprint-range { color: var(--muted); font-size: 14px; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 20px; }
  .tile { border: 1px solid var(--border); border-radius: 8px; padding: 14px; text-align: center; }
  .tile-value { font-size: 24px; font-weight: 700; }
  .tile-label { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .donut-row { display: flex; align-items: center; gap: 32px; }
  .donut { width: 160px; height: 160px; flex-shrink: 0; }
  .donut-center { font-size: 26px; font-weight: 700; fill: var(--ink); }
  .donut-sub { font-size: 10px; fill: var(--muted); }
  .legend-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .legend-label { flex: 1; }
  .legend-value { font-weight: 600; }
  .bar-row { margin-bottom: 14px; }
  .bar-label { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .bar-track { background: var(--border); border-radius: 6px; height: 10px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 6px; }
  .bar-meta { font-size: 12px; color: var(--muted); margin-top: 4px; }
  .finding { border-left: 4px solid; padding: 12px 16px; margin-bottom: 12px; background: #fafafa; border-radius: 6px; }
  .finding-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .badge { color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
  .finding-title { font-weight: 600; }
  .finding-plain { font-size: 13px; color: var(--muted); margin-bottom: 4px; }
  .finding-message { font-size: 13px; margin-bottom: 4px; }
  .finding-remediation { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; }
  footer { color: var(--muted); font-size: 12px; text-align: center; margin-top: 24px; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>Revenue Cloud Migration Assessment</h1>
    <div class="meta">Org: ${escapeHtml(manifest.org)} &nbsp;·&nbsp; Org ID: ${escapeHtml(manifest.orgId)} &nbsp;·&nbsp; Run Date: ${escapeHtml(manifest.runDate)}</div>
  </header>

  <section>
    <h2>Executive Summary</h2>
    <div>
      <span class="size-badge">${exec.overallSize}</span>
      <span class="sprint-range">${escapeHtml(exec.sprintRange)} estimated</span>
    </div>
    <p class="headline">${escapeHtml(exec.headline)}</p>
    <div class="tiles">
      ${statTiles}
    </div>
  </section>

  <section>
    <h2>Complexity Distribution</h2>
    <div class="donut-row">
      ${buildDonutChart(exec.tierTotals)}
      <div style="flex:1">
        ${legendRows || '<div class="legend-row">No components scored.</div>'}
      </div>
    </div>
  </section>

  <section>
    <h2>Estimated Effort by Domain</h2>
    ${domainBars || '<p>No domains with scored components.</p>'}
  </section>

  <section>
    <h2>Migration Gap Findings</h2>
    ${findingCards || '<p>No gap findings triggered.</p>'}
  </section>

  <section>
    <h2>Domain Complexity Detail</h2>
    <table>
      <thead>
        <tr><th>Domain</th><th>Count</th><th>Avg Score</th><th>LOW</th><th>MEDIUM</th><th>HIGH</th><th>CRITICAL</th></tr>
      </thead>
      <tbody>
        ${domainTableRows || '<tr><td colspan="7">No data.</td></tr>'}
      </tbody>
    </table>
  </section>

  <footer>Generated by vlocity-inventory · see manifest.json and summary-report.txt for full detail</footer>
</div>
</body>
</html>
`
}
