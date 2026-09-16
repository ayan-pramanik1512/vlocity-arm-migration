import {Connection} from '@salesforce/core'
import {FlowInventory, FlowItem} from './types.js'

const NAMESPACE = 'vlocity_cmt'

const FLOW_REF_PATTERNS: Array<{pattern: RegExp; label: string}> = [
  {pattern: /vlocity_cmt__\w+__c/i, label: 'custom_field'},
  {pattern: /vlocity_cmt__\w+__r/i, label: 'relationship'},
  {pattern: /vlocity_cmt\.\w+/i, label: 'apex_ref'},
  {pattern: /vlocity_cmt__\w+/i, label: 'object_ref'},
]

interface RawFlow {
  Id: string
  MasterLabel: string
  ApiName?: string
  ProcessType: string
  Status: string
}

interface FlowMetadataResult {
  Metadata: unknown
}

function scanFlowMetadata(meta: unknown): {refCount: number; refTypes: string[]} {
  const text = JSON.stringify(meta)
  if (!text.includes(NAMESPACE)) return {refCount: 0, refTypes: []}

  const seenTypes = new Set<string>()
  const refCount = (text.match(/vlocity_cmt/gi) ?? []).length

  for (const {pattern, label} of FLOW_REF_PATTERNS) {
    if (pattern.test(text)) seenTypes.add(label)
  }

  return {refCount, refTypes: [...seenTypes]}
}

async function queryActiveFlows(
  tooling: {query(soql: string): Promise<{records: RawFlow[]}>},
): Promise<RawFlow[]> {
  // Only Active versions — one record per flow definition
  try {
    return (
      await tooling.query(
        `SELECT Id, MasterLabel, ApiName, ProcessType, Status
         FROM Flow
         WHERE Status = 'Active'
         ORDER BY MasterLabel`,
      )
    ).records
  } catch {
    // ApiName unavailable in this API version
    return (
      await tooling
        .query(
          `SELECT Id, MasterLabel, ProcessType, Status
           FROM Flow
           WHERE Status = 'Active'
           ORDER BY MasterLabel`,
        )
        .catch(() => ({records: [] as RawFlow[]}))
    ).records
  }
}

export async function inventoryFlows(conn: Connection): Promise<FlowInventory> {
  type ToolingQueryResult = {records: RawFlow[]}
  const tooling = conn.tooling as unknown as {
    query(soql: string): Promise<ToolingQueryResult>
    sobject(name: string): {retrieve(id: string): Promise<FlowMetadataResult>}
  }

  const flows = await queryActiveFlows(tooling)

  const items: FlowItem[] = []
  const batchSize = 10

  for (let i = 0; i < flows.length; i += batchSize) {
    const batch = flows.slice(i, i + batchSize)
    const scanned = await Promise.all(
      batch.map(async (f) => {
        let meta: unknown = null
        try {
          const result = await tooling.sobject('Flow').retrieve(f.Id)
          meta = result.Metadata
        } catch {
          return null
        }
        const {refCount, refTypes} = scanFlowMetadata(meta)
        if (refCount === 0) return null
        return {
          id: f.Id,
          name: f.MasterLabel,
          apiName: f.ApiName ?? f.MasterLabel,
          processType: f.ProcessType ?? '',
          status: f.Status,
          vlocityRefCount: refCount,
          refTypes,
        } satisfies FlowItem
      }),
    )
    items.push(...(scanned.filter(Boolean) as FlowItem[]))
  }

  return {
    totalScanned: flows.length,
    withVlocityRefs: items.length,
    items,
  }
}
