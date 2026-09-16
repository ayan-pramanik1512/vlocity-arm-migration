import {InventoryManifest, OmniStudioItem, AnalysisResult} from './types.js'
import {buildExecutiveSummary, plainLanguageSeverity} from './executiveSummary.js'

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length)
}

function row(cols: string[], widths: number[]): string {
  return '| ' + cols.map((c, i) => pad(c, widths[i])).join(' | ') + ' |'
}

function divider(widths: number[]): string {
  return '+-' + widths.map((w) => '-'.repeat(w)).join('-+-') + '-+'
}

export function buildReport(manifest: InventoryManifest, analysis?: AnalysisResult): string {
  const lines: string[] = []

  lines.push('='.repeat(72))
  lines.push('  VLOCITY CMT INVENTORY REPORT')
  lines.push('='.repeat(72))
  lines.push(`  Org         : ${manifest.org}`)
  lines.push(`  Org ID      : ${manifest.orgId}`)
  lines.push(`  Run Date    : ${manifest.runDate}`)
  lines.push('')

  if (analysis) {
    // ── EXECUTIVE SUMMARY ────────────────────────────────────────────────────
    const exec = buildExecutiveSummary(manifest, analysis)
    lines.push('── EXECUTIVE SUMMARY ────────────────────────────────────────────────')
    lines.push(`  Overall Migration Size : ${exec.overallSize}  (${exec.sprintRange})`)
    lines.push('')
    lines.push(`  ${exec.headline}`)
    lines.push('')
    for (const stat of exec.stats) {
      lines.push(`  ${stat.label.padEnd(32)}: ${stat.value}`)
    }
    lines.push('')

    if (exec.topFindings.length > 0) {
      lines.push('  Top items to raise with stakeholders:')
      for (const finding of exec.topFindings) {
        lines.push(`    - [${finding.severity}] ${finding.title}`)
        lines.push(`      ${plainLanguageSeverity(finding.severity)}`)
      }
      lines.push('')
    }
  }

  // ── CATALOG ──────────────────────────────────────────────────────────────
  lines.push('── CATALOG ──────────────────────────────────────────────────────────')
  lines.push(`  Total Catalogs  : ${manifest.catalog.total}`)
  lines.push(`  Active          : ${manifest.catalog.active}`)
  lines.push(`  Inactive        : ${manifest.catalog.inactive}`)
  lines.push('')

  if (manifest.catalog.items.length > 0) {
    const widths = [36, 10, 8, 10]
    lines.push(divider(widths))
    lines.push(row(['Name', 'Code', 'Status', 'Products'], widths))
    lines.push(divider(widths))
    for (const item of manifest.catalog.items.slice(0, 20)) {
      lines.push(row([item.name, item.code, item.status, String(item.productCount)], widths))
    }
    if (manifest.catalog.items.length > 20) {
      lines.push(`  ... and ${manifest.catalog.items.length - 20} more (see manifest.json)`)
    }
    lines.push(divider(widths))
  }
  lines.push('')

  // ── PRODUCTS ─────────────────────────────────────────────────────────────
  lines.push('── PRODUCTS ─────────────────────────────────────────────────────────')
  lines.push(`  Total Products  : ${manifest.products.total}`)
  lines.push(`  Active          : ${manifest.products.active}`)
  lines.push(`  Inactive        : ${manifest.products.inactive}`)
  lines.push('')

  if (manifest.products.items.length > 0) {
    const widths = [36, 16, 14, 8]
    lines.push(divider(widths))
    lines.push(row(['Name', 'Product Code', 'Type', 'Active'], widths))
    lines.push(divider(widths))
    for (const item of manifest.products.items.slice(0, 30)) {
      lines.push(row([item.name, item.code, item.productType, item.isActive ? 'Yes' : 'No'], widths))
    }
    if (manifest.products.items.length > 30) {
      lines.push(`  ... and ${manifest.products.items.length - 30} more (see manifest.json)`)
    }
    lines.push(divider(widths))
  }
  lines.push('')

  // ── ATTRIBUTES ───────────────────────────────────────────────────────────
  lines.push('── ATTRIBUTES ───────────────────────────────────────────────────────')
  lines.push(`  Total Attribute Categories : ${manifest.attributes.totalCategories}`)
  lines.push(`  Total Attributes           : ${manifest.attributes.totalAttributes}`)
  lines.push('')

  if (manifest.attributes.categories.length > 0) {
    lines.push('  Attribute Categories:')
    const catWidths = [36, 16, 10]
    lines.push(divider(catWidths))
    lines.push(row(['Category Name', 'Code', 'Attributes'], catWidths))
    lines.push(divider(catWidths))
    for (const cat of manifest.attributes.categories) {
      lines.push(row([cat.name, cat.code, String(cat.attributeCount)], catWidths))
    }
    lines.push(divider(catWidths))
    lines.push('')
  }

  if (manifest.attributes.attributes.length > 0) {
    lines.push('  Attributes:')
    const attrWidths = [30, 16, 26]
    lines.push(divider(attrWidths))
    lines.push(row(['Attribute Name', 'Code', 'Category'], attrWidths))
    lines.push(divider(attrWidths))
    for (const attr of manifest.attributes.attributes.slice(0, 30)) {
      lines.push(row([attr.name, attr.code, attr.categoryName], attrWidths))
    }
    if (manifest.attributes.attributes.length > 30) {
      lines.push(`  ... and ${manifest.attributes.attributes.length - 30} more (see manifest.json)`)
    }
    lines.push(divider(attrWidths))
  }
  lines.push('')

  // ── PRICING ───────────────────────────────────────────────────────────────
  lines.push('── PRICING ──────────────────────────────────────────────────────────')
  lines.push(`  Total Pricing Plans : ${manifest.pricing.totalPlans}`)
  lines.push(`  Orphaned Plans      : ${manifest.pricing.orphanedPlans}`)
  lines.push(`  Total Price Lists   : ${manifest.pricing.totalPriceLists}`)
  lines.push(`  Active Price Lists  : ${manifest.pricing.activePriceLists}`)
  lines.push('')

  if (manifest.pricing.orphanedPlans > 0) {
    lines.push('  [!] Orphaned plans (no linked products):')
    const orphans = manifest.pricing.plans.filter((p) => p.orphaned).slice(0, 10)
    for (const p of orphans) {
      lines.push(`      - ${p.name} (${p.code}) [${p.status}]`)
    }
    if (manifest.pricing.orphanedPlans > 10) {
      lines.push(`      ... and ${manifest.pricing.orphanedPlans - 10} more`)
    }
  }
  lines.push('')

  // ── APEX ──────────────────────────────────────────────────────────────────
  lines.push('── CUSTOM APEX / VLOCITY REFERENCES ─────────────────────────────────')
  lines.push(`  Custom Apex Classes  : ${manifest.apex.totalCustomClasses}`)
  lines.push(`  Test Classes         : ${manifest.apex.totalTestClasses}`)
  lines.push(`  Non-Test Classes     : ${manifest.apex.totalCustomClasses - manifest.apex.totalTestClasses}`)
  lines.push(`  Custom Apex Triggers : ${manifest.apex.totalCustomTriggers}`)
  lines.push(`  With vlocity_cmt refs: ${manifest.apex.withVlocityRefs}`)
  lines.push('')

  const apexClasses = manifest.apex.items.filter((i) => i.type === 'ApexClass' && !i.isTestClass)
  const testClasses = manifest.apex.items.filter((i) => i.type === 'ApexClass' && i.isTestClass)
  const apexTriggers = manifest.apex.items.filter((i) => i.type === 'ApexTrigger')
  const widths = [34, 24, 8, 20]

  function apexTable(items: typeof apexClasses): void {
    lines.push(divider(widths))
    lines.push(row(['Name', 'Category', 'Refs', 'Ref Types'], widths))
    lines.push(divider(widths))
    const CATEGORIES = ['HookImplementation', 'VlocityDefaultCustomization', 'General'] as const
    for (const cat of CATEGORIES) {
      const group = items.filter((i) => i.category === cat)
      if (group.length === 0) continue
      lines.push(row([`-- ${cat} (${group.length}) --`, '', '', ''], widths))
      for (const item of group) {
        lines.push(row([item.name, item.category, String(item.refCount), item.refTypes.join(', ')], widths))
      }
    }
    lines.push(divider(widths))
    lines.push('')
  }

  if (apexClasses.length > 0) {
    lines.push('  Apex Classes with vlocity_cmt refs:')
    apexTable(apexClasses)
  }

  if (testClasses.length > 0) {
    lines.push('  Test Classes with vlocity_cmt refs:')
    apexTable(testClasses)
  }

  if (apexTriggers.length > 0) {
    lines.push('  Apex Triggers with vlocity_cmt refs:')
    const trigWidths = [36, 8, 22]
    lines.push(divider(trigWidths))
    lines.push(row(['Name', 'Refs', 'Ref Types'], trigWidths))
    lines.push(divider(trigWidths))
    for (const item of apexTriggers) {
      lines.push(row([item.name, String(item.refCount), item.refTypes.join(', ')], trigWidths))
    }
    lines.push(divider(trigWidths))
    lines.push('')
  }

  if (manifest.apex.items.length === 0) lines.push('')

  // ── FLOWS ─────────────────────────────────────────────────────────────────
  lines.push('── FLOWS WITH VLOCITY CMT REFERENCES ────────────────────────────────')
  lines.push(`  Total Flows Scanned  : ${manifest.flows.totalScanned}`)
  lines.push(`  With vlocity_cmt refs: ${manifest.flows.withVlocityRefs}`)
  lines.push('')

  if (manifest.flows.items.length > 0) {
    const flowWidths = [34, 20, 10, 8, 20]
    lines.push(divider(flowWidths))
    lines.push(row(['API Name', 'Process Type', 'Status', 'Refs', 'Ref Types'], flowWidths))
    lines.push(divider(flowWidths))
    for (const f of manifest.flows.items) {
      lines.push(row([f.apiName, f.processType, f.status, String(f.vlocityRefCount), f.refTypes.join(', ')], flowWidths))
    }
    if (manifest.flows.items.length > 0) lines.push(divider(flowWidths))
  }
  lines.push('')

  // ── VALIDATION RULES ──────────────────────────────────────────────────────
  lines.push('── VALIDATION RULES WITH VLOCITY CMT REFERENCES ─────────────────────')
  lines.push(`  Total with vlocity_cmt refs : ${manifest.validationRules.total}`)
  lines.push(`  Active                      : ${manifest.validationRules.active}`)
  lines.push(`  Inactive                    : ${manifest.validationRules.total - manifest.validationRules.active}`)
  lines.push('')

  if (manifest.validationRules.items.length > 0) {
    const vrWidths = [30, 28, 8]
    lines.push(divider(vrWidths))
    lines.push(row(['Rule Name', 'Object', 'Active'], vrWidths))
    lines.push(divider(vrWidths))
    // group by object for readability
    const byObject = new Map<string, typeof manifest.validationRules.items>()
    for (const vr of manifest.validationRules.items) {
      const group = byObject.get(vr.objectName) ?? []
      group.push(vr)
      byObject.set(vr.objectName, group)
    }
    for (const [obj, rules] of [...byObject.entries()].sort()) {
      lines.push(row([`-- ${obj} (${rules.length}) --`, '', ''], vrWidths))
      for (const vr of rules) {
        lines.push(row([vr.name, vr.objectName, vr.active ? 'Yes' : 'No'], vrWidths))
      }
    }
    lines.push(divider(vrWidths))
  }
  lines.push('')

  // ── OMNISTUDIO ────────────────────────────────────────────────────────────────
  lines.push('── OMNISTUDIO COMPONENTS ────────────────────────────────────────────')
  lines.push(`  OmniScripts            : ${manifest.omniStudio.totalOmniScripts}`)
  lines.push(`  DataRaptors            : ${manifest.omniStudio.totalDataRaptors}`)
  lines.push(`  Integration Procedures : ${manifest.omniStudio.totalIntegrationProcedures}`)
  lines.push(`  FlexCards              : ${manifest.omniStudio.totalFlexCards}`)
  lines.push(`  DocuSign Templates     : ${manifest.omniStudio.totalDocuSignTemplates}`)
  lines.push('')

  function omniTable(items: OmniStudioItem[], label: string): void {
    if (items.length === 0) return
    lines.push(`  ${label}:`)
    const w = [36, 28, 8, 8]
    lines.push(divider(w))
    lines.push(row(['Name', 'Type/SubType', 'Active', 'Ver'], w))
    lines.push(divider(w))
    for (const item of items.slice(0, 20)) {
      lines.push(row([item.name, item.subType, item.isActive ? 'Yes' : 'No', String(item.version)], w))
    }
    if (items.length > 20) lines.push(`  ... and ${items.length - 20} more (see manifest.json)`)
    lines.push(divider(w))
    lines.push('')
  }

  omniTable(manifest.omniStudio.omniScripts, 'OmniScripts')
  omniTable(manifest.omniStudio.dataRaptors, 'DataRaptors')
  omniTable(manifest.omniStudio.integrationProcedures, 'Integration Procedures')
  omniTable(manifest.omniStudio.flexCards, 'FlexCards')
  omniTable(manifest.omniStudio.docuSignTemplates, 'DocuSign Templates')

  // ── USAGE SIGNALS ─────────────────────────────────────────────────────────────
  lines.push('── USAGE SIGNALS ────────────────────────────────────────────────────')
  lines.push(`  Total Usage Signals : ${manifest.usageSignals.total}`)
  lines.push(`  Active              : ${manifest.usageSignals.active}`)

  if (Object.keys(manifest.usageSignals.byType).length > 0) {
    lines.push('  By Type:')
    for (const [type, count] of Object.entries(manifest.usageSignals.byType).sort()) {
      lines.push(`    ${type.padEnd(32)}: ${count}`)
    }
  }
  lines.push('')

  if (manifest.usageSignals.items.length > 0) {
    const usW = [30, 20, 10, 8]
    lines.push(divider(usW))
    lines.push(row(['Name', 'Signal Code', 'Type', 'Active'], usW))
    lines.push(divider(usW))
    for (const s of manifest.usageSignals.items.slice(0, 30)) {
      lines.push(row([s.name, s.signalCode, s.signalType, s.isActive ? 'Yes' : 'No'], usW))
    }
    if (manifest.usageSignals.items.length > 30) {
      lines.push(`  ... and ${manifest.usageSignals.items.length - 30} more (see manifest.json)`)
    }
    lines.push(divider(usW))
  }
  lines.push('')

  // ── RISK SUMMARY ──────────────────────────────────────────────────────────
  lines.push('── MIGRATION RISK FLAGS ─────────────────────────────────────────────')
  const risks: string[] = []
  if (manifest.pricing.orphanedPlans > 0)
    risks.push(`${manifest.pricing.orphanedPlans} orphaned pricing plan(s) — review before migration`)
  if (manifest.catalog.inactive > 0)
    risks.push(`${manifest.catalog.inactive} inactive catalog(s) — confirm whether to migrate`)
  if (manifest.apex.withVlocityRefs > 0)
    risks.push(`${manifest.apex.withVlocityRefs} custom Apex file(s) reference vlocity_cmt — requires namespace update`)
  const extendsRefs = manifest.apex.items.filter((i) => i.refTypes.includes('extends'))
  if (extendsRefs.length > 0)
    risks.push(`${extendsRefs.length} class(es) EXTEND vlocity_cmt types — high migration complexity`)
  const implRefs = manifest.apex.items.filter((i) => i.refTypes.includes('implements'))
  if (implRefs.length > 0)
    risks.push(`${implRefs.length} class(es) IMPLEMENT vlocity_cmt interfaces — review interface contracts`)
  if (manifest.flows.withVlocityRefs > 0)
    risks.push(`${manifest.flows.withVlocityRefs} flow(s) reference vlocity_cmt — update field/object API names post-migration`)
  if (manifest.validationRules.total > 0)
    risks.push(`${manifest.validationRules.total} validation rule(s) reference vlocity_cmt — formulas must be updated post-migration`)

  if (risks.length === 0) {
    lines.push('  No risk flags detected.')
  } else {
    for (const risk of risks) {
      lines.push(`  [!] ${risk}`)
    }
  }
  lines.push('')

  if (analysis) {
    // ── COMPLEXITY ANALYSIS ─────────────────────────────────────────────────
    lines.push('── COMPLEXITY ANALYSIS ──────────────────────────────────────────────')
    lines.push('  Score = categoryWeight + max(refTypeWeight) + refCountBand  (config-driven)')
    lines.push('')

    const domainWidths = [24, 8, 8, 10, 10, 10, 10]
    lines.push(divider(domainWidths))
    lines.push(row(['Domain', 'Count', 'Avg', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], domainWidths))
    lines.push(divider(domainWidths))
    for (const d of analysis.domains) {
      if (d.count === 0) continue
      lines.push(row([
        d.label,
        String(d.count),
        String(d.avgScore),
        String(d.tierDistribution['LOW'] ?? 0),
        String(d.tierDistribution['MEDIUM'] ?? 0),
        String(d.tierDistribution['HIGH'] ?? 0),
        String(d.tierDistribution['CRITICAL'] ?? 0),
      ], domainWidths))
    }
    lines.push(divider(domainWidths))
    lines.push('')

    lines.push('  Top complexity hotspots (highest score first):')
    const hotWidths = [38, 22, 8, 10]
    lines.push(divider(hotWidths))
    lines.push(row(['Name', 'Type', 'Score', 'Tier'], hotWidths))
    lines.push(divider(hotWidths))
    const allItems = analysis.domains.flatMap((d) => d.topItems)
    const topGlobal = [...allItems].sort((a, b) => b.score - a.score).slice(0, 20)
    for (const item of topGlobal) {
      lines.push(row([item.name, item.componentType, String(item.score), item.tier], hotWidths))
    }
    lines.push(divider(hotWidths))
    lines.push('')

    // ── GAP ANALYSIS ────────────────────────────────────────────────────────
    lines.push('── GAP ANALYSIS ─────────────────────────────────────────────────────')
    lines.push('  Rules evaluated against derived metrics from manifest (config-driven)')
    lines.push('')

    if (analysis.gapFindings.length === 0) {
      lines.push('  No gap findings triggered.')
    } else {
      const SEVERITY_PREFIX: Record<string, string> = {
        CRITICAL: '[!!]',
        HIGH:     '[! ]',
        MEDIUM:   '[~~ ]',
        LOW:      '[i  ]',
      }
      for (const finding of analysis.gapFindings) {
        const prefix = SEVERITY_PREFIX[finding.severity] ?? '[?]'
        lines.push(`  ${prefix} ${finding.severity.padEnd(8)}  ${finding.title}`)
        lines.push(`            ${finding.message}`)
        lines.push(`            Remediation: ${finding.remediation}`)
        lines.push('')
      }
    }

    // ── T-SHIRT SIZING ──────────────────────────────────────────────────────
    lines.push('── T-SHIRT SIZING ───────────────────────────────────────────────────')
    lines.push('  domainScore = avgComplexityScore × countBandMultiplier  (config-driven)')
    lines.push('')

    const tsWidths = [24, 8, 8, 12, 6, 16]
    lines.push(divider(tsWidths))
    lines.push(row(['Domain', 'Count', 'AvgScore', 'DomainScore', 'Size', 'Est. Sprints'], tsWidths))
    lines.push(divider(tsWidths))
    for (const d of analysis.tshirt.domains) {
      lines.push(row([
        d.label,
        String(d.count),
        String(d.avgScore),
        String(d.domainScore),
        d.size,
        d.sprintRange,
      ], tsWidths))
    }
    lines.push(divider(tsWidths))
    lines.push(row([
      'OVERALL',
      '',
      '',
      String(analysis.tshirt.overall.totalScore),
      analysis.tshirt.overall.size,
      analysis.tshirt.overall.sprintRange,
    ], tsWidths))
    lines.push(divider(tsWidths))
    lines.push('')
  }

  lines.push('='.repeat(72))

  return lines.join('\n')
}
