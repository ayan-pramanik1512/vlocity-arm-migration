import {Connection} from '@salesforce/core'
import {queryAll} from './connection.js'
import {AttributeCategoryItem, AttributeInventory, AttributeItem} from './types.js'

interface RawAttribute {
  Id: string
  Name: string
  vlocity_cmt__Code__c: string
  vlocity_cmt__AttributeCategoryId__c: string
  vlocity_cmt__AttributeCategoryId__r?: {Name: string}
}

interface RawAttributeCategory {
  Id: string
  Name: string
  vlocity_cmt__Code__c: string
}

export async function inventoryAttributes(conn: Connection): Promise<AttributeInventory> {
  const [rawCategories, rawAttributes] = await Promise.all([
    queryAll<RawAttributeCategory>(
      conn,
      `SELECT Id, Name, vlocity_cmt__Code__c
       FROM vlocity_cmt__AttributeCategory__c
       ORDER BY Name`,
    ).catch(() => [] as RawAttributeCategory[]),
    queryAll<RawAttribute>(
      conn,
      `SELECT Id, Name, vlocity_cmt__Code__c, vlocity_cmt__AttributeCategoryId__c,
              vlocity_cmt__AttributeCategoryId__r.Name
       FROM vlocity_cmt__Attribute__c
       ORDER BY Name`,
    ).catch(() => [] as RawAttribute[]),
  ])

  const attrCountPerCategory = new Map<string, number>()
  for (const a of rawAttributes) {
    if (a.vlocity_cmt__AttributeCategoryId__c) {
      attrCountPerCategory.set(
        a.vlocity_cmt__AttributeCategoryId__c,
        (attrCountPerCategory.get(a.vlocity_cmt__AttributeCategoryId__c) ?? 0) + 1,
      )
    }
  }

  const categories: AttributeCategoryItem[] = rawCategories.map((c) => ({
    id: c.Id,
    name: c.Name,
    code: c.vlocity_cmt__Code__c ?? '',
    attributeCount: attrCountPerCategory.get(c.Id) ?? 0,
  }))

  const categoryNameMap = new Map(rawCategories.map((c) => [c.Id, c.Name]))

  const attributes: AttributeItem[] = rawAttributes.map((a) => ({
    id: a.Id,
    name: a.Name,
    code: a.vlocity_cmt__Code__c ?? '',
    categoryId: a.vlocity_cmt__AttributeCategoryId__c ?? '',
    categoryName:
      a.vlocity_cmt__AttributeCategoryId__r?.Name ??
      categoryNameMap.get(a.vlocity_cmt__AttributeCategoryId__c) ??
      '',
  }))

  return {
    totalAttributes: attributes.length,
    totalCategories: categories.length,
    categories,
    attributes,
  }
}
