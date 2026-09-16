import * as fs from 'node:fs'
import {InventoryManifest, ApexVlocityRef, FlowItem, OmniStudioItem, AnalysisResult, ComponentScore, DomainAnalysis, GapFinding, TshirtDomainResult} from './types.js'
import {MigrationRulesConfig, Band, ComplexityTier, CountBand, TshirtSizeConfig} from './migration-rules.js'

// ── Config loading ────────────────────────────────────────────────────────────

export function loadRulesConfig(configPath?: string): MigrationRulesConfig {
  const candidates = [
    configPath,
    './migration-rules.config.json',
  ].filter(Boolean) as string[]

  for (const p of candidates) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')) as MigrationRulesConfig
    } catch {
      // try next
    }
  }
  return DEFAULT_CONFIG
}

// ── Band lookup helpers ───────────────────────────────────────────────────────

function bandWeight(bands: Band[], value: number): number {
  for (const b of bands) {
    if (value >= b.min && (b.max === null || value <= b.max)) return b.weight
  }
  return 0
}

function bandMultiplier(bands: CountBand[], value: number): number {
  for (const b of bands) {
    if (value >= b.min && (b.max === null || value <= b.max)) return b.multiplier
  }
  return 1
}

function resolveSize(sizes: TshirtSizeConfig[], score: number): TshirtSizeConfig {
  const sorted = [...sizes].sort((a, b) => b.min - a.min)
  for (const s of sorted) {
    if (score >= s.min) return s
  }
  return sizes[0]
}

function resolveTier(tiers: ComplexityTier[], score: number): string {
  const sorted = [...tiers].sort((a, b) => b.min - a.min)
  for (const t of sorted) {
    if (score >= t.min) return t.label
  }
  return tiers[0].label
}

// ── Per-item scorers ──────────────────────────────────────────────────────────

function scoreApexItem(item: ApexVlocityRef, cfg: MigrationRulesConfig): number {
  const ac = cfg.complexity.apex
  const catWeight = ac.categoryWeights[item.category] ?? 0
  const refTypeWeight = item.refTypes.reduce((max, r) => Math.max(max, ac.refTypeWeights[r] ?? 0), 0)
  const refCountWeight = bandWeight(ac.refCountBands, item.refCount)
  return catWeight + refTypeWeight + refCountWeight
}

function scoreFlowItem(item: FlowItem, cfg: MigrationRulesConfig): number {
  const fc = cfg.complexity.flows
  const ptWeight = fc.processTypeWeights[item.processType] ?? (fc.processTypeWeights['default'] ?? 1)
  const refCountWeight = bandWeight(fc.refCountBands, item.vlocityRefCount)
  return ptWeight + refCountWeight
}

function scoreOmniItem(item: OmniStudioItem, cfg: MigrationRulesConfig): number {
  const oc = cfg.complexity.omniStudio
  const ctWeight = oc.componentTypeWeights[item.componentType] ?? 1
  const verWeight = bandWeight(oc.versionBands, item.version)
  return ctWeight + verWeight
}

