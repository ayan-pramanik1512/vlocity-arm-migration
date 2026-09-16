export interface CatalogItem {
  id: string
  name: string
  code: string
  status: string
  productCount: number
}

export interface CatalogInventory {
  total: number
  active: number
  inactive: number
  items: CatalogItem[]
}

export interface PricingPlanItem {
  id: string
  name: string
  code: string
  status: string
  orphaned: boolean
}

export interface PriceListItem {
  id: string
  name: string
  code: string
  currency: string
  active: boolean
}

export interface PricingInventory {
  totalPlans: number
  orphanedPlans: number
  totalPriceLists: number
  activePriceLists: number
  plans: PricingPlanItem[]
  priceLists: PriceListItem[]
}

export interface ProductItem {
  id: string
  name: string
  code: string
  family: string
  isActive: boolean
  productType: string
}

export interface ProductInventory {
  total: number
  active: number
  inactive: number
  items: ProductItem[]
}

export interface AttributeItem {
  id: string
  name: string
  code: string
  categoryId: string
  categoryName: string
}

export interface AttributeCategoryItem {
  id: string
  name: string
  code: string
  attributeCount: number
}

export interface AttributeInventory {
  totalAttributes: number
  totalCategories: number
  categories: AttributeCategoryItem[]
  attributes: AttributeItem[]
}

export interface FlowItem {
  id: string
  name: string
  apiName: string
  processType: string
  status: string
  vlocityRefCount: number
  refTypes: string[]
}

export interface FlowInventory {
  totalScanned: number
  withVlocityRefs: number
  items: FlowItem[]
}

export interface ValidationRuleItem {
  id: string
  name: string
  objectName: string
  active: boolean
  formula: string
}

export interface ValidationRuleInventory {
  total: number
  active: number
  items: ValidationRuleItem[]
}

export type ApexRefType = 'extends' | 'implements' | 'direct_ref' | 'annotation'

export type ApexClassCategory = 'HookImplementation' | 'VlocityDefaultCustomization' | 'General'

export interface ApexVlocityRef {
  name: string
  namespace: string | null
  type: 'ApexClass' | 'ApexTrigger'
  isTestClass: boolean
  category: ApexClassCategory
  refCount: number
  refTypes: ApexRefType[]
  lines: ApexRefLine[]
}

export interface ApexRefLine {
  lineNumber: number
  content: string
  refType: ApexRefType
}

export interface ApexInventory {
  totalCustomClasses: number
  totalTestClasses: number
  totalCustomTriggers: number
  withVlocityRefs: number
  items: ApexVlocityRef[]
}

export interface OmniStudioItem {
  id: string
  name: string
  subType: string
  isActive: boolean
  version: number
  componentType: 'OmniScript' | 'DataRaptor' | 'IntegrationProcedure' | 'DocuSignTemplate' | 'FlexCard'
}

export interface OmniStudioInventory {
  totalOmniScripts: number
  totalDataRaptors: number
  totalIntegrationProcedures: number
  totalDocuSignTemplates: number
  totalFlexCards: number
  omniScripts: OmniStudioItem[]
  dataRaptors: OmniStudioItem[]
  integrationProcedures: OmniStudioItem[]
  docuSignTemplates: OmniStudioItem[]
  flexCards: OmniStudioItem[]
}

export interface UsageSignalItem {
  id: string
  name: string
  signalCode: string
  signalType: string
  isActive: boolean
  description: string
}

export interface UsageSignalInventory {
  total: number
  active: number
  byType: Record<string, number>
  items: UsageSignalItem[]
}

export interface ComponentScore {
  name: string
  componentType: string
  score: number
  tier: string
}

export interface DomainAnalysis {
  id: string
  label: string
  count: number
  avgScore: number
  tierDistribution: Record<string, number>
  topItems: ComponentScore[]
}

export interface GapFinding {
  id: string
  title: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  remediation: string
}

export interface TshirtDomainResult {
  id: string
  label: string
  count: number
  avgScore: number
  domainScore: number
  size: string
  sprintRange: string
}

export interface TshirtResult {
  domains: TshirtDomainResult[]
  overall: {
    totalScore: number
    size: string
    sprintRange: string
  }
}

export interface AnalysisResult {
  domains: DomainAnalysis[]
  gapFindings: GapFinding[]
  tshirt: TshirtResult
  metrics: Record<string, number>
}

export interface InventoryManifest {
  org: string
  orgId: string
  runDate: string
  catalog: CatalogInventory
  products: ProductInventory
  attributes: AttributeInventory
  pricing: PricingInventory
  apex: ApexInventory
  flows: FlowInventory
  validationRules: ValidationRuleInventory
  omniStudio: OmniStudioInventory
  usageSignals: UsageSignalInventory
}
