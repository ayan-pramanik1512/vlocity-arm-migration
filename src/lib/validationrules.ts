import {Connection} from '@salesforce/core'
import {ValidationRuleInventory, ValidationRuleItem} from './types.js'

const NAMESPACE = 'vlocity_cmt'

interface RawValidationRule {
  Id: string
  ValidationName: string
  Active: boolean
  EntityDefinition: {QualifiedApiName: string}
  ErrorConditionFormula: string
}

export async function inventoryValidationRules(conn: Connection): Promise<ValidationRuleInventory> {
  type ToolingQueryResult = {records: RawValidationRule[]; done: boolean; nextRecordsUrl?: string}
  const tooling = conn.tooling as unknown as {query(soql: string): Promise<ToolingQueryResult>}

  // Query all validation rules — filter to vlocity_cmt refs via LIKE on formula
  // LIKE with wildcards in Tooling API is supported
  let records: RawValidationRule[] = []
  try {
    let result = await tooling.query(
      `SELECT Id, ValidationName, Active, EntityDefinition.QualifiedApiName, ErrorConditionFormula
       FROM ValidationRule
       WHERE ErrorConditionFormula LIKE '%vlocity_cmt%'
       ORDER BY EntityDefinition.QualifiedApiName, ValidationName`,
    )
    records = [...result.records]
    // paginate if needed
    while (!result.done && result.nextRecordsUrl) {
      result = await (conn.tooling as unknown as {queryMore(url: string): Promise<ToolingQueryResult>}).queryMore(
        result.nextRecordsUrl,
      )
      records = records.concat(result.records)
    }
  } catch {
    records = []
  }

  const items: ValidationRuleItem[] = records
    .filter((r) => r.ErrorConditionFormula?.includes(NAMESPACE))
    .map((r) => ({
      id: r.Id,
      name: r.ValidationName,
      objectName: r.EntityDefinition?.QualifiedApiName ?? '',
      active: r.Active,
      formula: r.ErrorConditionFormula ?? '',
    }))

  return {
    total: items.length,
    active: items.filter((i) => i.active).length,
    items,
  }
}
