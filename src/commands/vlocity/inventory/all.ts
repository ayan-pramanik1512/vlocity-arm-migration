import * as fs from 'node:fs'
import * as path from 'node:path'
import {SfCommand, Flags} from '@salesforce/sf-plugins-core'
import {getConnection} from '../../../lib/connection.js'
import {inventoryCatalog} from '../../../lib/catalog.js'
import {inventoryProducts} from '../../../lib/products.js'
import {inventoryAttributes} from '../../../lib/attributes.js'
import {inventoryPricing} from '../../../lib/pricing.js'
import {inventoryApex} from '../../../lib/apex.js'
import {inventoryFlows} from '../../../lib/flows.js'
import {inventoryValidationRules} from '../../../lib/validationrules.js'
import {inventoryOmniStudio} from '../../../lib/omnistudio.js'
import {inventoryUsageSignals} from '../../../lib/usagesignals.js'
import {buildReport} from '../../../lib/report.js'
import {buildHtmlReport} from '../../../lib/htmlReport.js'
import {analyzeManifest, loadRulesConfig} from '../../../lib/analysis.js'
import {InventoryManifest} from '../../../lib/types.js'

export default class VlocityInventoryAll extends SfCommand<InventoryManifest> {
  public static readonly summary = 'Run all Vlocity CMT inventory modules and output a manifest + summary report'
  public static readonly description =
    'Runs catalog, product, attribute, pricing, apex, flows, validation rules, OmniStudio, and usage signals inventory modules in parallel, writes manifest.json and summary-report.txt to the output directory.'
  public static readonly examples = [
    '<%= config.bin %> vlocity inventory all --target-org mySandbox',
    '<%= config.bin %> vlocity inventory all --target-org mySandbox --output-dir ./output',
    '<%= config.bin %> vlocity inventory all --target-org mySandbox --skip-apex',
    '<%= config.bin %> vlocity inventory all --target-org mySandbox --json',
  ]

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: 'Org alias or username to target',
      char: 'o',
      required: true,
    }),
    'output-dir': Flags.directory({
      summary: 'Directory to write manifest.json and summary-report.txt',
      char: 'd',
      default: '.',
    }),
    'skip-apex': Flags.boolean({
      summary: 'Skip the Apex namespace scan (faster, use for large orgs on first pass)',
      default: false,
    }),
    'rules-config': Flags.file({
      summary: 'Path to migration-rules.config.json (defaults to ./migration-rules.config.json in CWD)',
      char: 'r',
      exists: true,
      required: false,
    }),
  }

  public async run(): Promise<InventoryManifest> {
    const {flags} = await this.parse(VlocityInventoryAll)
    const {conn, orgId, instanceUrl} = await getConnection(flags['target-org'].getUsername())

    this.log(`Connected to: ${instanceUrl}`)
    this.log('Running inventory modules...\n')

    const runDate = new Date().toISOString()

    // run all inventory modules in parallel; apex optionally
    const [catalog, products, attributes, pricing, apex, flows, validationRules, omniStudio, usageSignals] = await Promise.all([
      (async () => {
        this.log('  [1/9] Catalog inventory...')
        const r = await inventoryCatalog(conn)
        this.log(`        Done — ${r.total} catalogs (${r.active} active)`)
        return r
      })(),
      (async () => {
        this.log('  [2/9] Product inventory...')
        const r = await inventoryProducts(conn)
        this.log(`        Done — ${r.total} products (${r.active} active)`)
        return r
      })(),
      (async () => {
        this.log('  [3/9] Attribute inventory...')
        const r = await inventoryAttributes(conn)
        this.log(`        Done — ${r.totalAttributes} attributes, ${r.totalCategories} categories`)
        return r
      })(),
      (async () => {
        this.log('  [4/9] Pricing inventory...')
        const r = await inventoryPricing(conn)
        this.log(`        Done — ${r.totalPlans} plans, ${r.orphanedPlans} orphaned`)
        return r
      })(),
      (async () => {
        if (flags['skip-apex']) {
          this.log('  [5/9] Apex scan skipped (--skip-apex)')
          return {totalCustomClasses: 0, totalTestClasses: 0, totalCustomTriggers: 0, withVlocityRefs: 0, items: []}
        }
        this.log('  [5/9] Apex namespace scan (Tooling API)...')
        const r = await inventoryApex(conn)
        this.log(`        Done — ${r.withVlocityRefs} file(s) with vlocity_cmt refs`)
        return r
      })(),
      (async () => {
        this.log('  [6/9] Flow scan...')
        const r = await inventoryFlows(conn)
        this.log(`        Done — ${r.withVlocityRefs} of ${r.totalScanned} flow(s) have vlocity_cmt refs`)
        return r
      })(),
      (async () => {
        this.log('  [7/9] Validation rule scan...')
        const r = await inventoryValidationRules(conn)
        this.log(`        Done — ${r.total} validation rule(s) with vlocity_cmt refs`)
        return r
      })(),
      (async () => {
        this.log('  [8/9] OmniStudio component inventory...')
        const r = await inventoryOmniStudio(conn)
        this.log(
          `        Done — ${r.totalOmniScripts} OmniScripts, ${r.totalDataRaptors} DataRaptors, ` +
            `${r.totalIntegrationProcedures} IPs, ${r.totalFlexCards} FlexCards`,
        )
        return r
      })(),
      (async () => {
        this.log('  [9/9] Usage signal inventory...')
        const r = await inventoryUsageSignals(conn)
        this.log(`        Done — ${r.total} usage signal(s) (${r.active} active)`)
        return r
      })(),
    ])

    const manifest: InventoryManifest = {
      org: instanceUrl,
      orgId,
      runDate,
      catalog,
      products,
      attributes,
      pricing,
      apex,
      flows,
      validationRules,
      omniStudio,
      usageSignals,
    }

    // write output files
    const outDir = flags['output-dir'] as string
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, {recursive: true})

    const manifestPath = path.join(outDir, 'manifest.json')
    const reportPath = path.join(outDir, 'summary-report.txt')
    const htmlReportPath = path.join(outDir, 'summary-report.html')

    const rulesConfig = loadRulesConfig(flags['rules-config'])
    const analysis = analyzeManifest(manifest, rulesConfig)
    const report = buildReport(manifest, analysis)
    const htmlReport = buildHtmlReport(manifest, analysis)

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    fs.writeFileSync(reportPath, report)
    fs.writeFileSync(htmlReportPath, htmlReport)

    this.log(`\nOutput written:`)
    this.log(`  Manifest    : ${manifestPath}`)
    this.log(`  Report      : ${reportPath}`)
    this.log(`  HTML Report : ${htmlReportPath}`)
    this.log('\n' + report)

    return manifest
  }
}
