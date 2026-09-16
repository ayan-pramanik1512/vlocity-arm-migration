import {InventoryManifest, AnalysisResult, GapFinding} from './types.js'

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface ExecutiveStat {
  label: string
  value: string
}

export interface ExecutiveSummary {
  overallSize: string
  sprintRange: string
  totalScore: number
  headline: string
  stats: ExecutiveStat[]
  severityCounts: Record<Severity, number>
  topFindings: GapFinding[]
  totalComponentsScored: number
  tierTotals: Record<Severity | 'LOW', number>
}

const SEVERITY_PLAIN: Record<Severity, string> = {
  CRITICAL: 'Blocking — must resolve before migration',
  HIGH: 'Significant effort — plan for a dedicated workstream',
  MEDIUM: 'Moderate effort — schedule during the build phase',
  LOW: 'Minor cleanup — low risk to timeline',
}

export function plainLanguageSeverity(severity: string): string {
  return SEVERITY_PLAIN[severity as Severity] ?? severity
}

export function buildExecutiveSummary(manifest: InventoryManifest, analysis: AnalysisResult): ExecutiveSummary {
  const severityCounts: Record<Severity, number> = {CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0}
  for (const f of analysis.gapFindings) severityCounts[f.severity]++

  const tierTotals: Record<Severity, number> = {CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0}
  let totalComponentsScored = 0
  for (const d of analysis.domains) {
    totalComponentsScored += d.count
    for (const tier of Object.keys(tierTotals) as Severity[]) {
      tierTotals[tier] += d.tierDistribution[tier] ?? 0
    }
  }

  const totalOmniStudioComponents =
    manifest.omniStudio.totalOmniScripts +
    manifest.omniStudio.totalDataRaptors +
    manifest.omniStudio.totalIntegrationProcedures +
    manifest.omniStudio.totalFlexCards +
    manifest.omniStudio.totalDocuSignTemplates

  const stats: ExecutiveStat[] = [
    {label: 'Products in Catalog', value: String(manifest.products.total)},
    {label: 'OmniStudio Components', value: String(totalOmniStudioComponents)},
    {label: 'Apex Files w/ vlocity_cmt Refs', value: String(manifest.apex.withVlocityRefs)},
    {label: 'Flows w/ vlocity_cmt Refs', value: String(manifest.flows.withVlocityRefs)},
    {label: 'Components Assessed', value: String(totalComponentsScored)},
    {label: 'Blocking Findings', value: String(severityCounts.CRITICAL)},
  ]

  const headline =
    severityCounts.CRITICAL > 0
      ? `${severityCounts.CRITICAL} blocking issue(s) must be resolved before migration can proceed. ` +
        `Overall effort is estimated at ${analysis.tshirt.overall.size} (${analysis.tshirt.overall.sprintRange}).`
      : `No blocking issues detected. Overall effort is estimated at ${analysis.tshirt.overall.size} (${analysis.tshirt.overall.sprintRange}).`

  return {
    overallSize: analysis.tshirt.overall.size,
    sprintRange: analysis.tshirt.overall.sprintRange,
    totalScore: analysis.tshirt.overall.totalScore,
    headline,
    stats,
    severityCounts,
    topFindings: analysis.gapFindings.slice(0, 5),
    totalComponentsScored,
    tierTotals,
  }
}
