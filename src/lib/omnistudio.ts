import {Connection} from '@salesforce/core'
import {queryAll} from './connection.js'
import {OmniStudioInventory, OmniStudioItem} from './types.js'

interface RawOmniScript {
  Id: string
  Name: string
  vlocity_cmt__Type__c: string
  vlocity_cmt__SubType__c: string
  vlocity_cmt__IsActive__c: boolean
  vlocity_cmt__Version__c: number
}

interface RawDataRaptor {
  Id: string
  Name: string
  vlocity_cmt__Type__c?: string
  vlocity_cmt__Version__c?: number
}

interface RawFlexCard {
  Id: string
  Name: string
  vlocity_cmt__Version__c?: number
  vlocity_cmt__Active__c?: boolean
}

interface RawDocuSignTemplate {
  Id: string
  Name: string
  vlocity_cmt__DocumentType__c?: string
}

// OmniScripts and Integration Procedures are both stored in vlocity_cmt__OmniScript__c.
// IPs are distinguished by vlocity_cmt__IsIntegrationProcedure__c = true when that field exists,
// otherwise by a known set of Type__c prefixes (e.g. 'IntegrationProcedure', 'IP').
const IP_TYPE_PREFIXES = ['IntegrationProcedure', 'IP', 'ip', 'integrationprocedure']

async function queryOmniScripts(conn: Connection): Promise<RawOmniScript[]> {
  // Only active versions — each Type/SubType combo has one active version record
  return queryAll<RawOmniScript>(
    conn,
    `SELECT Id, Name, vlocity_cmt__Type__c, vlocity_cmt__SubType__c,
            vlocity_cmt__IsActive__c, vlocity_cmt__Version__c
     FROM vlocity_cmt__OmniScript__c
     WHERE vlocity_cmt__IsActive__c = true
     ORDER BY vlocity_cmt__Type__c, vlocity_cmt__SubType__c`,
  ).catch(() => [] as RawOmniScript[])
}

async function queryIPs(conn: Connection): Promise<RawOmniScript[]> {
  // Try the dedicated field first; if it doesn't exist fall back to type-prefix matching
  try {
    return await queryAll<RawOmniScript>(
      conn,
      `SELECT Id, Name, vlocity_cmt__Type__c, vlocity_cmt__SubType__c,
              vlocity_cmt__IsActive__c, vlocity_cmt__Version__c
       FROM vlocity_cmt__OmniScript__c
       WHERE vlocity_cmt__IsIntegrationProcedure__c = true
         AND vlocity_cmt__IsActive__c = true
       ORDER BY Name`,
    )
  } catch {
    // Field doesn't exist — detect IPs by Type__c prefix
    return []
  }
}

async function queryDataRaptors(conn: Connection): Promise<RawDataRaptor[]> {
  // Try with optional extra fields; fall back to Id/Name only
  try {
    return await queryAll<RawDataRaptor>(
      conn,
      `SELECT Id, Name, vlocity_cmt__Type__c, vlocity_cmt__Version__c
       FROM vlocity_cmt__DRBundle__c
       ORDER BY Name`,
    )
  } catch {
    return queryAll<RawDataRaptor>(conn, `SELECT Id, Name FROM vlocity_cmt__DRBundle__c ORDER BY Name`).catch(
      () => [] as RawDataRaptor[],
    )
  }
}

async function queryFlexCards(conn: Connection): Promise<RawFlexCard[]> {
  // Try with status/active fields; fall back to Id/Name only
  try {
    return await queryAll<RawFlexCard>(
      conn,
      `SELECT Id, Name, vlocity_cmt__Version__c, vlocity_cmt__Active__c
       FROM vlocity_cmt__VlocityUITemplate__c
       ORDER BY Name`,
    )
  } catch {
    return queryAll<RawFlexCard>(conn, `SELECT Id, Name FROM vlocity_cmt__VlocityUITemplate__c ORDER BY Name`).catch(
      () => [] as RawFlexCard[],
    )
  }
}

