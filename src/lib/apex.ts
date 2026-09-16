import {Connection} from '@salesforce/core'
import {ApexClassCategory, ApexInventory, ApexRefLine, ApexRefType, ApexVlocityRef} from './types.js'

const NAMESPACE = 'vlocity_cmt'

// patterns that indicate a vlocity_cmt reference in Apex code
const REF_PATTERNS: Array<{pattern: RegExp; type: ApexRefType}> = [
  {pattern: /extends\s+vlocity_cmt__\w+/i, type: 'extends'},
  {pattern: /implements\s+[^{]*vlocity_cmt__\w+/i, type: 'implements'},
  {pattern: /@vlocity_cmt\.\w+/i, type: 'annotation'},
  {pattern: /vlocity_cmt__\w+/i, type: 'direct_ref'},
]

interface RawApexMember {
  Id: string
  Name: string
  NamespacePrefix: string | null
}

interface ToolingApexBody {
  Body: string
}

async function fetchApexBody(conn: Connection, id: string): Promise<string> {
  try {
    const result = await (conn.tooling.sobject('ApexClass') as unknown as {
      retrieve(id: string): Promise<ToolingApexBody>
    }).retrieve(id)
    return result.Body ?? ''
  } catch {
    return ''
  }
}

async function fetchTriggerBody(conn: Connection, id: string): Promise<string> {
  try {
    const result = await (conn.tooling.sobject('ApexTrigger') as unknown as {
      retrieve(id: string): Promise<ToolingApexBody>
    }).retrieve(id)
    return result.Body ?? ''
  } catch {
    return ''
  }
}

function isTestClass(body: string): boolean {
  return /@isTest/i.test(body)
}

// Checks class declaration line only to avoid matching method/variable names mid-body
const CLASS_DECL = /^[^{]*(class|interface)\s+\w+[^{]*/m

function classifyApexClass(body: string): ApexClassCategory {
  // HookImplementation: class/method name contains PreHook or PostHook (case-insensitive)
  if (/(?:pre|post)hook/i.test(body.slice(0, 2000))) return 'HookImplementation'

  // VlocityDefaultCustomization: implements VlocityOpenInterface or Callable (vlocity_cmt namespace)
  const declMatch = body.match(CLASS_DECL)
  const decl = declMatch ? declMatch[0] : body.slice(0, 500)
  if (/implements\s+[^{]*\bvlocity_cmt\.VlocityOpenInterface\b/i.test(decl)) return 'VlocityDefaultCustomization'
  if (/implements\s+[^{]*\bvlocity_cmt\.Callable\b/i.test(decl)) return 'VlocityDefaultCustomization'
  // also match without namespace prefix for orgs that import via without-sharing or inner
  if (/implements\s+[^{]*\bVlocityOpenInterface\b/i.test(decl)) return 'VlocityDefaultCustomization'
  if (/\bimplements\s+[^{]*\bCallable\b/i.test(decl) && /vlocity_cmt/i.test(body.slice(0, 500))) return 'VlocityDefaultCustomization'

  return 'General'
}

function scanBody(body: string): {refCount: number; refTypes: ApexRefType[]; lines: ApexRefLine[]} {
  const lines = body.split('\n')
  const foundLines: ApexRefLine[] = []
  const seenTypes = new Set<ApexRefType>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // skip single-line comments
    if (/^\s*\/\//.test(line)) continue

    for (const {pattern, type} of REF_PATTERNS) {
      if (pattern.test(line)) {
        foundLines.push({lineNumber: i + 1, content: line.trim(), refType: type})
        seenTypes.add(type)
        break // one type per line is enough
      }
    }
  }

  return {
    refCount: foundLines.length,
    refTypes: [...seenTypes],
    lines: foundLines,
  }
}

export async function inventoryApex(conn: Connection): Promise<ApexInventory> {
  type ToolingQueryResult = {records: RawApexMember[]}
  const tooling = conn.tooling as unknown as {query(soql: string): Promise<ToolingQueryResult>}

  const [classes, triggers] = await Promise.all([
    tooling
      .query(`SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE NamespacePrefix = null ORDER BY Name`)
      .then((r) => r.records)
      .catch(() => [] as RawApexMember[]),
    tooling
      .query(`SELECT Id, Name, NamespacePrefix FROM ApexTrigger WHERE NamespacePrefix = null ORDER BY Name`)
      .then((r) => r.records)
      .catch(() => [] as RawApexMember[]),
  ])

  // single pass over all classes: track test count + collect vlocity refs
  let totalTestClasses = 0
  const classRefs: ApexVlocityRef[] = []
  const batchSize = 10

  for (let i = 0; i < classes.length; i += batchSize) {
    const batch = classes.slice(i, i + batchSize)
    const scanned = await Promise.all(
      batch.map(async (m) => {
        const body = await fetchApexBody(conn, m.Id)
        const testClass = isTestClass(body)
        if (testClass) totalTestClasses++
        if (!body.includes(NAMESPACE)) return null
        const {refCount, refTypes, lines} = scanBody(body)
        if (refCount === 0) return null
        return {
          name: m.Name,
          namespace: m.NamespacePrefix,
          type: 'ApexClass' as const,
          isTestClass: testClass,
          category: classifyApexClass(body),
          refCount,
          refTypes,
          lines,
        } satisfies ApexVlocityRef
      }),
    )
    classRefs.push(...(scanned.filter(Boolean) as ApexVlocityRef[]))
  }

  // scan trigger bodies — triggers are never test classes
  const triggerRefs: ApexVlocityRef[] = []
  for (let i = 0; i < triggers.length; i += batchSize) {
    const batch = triggers.slice(i, i + batchSize)
    const scanned = await Promise.all(
      batch.map(async (m) => {
        const body = await fetchTriggerBody(conn, m.Id)
        if (!body.includes(NAMESPACE)) return null
        const {refCount, refTypes, lines} = scanBody(body)
        if (refCount === 0) return null
        return {
          name: m.Name,
          namespace: m.NamespacePrefix,
          type: 'ApexTrigger' as const,
          isTestClass: false,
          category: 'General' as const,
          refCount,
          refTypes,
          lines,
        } satisfies ApexVlocityRef
      }),
    )
    triggerRefs.push(...(scanned.filter(Boolean) as ApexVlocityRef[]))
  }

  const allRefs = [...classRefs, ...triggerRefs]

  return {
    totalCustomClasses: classes.length,
    totalTestClasses,
    totalCustomTriggers: triggers.length,
    withVlocityRefs: allRefs.length,
    items: allRefs,
  }
}