function avg(scores: number[]): number {
  if (scores.length === 0) return 0
  return parseFloat((scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(2))
}

// ── Domain builders ───────────────────────────────────────────────────────────

function buildDomain(
  id: string,
  label: string,
  items: ComponentScore[],
  cfg: MigrationRulesConfig,
  topN = 20,
): DomainAnalysis {
  const tierDist: Record<string, number> = {}
  for (const tier of cfg.complexity.tiers) tierDist[tier.label] = 0
  for (const item of items) tierDist[item.tier] = (tierDist[item.tier] ?? 0) + 1

  const topItems = [...items].sort((a, b) => b.score - a.score).slice(0, topN)

  return {
    id,
    label,
    count: items.length,
    avgScore: avg(items.map((i) => i.score)),
    tierDistribution: tierDist,
    topItems,
  }
}

// ── Derived metrics ───────────────────────────────────────────────────────────

function computeMetrics(
  manifest: InventoryManifest,
  domains: DomainAnalysis[],
): Record<string, number> {
  const domainAvg = (id: string) => domains.find((d) => d.id === id)?.avgScore ?? 0

  return {
    'catalog.total': manifest.catalog.total,
    'catalog.active': manifest.catalog.active,
    'catalog.inactive': manifest.catalog.inactive,
    'products.total': manifest.products.total,
    'products.active': manifest.products.active,
    'products.inactive': manifest.products.inactive,
    'pricing.totalPlans': manifest.pricing.totalPlans,
    'pricing.orphanedPlans': manifest.pricing.orphanedPlans,
    'apex.totalCustomClasses': manifest.apex.totalCustomClasses,
    'apex.totalTestClasses': manifest.apex.totalTestClasses,
    'apex.withVlocityRefs': manifest.apex.withVlocityRefs,
    'apex.hookCount': manifest.apex.items.filter((i) => i.category === 'HookImplementation').length,
    'apex.customizationCount': manifest.apex.items.filter((i) => i.category === 'VlocityDefaultCustomization').length,
    'apex.extendsCount': manifest.apex.items.filter((i) => i.refTypes.includes('extends')).length,
    'apex.implementsCount': manifest.apex.items.filter((i) => i.refTypes.includes('implements')).length,
    'apex.nonTestWithVlocityRefs': manifest.apex.items.filter((i) => i.type === 'ApexClass' && !i.isTestClass).length,
    'apex.testWithVlocityRefs': manifest.apex.items.filter((i) => i.type === 'ApexClass' && i.isTestClass).length,
    'flows.totalScanned': manifest.flows.totalScanned,
    'flows.withVlocityRefs': manifest.flows.withVlocityRefs,
    'omniStudio.totalOmniScripts': manifest.omniStudio.totalOmniScripts,
    'omniStudio.totalDataRaptors': manifest.omniStudio.totalDataRaptors,
    'omniStudio.totalIntegrationProcedures': manifest.omniStudio.totalIntegrationProcedures,
    'omniStudio.totalFlexCards': manifest.omniStudio.totalFlexCards,
    'omniStudio.totalDocuSignTemplates': manifest.omniStudio.totalDocuSignTemplates,
    'apex.avgProductionScore': domainAvg('apex-production'),
    'apex.avgTestScore': domainAvg('apex-test'),
    'flows.avgScore': domainAvg('flows'),
    'omniStudio.avgOmniScriptScore': domainAvg('omniscripts'),
    'omniStudio.avgDataRaptorScore': domainAvg('dataraptors'),
    'omniStudio.avgFlexCardScore': domainAvg('flexcards'),
  }
}

// ── Gap analysis ──────────────────────────────────────────────────────────────

function evalCondition(metric: number, op: string, value: number): boolean {
  switch (op) {
    case 'gt':  return metric > value
    case 'gte': return metric >= value
    case 'lt':  return metric < value
    case 'lte': return metric <= value
    case 'eq':  return metric === value
    case 'neq': return metric !== value
    default:    return false
  }
}

function interpolate(template: string, metrics: Record<string, number>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => String(metrics[key] ?? '?'))
}

function runGapAnalysis(metrics: Record<string, number>, cfg: MigrationRulesConfig): GapFinding[] {
  const findings: GapFinding[] = []
  for (const rule of cfg.gapAnalysis.rules) {
    const metricValue = metrics[rule.condition.metric] ?? 0
    if (evalCondition(metricValue, rule.condition.op, rule.condition.value)) {
      findings.push({
        id: rule.id,
        title: rule.title,
        severity: rule.severity,
        message: interpolate(rule.message, metrics),
        remediation: rule.remediation,
      })
    }
  }
  const order: Record<string, number> = {CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3}
  return findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
}

// ── T-shirt sizing ────────────────────────────────────────────────────────────