async function queryDocuSignTemplates(conn: Connection): Promise<RawDocuSignTemplate[]> {
  try {
    return await queryAll<RawDocuSignTemplate>(
      conn,
      `SELECT Id, Name, vlocity_cmt__DocumentType__c FROM vlocity_cmt__DocusignTemplate__c ORDER BY Name`,
    )
  } catch {
    return queryAll<RawDocuSignTemplate>(
      conn,
      `SELECT Id, Name FROM vlocity_cmt__DocusignTemplate__c ORDER BY Name`,
    ).catch(() => [] as RawDocuSignTemplate[])
  }
}

export async function inventoryOmniStudio(conn: Connection): Promise<OmniStudioInventory> {
  const [allActiveOmniScripts, ipRecords, dataRaptors, flexCards, docuSignTemplates] = await Promise.all([
    queryOmniScripts(conn),
    queryIPs(conn),
    queryDataRaptors(conn),
    queryFlexCards(conn),
    queryDocuSignTemplates(conn),
  ])

  // Split OmniScripts from IPs.
  // If the dedicated field query returned IPs, use those IDs to exclude from the omniScripts list.
  // Otherwise fall back to type-prefix detection.
  let ipItems: OmniStudioItem[]
  let omniScriptItems: OmniStudioItem[]

  if (ipRecords.length > 0) {
    const ipIds = new Set(ipRecords.map((ip) => ip.Id))
    omniScriptItems = allActiveOmniScripts
      .filter((os) => !ipIds.has(os.Id))
      .map((os) => toOmniItem(os, 'OmniScript'))
    ipItems = ipRecords.map((ip) => toOmniItem(ip, 'IntegrationProcedure'))
  } else {
    // Distinguish by Type__c prefix
    const isIP = (os: RawOmniScript) =>
      IP_TYPE_PREFIXES.some((p) => (os.vlocity_cmt__Type__c ?? '').toLowerCase().startsWith(p.toLowerCase()))
    omniScriptItems = allActiveOmniScripts.filter((os) => !isIP(os)).map((os) => toOmniItem(os, 'OmniScript'))
    ipItems = allActiveOmniScripts.filter((os) => isIP(os)).map((os) => toOmniItem(os, 'IntegrationProcedure'))
  }

  const dataRaptorItems: OmniStudioItem[] = dataRaptors.map((dr) => ({
    id: dr.Id,
    name: dr.Name,
    subType: dr.vlocity_cmt__Type__c ?? '',
    isActive: true,
    version: dr.vlocity_cmt__Version__c ?? 0,
    componentType: 'DataRaptor',
  }))

  const flexCardItems: OmniStudioItem[] = flexCards.map((fc) => ({
    id: fc.Id,
    name: fc.Name,
    subType: '',
    isActive: fc.vlocity_cmt__Active__c ?? true,
    version: fc.vlocity_cmt__Version__c ?? 0,
    componentType: 'FlexCard',
  }))

  const docuSignItems: OmniStudioItem[] = docuSignTemplates.map((ds) => ({
    id: ds.Id,
    name: ds.Name,
    subType: ds.vlocity_cmt__DocumentType__c ?? '',
    isActive: true,
    version: 0,
    componentType: 'DocuSignTemplate',
  }))

  return {
    totalOmniScripts: omniScriptItems.length,
    totalDataRaptors: dataRaptorItems.length,
    totalIntegrationProcedures: ipItems.length,
    totalDocuSignTemplates: docuSignItems.length,
    totalFlexCards: flexCardItems.length,
    omniScripts: omniScriptItems,
    dataRaptors: dataRaptorItems,
    integrationProcedures: ipItems,
    docuSignTemplates: docuSignItems,
    flexCards: flexCardItems,
  }
}

function toOmniItem(
  os: RawOmniScript,
  componentType: 'OmniScript' | 'IntegrationProcedure',
): OmniStudioItem {
  return {
    id: os.Id,
    name: os.Name,
    subType: `${os.vlocity_cmt__Type__c ?? ''}/${os.vlocity_cmt__SubType__c ?? ''}`,
    isActive: os.vlocity_cmt__IsActive__c,
    version: os.vlocity_cmt__Version__c ?? 0,
    componentType,
  }
}
