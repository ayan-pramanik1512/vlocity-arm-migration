import {Connection} from '@salesforce/core'
import {queryAll} from './connection.js'
import {ProductInventory, ProductItem} from './types.js'

interface RawProduct {
  Id: string
  Name: string
  ProductCode: string
  Family: string
  IsActive: boolean
  vlocity_cmt__ProductType__c: string
}

export async function inventoryProducts(conn: Connection): Promise<ProductInventory> {
  // Try with custom field first; fall back without it if namespace isn't installed
  let products: RawProduct[] = []
  try {
    products = await queryAll<RawProduct>(
      conn,
      `SELECT Id, Name, ProductCode, Family, IsActive, vlocity_cmt__ProductType__c
       FROM Product2
       ORDER BY Name`,
    )
  } catch {
    products = await queryAll<RawProduct>(
      conn,
      `SELECT Id, Name, ProductCode, Family, IsActive
       FROM Product2
       ORDER BY Name`,
    ).catch(() => [])
  }

  const items: ProductItem[] = products.map((p) => ({
    id: p.Id,
    name: p.Name,
    code: p.ProductCode ?? '',
    family: p.Family ?? '',
    isActive: p.IsActive,
    productType: p.vlocity_cmt__ProductType__c ?? '',
  }))

  return {
    total: items.length,
    active: items.filter((p) => p.isActive).length,
    inactive: items.filter((p) => !p.isActive).length,
    items,
  }
}
