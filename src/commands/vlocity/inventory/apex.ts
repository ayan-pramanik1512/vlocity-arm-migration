import {SfCommand, Flags} from '@salesforce/sf-plugins-core'
import {getConnection} from '../../../lib/connection.js'
import {inventoryApex} from '../../../lib/apex.js'
import {ApexInventory} from '../../../lib/types.js'

export default class VlocityInventoryApex extends SfCommand<ApexInventory> {
  public static readonly summary = 'Detect custom Apex that references the vlocity_cmt namespace'
  public static readonly description =
    'Uses the Tooling API to scan all custom (no-namespace) Apex classes and triggers for references to vlocity_cmt. ' +
    'Detects extends, implements, annotations, and direct field/method references.'
  public static readonly examples = [
    '<%= config.bin %> vlocity inventory apex --target-org mySandbox',
    '<%= config.bin %> vlocity inventory apex --target-org mySandbox --json',
    '<%= config.bin %> vlocity inventory apex --target-org mySandbox --show-lines',
  ]

  public static readonly flags = {
    'target-org': Flags.requiredOrg({
      summary: 'Org alias or username to target',
      char: 'o',
      required: true,
    }),
    'show-lines': Flags.boolean({
      summary: 'Print the specific lines with vlocity_cmt references',
      default: false,
    }),
  }

  public async run(): Promise<ApexInventory> {
    const {flags} = await this.parse(VlocityInventoryApex)
    const {conn} = await getConnection(flags['target-org'].getUsername())

    this.log('Scanning custom Apex for vlocity_cmt references (this may take a moment)...')
    const result = await inventoryApex(conn)

    this.log(`\nApex Summary`)
    this.log(`  Custom Classes      : ${result.totalCustomClasses}`)
    this.log(`  Custom Triggers     : ${result.totalCustomTriggers}`)
    this.log(`  With vlocity_cmt refs: ${result.withVlocityRefs}`)

    if (flags['show-lines'] && result.items.length > 0) {
      this.log('\nDetailed References:')
      for (const item of result.items) {
        this.log(`\n  [${item.type}] ${item.name}  (${item.refCount} ref${item.refCount === 1 ? '' : 's'})`)
        for (const line of item.lines.slice(0, 5)) {
          this.log(`    L${line.lineNumber} [${line.refType}]: ${line.content.slice(0, 100)}`)
        }
        if (item.lines.length > 5) {
          this.log(`    ... and ${item.lines.length - 5} more lines`)
        }
      }
    }

    return result
  }
}
