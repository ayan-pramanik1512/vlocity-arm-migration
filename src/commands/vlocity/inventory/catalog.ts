import {SfCommand, Flags} from '@salesforce/sf-plugins-core'
import {getConnection} from '../../../lib/connection.js'
import {inventoryCatalog} from '../../../lib/catalog.js'
import {CatalogInventory} from '../../../lib/types.js'

export default class VlocityInventoryCatalog extends SfCommand<CatalogInventory> {
  public static readonly summary = 'Inventory Vlocity CMT catalogs in a sandbox'
  public static readonly description =
    'Queries vlocity_cmt__Catalog__c and vlocity_cmt__CatalogRelationship__c to produce a catalog inventory with active/inactive counts and product linkage.'
  public static readonly examples = [
    '<%= config.bin %> vlocity inventory catalog --target-org mySandbox',
    '<%= config.bin %> vlocity inventory catalog --target-org mySandbox --json',
  ]

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: 'Org alias or username to target',
      char: 'o',
      required: true,
    }),
  }

  public async run(): Promise<CatalogInventory> {
    const {flags} = await this.parse(VlocityInventoryCatalog)
    const {conn} = await getConnection(flags['target-org'].getUsername())

    this.log('Querying catalog inventory...')
    const result = await inventoryCatalog(conn)

    this.log(`\nCatalog Summary`)
    this.log(`  Total    : ${result.total}`)
    this.log(`  Active   : ${result.active}`)
    this.log(`  Inactive : ${result.inactive}`)

    return result
  }
}
