# vlocity-inventory — Salesforce CLI Plugin

A Salesforce CLI (`sf`) plugin that inventories all Vlocity CMT metadata in a sandbox and writes a JSON manifest plus a human-readable summary report. Designed as a pre-flight tool for Vlocity → OmniStudio ARM migrations.

---

## What it collects

| Module | What is inventoried |
|---|---|
| **Catalog** | All `vlocity_cmt__Catalog__c` records, active/inactive, product counts per catalog |
| **Products** | All `Product2` records with `vlocity_cmt__ProductType__c`, active/inactive split |
| **Attributes** | Attribute categories and attributes (`vlocity_cmt__Attribute__c`) |
| **Pricing** | Pricing plans with orphan detection, price lists |
| **OmniStudio** | OmniScripts, DataRaptors, Integration Procedures, FlexCards, DocuSign Templates — active versions only |
| **Usage Signals** | `vlocity_cmt__UsageSignal__c` records, grouped by type |
| **Apex** | Custom Apex classes and triggers that reference `vlocity_cmt`, categorised by `extends`/`implements`/`direct_ref` |
| **Flows** | Active Flow versions that reference `vlocity_cmt` fields or objects |
| **Validation Rules** | Validation rules whose formula contains `vlocity_cmt` |

---

## Prerequisites

| Requirement | Minimum version | Check |
|---|---|---|
| Node.js | 18 | `node --version` |
| Salesforce CLI (`sf`) | v2 | `sf --version` |
| A logged-in org | — | `sf org list` |

The target org must have the `vlocity_cmt` managed package installed.

---

## Installation

### Option A — Install directly from GitHub (recommended for end users)

This is the standard way to install an `sf` plugin from a private GitHub repository. No local checkout required.

**1. Authenticate with GitHub**

