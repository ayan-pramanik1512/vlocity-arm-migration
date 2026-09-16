import {Connection} from '@salesforce/core'
import {queryAll} from './connection.js'
import {UsageSignalInventory, UsageSignalItem} from './types.js'

interface RawUsageSignal {
  Id: string
  Name: string
  vlocity_cmt__SignalCode__c: string
  vlocity_cmt__SignalType__c: string
  vlocity_cmt__IsActive__c: boolean
  vlocity_cmt__Description__c: string
}

export async function inventoryUsageSignals(conn: Connection): Promise<UsageSignalInventory> {
  const signals = await queryAll<RawUsageSignal>(
    conn,
    `SELECT Id, Name, vlocity_cmt__SignalCode__c, vlocity_cmt__SignalType__c,
            vlocity_cmt__IsActive__c, vlocity_cmt__Description__c
     FROM vlocity_cmt__UsageSignal__c
     ORDER BY Name`,
  ).catch(() => [] as RawUsageSignal[])

  const items: UsageSignalItem[] = signals.map((s) => ({
    id: s.Id,
    name: s.Name,
    signalCode: s.vlocity_cmt__SignalCode__c ?? '',
    signalType: s.vlocity_cmt__SignalType__c ?? '',
    isActive: s.vlocity_cmt__IsActive__c,
    description: s.vlocity_cmt__Description__c ?? '',
  }))

  const byType = new Map<string, number>()
  for (const item of items) {
    byType.set(item.signalType, (byType.get(item.signalType) ?? 0) + 1)
  }

  return {
    total: items.length,
    active: items.filter((s) => s.isActive).length,
    byType: Object.fromEntries(byType),
    items,
  }
}
