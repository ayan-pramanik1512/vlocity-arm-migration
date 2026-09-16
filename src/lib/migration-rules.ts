// TypeScript types for migration-rules.config.json schema.
// The config file drives all complexity scoring, gap analysis, and t-shirt sizing —
// no scoring logic lives in code.

export interface Band {
  min: number
  max: number | null
  weight: number
}

export interface ComplexityTier {
  label: string
  min: number
  max: number | null
}

export interface ApexComplexityConfig {
  categoryWeights: Record<string, number>
  refTypeWeights: Record<string, number>
  refCountBands: Band[]
}

export interface FlowComplexityConfig {
  processTypeWeights: Record<string, number>
  refCountBands: Band[]
}

export interface OmniStudioComplexityConfig {
  componentTypeWeights: Record<string, number>
  versionBands: Band[]
}

export interface ComplexityConfig {
  apex: ApexComplexityConfig
  flows: FlowComplexityConfig
  omniStudio: OmniStudioComplexityConfig
  tiers: ComplexityTier[]
}

export type GapOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'

export interface GapCondition {
  metric: string
  op: GapOp
  value: number
}

export type GapSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface GapRule {
  id: string
  title: string
  severity: GapSeverity
  condition: GapCondition
  message: string
  remediation: string
}

export interface GapAnalysisConfig {
  rules: GapRule[]
}

export interface TshirtDomainConfig {
  id: string
  label: string
  countMetric: string
  avgScoreMetric: string
}

export interface CountBand {
  min: number
  max: number | null
  multiplier: number
}

export interface TshirtSizeConfig {
  label: string
  min: number
  max: number | null
  sprintRange: string
}

export interface TshirtSizingConfig {
  domains: TshirtDomainConfig[]
  countBands: CountBand[]
  sizes: TshirtSizeConfig[]
}

export interface MigrationRulesConfig {
  complexity: ComplexityConfig
  gapAnalysis: GapAnalysisConfig
  tshirtSizing: TshirtSizingConfig
}