Generate a [personal access token](https://github.com/settings/tokens) with `read:packages` and `repo` scopes, then configure npm:

```bash
npm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_TOKEN
```

**2. Install the plugin**

```bash
sf plugins install github:ayan-pramanik1512/vlocity-inventory
```

The CLI will prompt you to confirm installing an unsigned plugin — type `y`. It will clone the repo, run `npm install` (which auto-builds via the `prepare` script), and wire itself into the `sf` command tree.

**3. Verify**

```bash
sf vlocity inventory --help
```

---

### Option B — Clone and link (for contributors / local development)

```bash
git clone https://github.com/ayan-pramanik1512/vlocity-inventory.git
cd vlocity-inventory
npm install          # installs deps and runs build automatically
sf plugins link .    # makes `sf vlocity inventory` available in your terminal
```

Verify:

```bash
sf vlocity inventory --help
sf plugins
# Should show:  @vlocity/inventory-plugin 0.1.0 (link) ...
```

---

### Option C — GitHub Packages (npm registry, for CI/scripted installs)

If you publish the package to GitHub Packages:

```bash
# .npmrc in the consumer project
@vlocity:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
npm install @vlocity/inventory-plugin
```

---

## Authenticating to the target org

You need a logged-in org alias before running any command:

```bash
# Interactive browser login
sf org login web --alias vlocitypoc

# Or JWT (for CI)
sf org login jwt \
  --username user@example.com \
  --jwt-key-file server.key \
  --client-id YOUR_CONNECTED_APP_ID \
  --alias vlocitypoc
```

---

## Commands

### `vlocity inventory all` — run everything

The primary command. Runs all 9 inventory modules in parallel and writes two output files.

```bash
sf vlocity inventory all --target-org vlocitypoc --output-dir ./output
```

| Flag | Short | Default | Description |
|---|---|---|---|
| `--target-org` | `-o` | _(required)_ | Org alias or username |
| `--output-dir` | `-d` | `.` | Directory to write `manifest.json` and `summary-report.txt` |
| `--skip-apex` | | `false` | Skip the Apex Tooling API scan (faster on first pass for large orgs) |
| `--json` | | | Emit manifest as JSON to stdout instead of writing files |

**Examples**

```bash
# Full run, output to ./output
sf vlocity inventory all --target-org vlocitypoc --output-dir ./output

# Skip the slow Apex scan for a quick first look
sf vlocity inventory all --target-org vlocitypoc --output-dir ./output --skip-apex

# Pipe the manifest to a file (no console report printed)
sf vlocity inventory all --target-org vlocitypoc --json > manifest.json

# Running via node directly (if not installed as sf plugin)
node bin/run.js vlocity inventory all --target-org vlocitypoc --output-dir ./output
```

---

### `vlocity inventory catalog`

```bash
sf vlocity inventory catalog --target-org vlocitypoc
```

Outputs catalog count and active/inactive split to stdout.

---

### `vlocity inventory pricing`

```bash
sf vlocity inventory pricing --target-org vlocitypoc
```

Lists pricing plans, flags orphaned plans (no linked products), and counts price lists.

---

### `vlocity inventory apex`

```bash
sf vlocity inventory apex --target-org vlocitypoc
```

Scans all custom (non-namespaced) Apex classes and triggers via the Tooling API. Classifies each file as:

- `HookImplementation` — class/method name contains `PreHook` or `PostHook`
- `VlocityDefaultCustomization` — implements `VlocityOpenInterface` or `Callable`
- `General` — any other `vlocity_cmt` reference

---

## Output files

After running `vlocity inventory all`, two files are written to `--output-dir`:

### `summary-report.txt`

A formatted plain-text report with sections for each module. Suitable for sharing as a pre-migration assessment document.

```
========================================================================
  VLOCITY CMT INVENTORY REPORT
========================================================================
  Org         : https://myorg.sandbox.salesforce.com
  Org ID      : 00Dxx...
  Run Date    : 2026-07-16T11:20:42.669Z

── CATALOG ──────────────────────────────────────────────────────────
  Total Catalogs  : 12
  Active          : 12
  Inactive        : 0

── PRODUCTS ─────────────────────────────────────────────────────────
  Total Products  : 247
  Active          : 201
  Inactive        : 46

── OMNISTUDIO COMPONENTS ────────────────────────────────────────────
  OmniScripts            : 42
  DataRaptors            : 18
  Integration Procedures : 11
  FlexCards              : 7
  DocuSign Templates     : 3

── USAGE SIGNALS ────────────────────────────────────────────────────
  Total Usage Signals : 9
  Active              : 9

── CUSTOM APEX / VLOCITY REFERENCES ─────────────────────────────────
  Custom Apex Classes  : 1839
  With vlocity_cmt refs: 631

── FLOWS WITH VLOCITY CMT REFERENCES ────────────────────────────────
  Total Flows Scanned  : 39
  With vlocity_cmt refs: 22

── MIGRATION RISK FLAGS ─────────────────────────────────────────────
  [!] 3 orphaned pricing plan(s) — review before migration
  [!] 631 custom Apex file(s) reference vlocity_cmt — requires namespace update
  ...
```

### `manifest.json`

A full machine-readable inventory. Shape:

```json
{
  "org": "https://myorg.sandbox.salesforce.com",
  "orgId": "00Dxx...",
  "runDate": "2026-07-16T11:20:42.669Z",
  "catalog": {
    "total": 12,
    "active": 12,
    "inactive": 0,
    "items": [{ "id": "a0B...", "name": "Residential", "code": "Residential", "status": "Active", "productCount": 0 }]
  },
  "products": {
    "total": 247,
    "active": 201,
    "inactive": 46,
    "items": [{ "id": "01t...", "name": "Sky Q", "code": "SKY_Q", "family": "Hardware", "isActive": true, "productType": "Product" }]
  },
  "attributes": {
    "totalCategories": 4,
    "totalAttributes": 21,
    "categories": [...],
    "attributes": [...]
  },
  "pricing": {
    "totalPlans": 1,
    "orphanedPlans": 1,
    "totalPriceLists": 11,
    "activePriceLists": 11,
    "plans": [...],
    "priceLists": [...]
  },
  "omniStudio": {
    "totalOmniScripts": 42,
    "totalDataRaptors": 18,
    "totalIntegrationProcedures": 11,
    "totalFlexCards": 7,
    "totalDocuSignTemplates": 3,
    "omniScripts": [{ "id": "a3W...", "name": "Account Creation", "subType": "aj/AccountCreation", "isActive": true, "version": 21, "componentType": "OmniScript" }],
    "dataRaptors": [...],
    "integrationProcedures": [...],
    "flexCards": [...],
    "docuSignTemplates": [...]
  },
  "usageSignals": {
    "total": 9,
    "active": 9,
    "byType": { "Promo": 4, "Upsell": 5 },
    "items": [...]
  },
  "apex": {
    "totalCustomClasses": 1839,
    "totalTestClasses": 412,
    "totalCustomTriggers": 14,
    "withVlocityRefs": 631,
    "items": [{
      "name": "MyHookClass",
      "type": "ApexClass",
      "isTestClass": false,
      "category": "HookImplementation",
      "refCount": 3,
      "refTypes": ["extends"],
      "lines": [{ "lineNumber": 1, "content": "public class MyHookClass extends vlocity_cmt__VlocityOpenInterface2 {", "refType": "extends" }]
    }]
  },
  "flows": {
    "totalScanned": 39,
    "withVlocityRefs": 22,
    "items": [{ "id": "301...", "name": "Add Deals", "apiName": "Add_Deals", "processType": "Flow", "status": "Active", "vlocityRefCount": 4, "refTypes": ["custom_field"] }]
  },
  "validationRules": {
    "total": 5,
    "active": 4,
    "items": [{ "id": "03d...", "name": "ValidatePromoCode", "objectName": "vlocity_cmt__Order__c", "active": true, "formula": "..." }]
  }
}
```

---

## Updating the plugin

### If installed via `sf plugins install`

```bash
sf plugins update
# or target this plugin specifically:
sf plugins install github:ayan-pramanik1512/vlocity-inventory
```

### If installed via clone + link

```bash
cd vlocity-inventory
git pull
npm install   # rebuilds automatically
```

---

## Granting access to the private repository

For team members to install via `sf plugins install github:ayan-pramanik1512/vlocity-inventory`:

1. Add them as a collaborator in **Settings → Collaborators** (for a personal repo) or as a member of the GitHub organization with at least `read` access to the repo.
2. They generate a personal access token (`read:packages`, `repo` scopes) at <https://github.com/settings/tokens>.
3. They run:
   ```bash
   npm config set //npm.pkg.github.com/:_authToken THEIR_TOKEN
   ```

For CI pipelines, use a [GitHub Actions secret](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions) and pass it as `GITHUB_TOKEN`.

---

## Repository structure

```
vlocity-inventory/
├── bin/
│   ├── run.js          # CLI entry point (production)
│   └── dev.js          # CLI entry point (ts-node dev mode)
├── src/
│   ├── commands/
│   │   └── vlocity/inventory/
│   │       ├── all.ts      # Orchestrates all modules in parallel
│   │       ├── apex.ts
│   │       ├── catalog.ts
│   │       └── pricing.ts
│   └── lib/
│       ├── apex.ts             # Tooling API Apex scanner
│       ├── attributes.ts       # Attribute/category inventory
│       ├── catalog.ts          # Catalog inventory
│       ├── connection.ts       # Org auth + queryAll helper
│       ├── flows.ts            # Active Flow version scanner
│       ├── omnistudio.ts       # OmniScript / DataRaptor / IP / FlexCard
│       ├── pricing.ts          # Pricing plan + price list inventory
│       ├── products.ts         # Product2 inventory
│       ├── report.ts           # Plain-text report builder
│       ├── types.ts            # Shared TypeScript interfaces
│       ├── usagesignals.ts     # Usage signal inventory
│       └── validationrules.ts  # Tooling API validation rule scanner
├── lib/                # Compiled JS (generated — not edited directly)
├── oclif.manifest.json # Committed so plugin install works without a local build
├── package.json
├── tsconfig.json
└── README.md
```

---

## Contributing / local development

```bash
git clone https://github.com/ayan-pramanik1512/vlocity-inventory.git
cd vlocity-inventory
npm install

# Make changes in src/
npm run build   # or: npm run build -- --watch

# Link into sf so you can test against a real org
sf plugins link .
sf vlocity inventory all --target-org vlocitypoc --output-dir ./output

# Run without sf plugin system (useful for quick iteration)
node bin/run.js vlocity inventory all --target-org vlocitypoc --output-dir ./output
```

To release a new version:

1. Bump `version` in `package.json`
2. Run `npm run build`
3. Commit and push — the updated `oclif.manifest.json` must be committed
4. Create a GitHub release tag (e.g. `v0.2.0`)
5. Team members run `sf plugins install github:ayan-pramanik1512/vlocity-inventory` (or `sf plugins update`) to get the new version

---

## Requirements summary

| Requirement | Notes |
|---|---|
| `sf` CLI v2+ | `npm install -g @salesforce/cli` |
| Node.js 18+ | LTS recommended |
| `vlocity_cmt` package installed | The org must have the managed package; queries will return 0 otherwise |
| Org authenticated | `sf org login web --alias <alias>` |
| GitHub PAT (private install) | `read:packages` + `repo` scopes |
