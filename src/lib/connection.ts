import {Connection, Org} from '@salesforce/core'

export async function getConnection(targetOrg?: string): Promise<{conn: Connection; orgId: string; instanceUrl: string}> {
  const org = await Org.create({aliasOrUsername: targetOrg})
  await org.refreshAuth()
  const conn = org.getConnection()
  const orgId = org.getOrgId()
  const instanceUrl = org.getField<string>(Org.Fields.INSTANCE_URL)
  return {conn, orgId, instanceUrl}
}

export type QueryResult<T> = {
  records: T[]
  totalSize: number
  done: boolean
}

export async function queryAll<T extends object>(conn: Connection, soql: string): Promise<T[]> {
  const result = await conn.query<T>(soql)
  let records = [...result.records]

  // handle large result sets with queryMore
  let next = result
  while (!next.done && next.nextRecordsUrl) {
    next = await conn.queryMore<T>(next.nextRecordsUrl)
    records = records.concat(next.records)
  }

  return records
}
