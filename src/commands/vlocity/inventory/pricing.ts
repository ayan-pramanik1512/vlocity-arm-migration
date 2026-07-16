import {SfCommand, Flags} from '@salesforce/sf-plugins-core'
import {getConnection} from '../../../lib/connection.js'
import {inventoryPricing} from '../../../lib/pricing.js'
import {PricingInventory} from '../../../lib/types.js'

export default class VlocityInventoryPricing extends SfCommand<PricingInventory> {
  public static readonly summary = 'Inventory Vlocity CMT pricing plans and price lists'
  public static readonly description =
    'Queries vlocity_cmt__PricingPlan__c and vlocity_cmt__PriceList__c. Flags orphaned plans that have no linked products.'
  public static readonly examples = [
    '<%= config.bin %> vlocity inventory pricing --target-org mySandbox',
    '<%= config.bin %> vlocity inventory pricing --target-org mySandbox --json',
  ]

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: 'Org alias or username to target',
      char: 'o',
      required: true,
    }),
  }

  public async run(): Promise<PricingInventory> {
    const {flags} = await this.parse(VlocityInventoryPricing)
    const {conn} = await getConnection(flags['target-org'].getUsername())

    this.log('Querying pricing inventory...')
    const result = await inventoryPricing(conn)

    this.log(`\nPricing Summary`)
    this.log(`  Total Plans       : ${result.totalPlans}`)
    this.log(`  Orphaned Plans    : ${result.orphanedPlans}`)
    this.log(`  Total Price Lists : ${result.totalPriceLists}`)
    this.log(`  Active Price Lists: ${result.activePriceLists}`)

    if (result.orphanedPlans > 0) {
      this.warn(`${result.orphanedPlans} orphaned pricing plan(s) detected — no linked products found.`)
    }

    return result
  }
}
