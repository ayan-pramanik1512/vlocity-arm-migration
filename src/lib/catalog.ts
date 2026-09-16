import {Connection} from '@salesforce/core'
import {queryAll} from './connection.js'
import {CatalogInventory, CatalogItem} from './types.js'

interface RawCatalog {
  Id: string
  Name: string
  vlocity_cmt__CatalogCode__c: string
  vlocity_cmt__IsActive__c: boolean
}

interface RawCatalogRelationship {
  vlocity_cmt__CatalogId__c: string
}

export async function inventoryCatalog(conn: Connection): Promise<CatalogInventory> {
  const [catalogs, relationships] = await Promise.all([
    queryAll<RawCatalog>(
      conn,
      `SELECT Id, Name, vlocity_cmt__CatalogCode__c, vlocity_cmt__IsActive__c
       FROM vlocity_cmt__Catalog__c
       ORDER BY Name`,
    ),
    queryAll<RawCatalogRelationship>(
      conn,
      `SELECT vlocity_cmt__CatalogId__c, COUNT(Id) ProductCount
       FROM vlocity_cmt__CatalogRelationship__c
       WHERE vlocity_cmt__CatalogId__c != null
       GROUP BY vlocity_cmt__CatalogId__c`,
    ).catch(() => [] as RawCatalogRelationship[]),
  ])

  // build a product count map per catalog
  const productCountMap = new Map<string, number>()
  for (const rel of relationships as Array<RawCatalogRelationship & {ProductCount?: number}>) {
    if (rel.vlocity_cmt__CatalogId__c) {
      productCountMap.set(rel.vlocity_cmt__CatalogId__c, rel.ProductCount ?? 0)
    }
  }

  const items: CatalogItem[] = catalogs.map((c) => ({
    id: c.Id,
    name: c.Name,
    code: c.vlocity_cmt__CatalogCode__c ?? '',
    status: c.vlocity_cmt__IsActive__c ? 'Active' : 'Inactive',
    productCount: productCountMap.get(c.Id) ?? 0,
  }))

  const active = items.filter((i) => i.status === 'Active').length

  return {
    total: items.length,
    active,
    inactive: items.length - active,
    items,
  }
}
