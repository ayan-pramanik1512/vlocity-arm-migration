import {Connection} from '@salesforce/core'
import {queryAll} from './connection.js'
import {PriceListItem, PricingInventory, PricingPlanItem} from './types.js'

interface RawPricingPlan {
  Id: string
  Name: string
  vlocity_cmt__Code__c: string
  vlocity_cmt__IsActive__c: boolean
}

interface RawPlanProductLink {
  vlocity_cmt__PricingPlanId__c: string
}

interface RawPriceList {
  Id: string
  Name: string
  vlocity_cmt__Code__c: string
  vlocity_cmt__CurrencyCode__c: string
  vlocity_cmt__IsActive__c: boolean
}

export async function inventoryPricing(conn: Connection): Promise<PricingInventory> {
  const [plans, priceListEntries, priceLists] = await Promise.all([
    queryAll<RawPricingPlan>(
      conn,
      `SELECT Id, Name, vlocity_cmt__Code__c, vlocity_cmt__IsActive__c
       FROM vlocity_cmt__PricingPlan__c
       ORDER BY Name`,
    ),
    queryAll<RawPlanProductLink>(
      conn,
      // find all plans that have at least one active product linked — any join object will do
      `SELECT vlocity_cmt__PricingPlanId__c
       FROM vlocity_cmt__ProductChildItem__c
       WHERE vlocity_cmt__PricingPlanId__c != null`,
    ).catch(() => [] as RawPlanProductLink[]),
    queryAll<RawPriceList>(
      conn,
      `SELECT Id, Name, vlocity_cmt__Code__c, vlocity_cmt__CurrencyCode__c, vlocity_cmt__IsActive__c
       FROM vlocity_cmt__PriceList__c
       ORDER BY Name`,
    ).catch(() => [] as RawPriceList[]),
  ])

  const linkedPlanIds = new Set(priceListEntries.map((e) => e.vlocity_cmt__PricingPlanId__c))

  const planItems: PricingPlanItem[] = plans.map((p) => ({
    id: p.Id,
    name: p.Name,
    code: p.vlocity_cmt__Code__c ?? '',
    status: p.vlocity_cmt__IsActive__c ? 'Active' : 'Inactive',
    orphaned: !linkedPlanIds.has(p.Id),
  }))

  const priceListItems: PriceListItem[] = priceLists.map((pl) => ({
    id: pl.Id,
    name: pl.Name,
    code: pl.vlocity_cmt__Code__c ?? '',
    currency: pl.vlocity_cmt__CurrencyCode__c ?? '',
    active: pl.vlocity_cmt__IsActive__c,
  }))

  return {
    totalPlans: planItems.length,
    orphanedPlans: planItems.filter((p) => p.orphaned).length,
    totalPriceLists: priceListItems.length,
    activePriceLists: priceListItems.filter((pl) => pl.active).length,
    plans: planItems,
    priceLists: priceListItems,
  }
}