function computeTshirt(metrics: Record<string, number>, cfg: MigrationRulesConfig) {
  const domainResults: TshirtDomainResult[] = []

  for (const d of cfg.tshirtSizing.domains) {
    const count = metrics[d.countMetric] ?? 0
    const avgScore = metrics[d.avgScoreMetric] ?? 0
    const multiplier = bandMultiplier(cfg.tshirtSizing.countBands, count)
    const domainScore = parseFloat((avgScore * multiplier).toFixed(2))
    const size = resolveSize(cfg.tshirtSizing.sizes, domainScore)
    domainResults.push({
      id: d.id,
      label: d.label,
      count,
      avgScore,
      domainScore,
      size: size.label,
      sprintRange: size.sprintRange,
    })
  }

  const totalScore = parseFloat(domainResults.reduce((s, d) => s + d.domainScore, 0).toFixed(2))
  const overallSize = resolveSize(cfg.tshirtSizing.sizes, totalScore)

  return {
    domains: domainResults,
    overall: {totalScore, size: overallSize.label, sprintRange: overallSize.sprintRange},
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export function analyzeManifest(manifest: InventoryManifest, cfg: MigrationRulesConfig): AnalysisResult {
  // Score every component
  const apexProdScores: ComponentScore[] = manifest.apex.items
    .filter((i) => i.type === 'ApexClass' && !i.isTestClass)
    .map((i) => ({name: i.name, componentType: 'ApexClass', score: scoreApexItem(i, cfg), tier: ''}))
    .map((s) => ({...s, tier: resolveTier(cfg.complexity.tiers, s.score)}))

  const apexTestScores: ComponentScore[] = manifest.apex.items
    .filter((i) => i.type === 'ApexClass' && i.isTestClass)
    .map((i) => ({name: i.name, componentType: 'ApexTest', score: scoreApexItem(i, cfg), tier: ''}))
    .map((s) => ({...s, tier: resolveTier(cfg.complexity.tiers, s.score)}))

  const flowScores: ComponentScore[] = manifest.flows.items
    .map((i) => ({name: i.apiName, componentType: i.processType, score: scoreFlowItem(i, cfg), tier: ''}))
    .map((s) => ({...s, tier: resolveTier(cfg.complexity.tiers, s.score)}))

  const omniScores: ComponentScore[] = manifest.omniStudio.omniScripts
    .map((i) => ({name: i.name, componentType: 'OmniScript', score: scoreOmniItem(i, cfg), tier: ''}))
    .map((s) => ({...s, tier: resolveTier(cfg.complexity.tiers, s.score)}))

  const drScores: ComponentScore[] = manifest.omniStudio.dataRaptors
    .map((i) => ({name: i.name, componentType: 'DataRaptor', score: scoreOmniItem(i, cfg), tier: ''}))
    .map((s) => ({...s, tier: resolveTier(cfg.complexity.tiers, s.score)}))

  const fcScores: ComponentScore[] = manifest.omniStudio.flexCards
    .map((i) => ({name: i.name, componentType: 'FlexCard', score: scoreOmniItem(i, cfg), tier: ''}))
    .map((s) => ({...s, tier: resolveTier(cfg.complexity.tiers, s.score)}))

  const domains: DomainAnalysis[] = [
    buildDomain('apex-production', 'Apex (Production)',  apexProdScores, cfg),
    buildDomain('apex-test',       'Apex (Test Classes)', apexTestScores, cfg),
    buildDomain('flows',           'Flows',               flowScores, cfg),
    buildDomain('omniscripts',     'OmniScripts',         omniScores, cfg),
    buildDomain('dataraptors',     'DataRaptors',         drScores, cfg),
    buildDomain('flexcards',       'FlexCards',           fcScores, cfg),
  ]

  const metrics = computeMetrics(manifest, domains)
  const gapFindings = runGapAnalysis(metrics, cfg)
  const tshirt = computeTshirt(metrics, cfg)

  return {domains, gapFindings, tshirt, metrics}
}

// ── Embedded default (mirrors migration-rules.config.json) ───────────────────
// Used as fallback when the config file is not found on disk.

const DEFAULT_CONFIG: MigrationRulesConfig = {
  complexity: {
    apex: {
      categoryWeights: {HookImplementation: 3, VlocityDefaultCustomization: 2, General: 1},
      refTypeWeights: {extends: 3, implements: 3, direct_ref: 1, annotation: 1},
      refCountBands: [
        {min: 0, max: 19, weight: 0},
        {min: 20, max: 49, weight: 1},
        {min: 50, max: 99, weight: 2},
        {min: 100, max: null, weight: 3},
      ],
    },
    flows: {
      processTypeWeights: {Workflow: 2, AutoLaunchedFlow: 1, Flow: 1, default: 1},
      refCountBands: [
        {min: 0, max: 9, weight: 0},
        {min: 10, max: 49, weight: 1},
        {min: 50, max: null, weight: 2},
      ],
    },
    omniStudio: {
      componentTypeWeights: {OmniScript: 2, IntegrationProcedure: 2, DataRaptor: 1, FlexCard: 1, DocuSignTemplate: 1},
      versionBands: [
        {min: 0, max: 2, weight: 0},
        {min: 3, max: 5, weight: 1},
        {min: 6, max: null, weight: 2},
      ],
    },
    tiers: [
      {label: 'LOW', min: 0, max: 3},
      {label: 'MEDIUM', min: 4, max: 7},
      {label: 'HIGH', min: 8, max: 12},
      {label: 'CRITICAL', min: 13, max: null},
    ],
  },
  gapAnalysis: {
    rules: [
      {
        id: 'apex-extends-vlocity',
        title: 'Apex Classes Extending Vlocity Types',
        severity: 'CRITICAL',
        condition: {metric: 'apex.extendsCount', op: 'gt', value: 0},
        message: '{{apex.extendsCount}} class(es) extend vlocity_cmt types — base class will not exist in ARM',
        remediation: 'Review each extended type against the ARM equivalent; inheritance must be replaced or removed',
      },
      {
        id: 'hook-implementations',
        title: 'Hook Implementations Require Remapping',
        severity: 'CRITICAL',
        condition: {metric: 'apex.hookCount', op: 'gt', value: 0},
        message: '{{apex.hookCount}} HookImplementation class(es) — ARM uses different extension points',
        remediation: 'Map each hook to the corresponding ARM extension interface before cut-over',
      },
      {
        id: 'vlocity-customizations',
        title: 'VlocityDefaultCustomization Classes',
        severity: 'CRITICAL',
        condition: {metric: 'apex.customizationCount', op: 'gt', value: 0},
        message: '{{apex.customizationCount}} class(es) implement VlocityOpenInterface / Callable',
        remediation: 'Remap to ARM-equivalent interfaces; validate all Callable keys remain valid in ARM',
      },
      {
        id: 'apex-namespace-refs',
        title: 'High Volume Apex Namespace References',
        severity: 'HIGH',
        condition: {metric: 'apex.withVlocityRefs', op: 'gt', value: 50},
        message: '{{apex.withVlocityRefs}} custom Apex file(s) reference the vlocity_cmt namespace',
        remediation: 'Batch-replace vlocity_cmt__ prefix after ARM deployment using IDE find-and-replace or a script',
      },
      {
        id: 'flows-with-refs',
        title: 'Flows Referencing vlocity_cmt Fields/Objects',
        severity: 'HIGH',
        condition: {metric: 'flows.withVlocityRefs', op: 'gt', value: 0},
        message: '{{flows.withVlocityRefs}} flow(s) reference vlocity_cmt fields or objects',
        remediation: 'Update field and object API names in each flow after namespace migration',
      },
      {
        id: 'orphaned-pricing-plan',
        title: 'Orphaned Pricing Plans',
        severity: 'HIGH',
        condition: {metric: 'pricing.orphanedPlans', op: 'gt', value: 0},
        message: '{{pricing.orphanedPlans}} pricing plan(s) are not linked to any product',
        remediation: 'Link plans to products or remove them — ARM import will reject orphaned plans',
      },
      {
        id: 'apex-implements-vlocity',
        title: 'Apex Classes Implementing Vlocity Interfaces',
        severity: 'HIGH',
        condition: {metric: 'apex.implementsCount', op: 'gt', value: 0},
        message: '{{apex.implementsCount}} class(es) implement vlocity_cmt interfaces',
        remediation: 'Review interface contracts; ARM may have renamed or restructured these interfaces',
      },
      {
        id: 'missing-integration-procedures',
        title: 'No Integration Procedures Found',
        severity: 'MEDIUM',
        condition: {metric: 'omniStudio.totalIntegrationProcedures', op: 'eq', value: 0},
        message: 'Zero Integration Procedures found — ARM relies on IPs for CPQ orchestration',
        remediation: 'Verify whether IPs are managed in a separate package or need to be built from scratch',
      },
      {
        id: 'inactive-products',
        title: 'Inactive Products in Catalog',
        severity: 'LOW',
        condition: {metric: 'products.inactive', op: 'gt', value: 0},
        message: '{{products.inactive}} inactive product(s) detected',
        remediation: 'Confirm whether inactive products should be migrated or archived before migration',
      },
    ],
  },
  tshirtSizing: {
    domains: [
      {id: 'apex-production', label: 'Apex (Production)',  countMetric: 'apex.nonTestWithVlocityRefs', avgScoreMetric: 'apex.avgProductionScore'},
      {id: 'apex-test',       label: 'Apex (Test Classes)', countMetric: 'apex.testWithVlocityRefs',    avgScoreMetric: 'apex.avgTestScore'},
      {id: 'flows',           label: 'Flows',               countMetric: 'flows.withVlocityRefs',       avgScoreMetric: 'flows.avgScore'},
      {id: 'omniscripts',     label: 'OmniScripts',         countMetric: 'omniStudio.totalOmniScripts', avgScoreMetric: 'omniStudio.avgOmniScriptScore'},
      {id: 'dataraptors',     label: 'DataRaptors',         countMetric: 'omniStudio.totalDataRaptors', avgScoreMetric: 'omniStudio.avgDataRaptorScore'},
      {id: 'flexcards',       label: 'FlexCards',           countMetric: 'omniStudio.totalFlexCards',   avgScoreMetric: 'omniStudio.avgFlexCardScore'},
    ],
    countBands: [
      {min: 0, max: 10, multiplier: 1},
      {min: 11, max: 50, multiplier: 2},
      {min: 51, max: 150, multiplier: 3},
      {min: 151, max: 400, multiplier: 4},
      {min: 401, max: null, multiplier: 5},
    ],
    sizes: [
      {label: 'XS', min: 0,  max: 4,    sprintRange: '< 1 sprint'},
      {label: 'S',  min: 5,  max: 10,   sprintRange: '1–2 sprints'},
      {label: 'M',  min: 11, max: 20,   sprintRange: '2–4 sprints'},
      {label: 'L',  min: 21, max: 40,   sprintRange: '4–8 sprints'},
      {label: 'XL', min: 41, max: null, sprintRange: '8+ sprints'},
    ],
  },
}
