"""Build the source-only update for the existing West US 3 pilot.

The original deployment directory must already contain dependencies and runtime
state. No state, credentials, dependencies, database or image files are packaged.
"""
from pathlib import Path
import hashlib
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
output = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/EtalonOps-pilot-update-v49.4.zip')
files = ['docs/PILOT_UPDATE_V49_4.md', 'scripts/publication-import/prepare-couplings.ts', 'docs/PILOT_UPDATE_V49_3.md', 'docs/PILOT_UPDATE_V49_2.md', 'server/search-language.ts', 'server/search-constraints.ts', 'scripts/publication-import/prepare-search-coverage.ts',

    'docs/PILOT_UPDATE_V49.md', 'docs/APPEARANCE_STUDIO.md', 'docs/PILOT_UPDATE_V48.md', 'scripts/build-appearance-components.py', 'src/appearance-fields.ts', 'src/appearance-components.ts', 'src/AppearanceWorkspace.tsx', 'src/appearance-preview.ts', 'src/appearance.ts', 'src/AppearanceStudio.tsx', 'server/appearance.ts', 'db/017-appearance-studio.sql', 'db/migrations/017-appearance-studio.sql', 'db/015-admin-review-design.sql', 'db/migrations/015-admin-review-design.sql', 'db/016-manual-line-identity.sql', 'db/migrations/016-manual-line-identity.sql',
    'server/manual-review.ts', 'server/global-design.ts', 'src/ManualItemReview.tsx', 'src/GlobalDesign.tsx', 'src/global-design.ts', 'src/main.tsx',
    'docs/PILOT_UPDATE_V47.md', 'server/trade-terms.ts', 'server/search.ts', 'scripts/audit-catalog-search.ts',
    'docs/PILOT_UPDATE_V46.md', 'server/specification-search.ts',
    'docs/PILOT_UPDATE_V45.md', 'scripts/publication-import/core.ts', 'scripts/publication-import/run.ts', 'scripts/publication-import/prepare.ts', 'scripts/publication-import/run-import.sh', 'scripts/publication-import/README.md',
    'docs/PILOT_UPDATE_V44.md', 'docs/material-workbook/backend.md', 'docs/material-workbook/CHATGPT_POPULATION.md', 'docs/material-workbook/EtalonOps-Materials-Only.xlsx',
    'src/MaterialWorkbook.tsx', 'src/material-families.ts', 'src/material-workbook-format.ts',
    'server/material-family.ts', 'server/material-search-constraints.ts', 'server/material-workbook.ts', 'server/material-workbook-data.ts', 'server/material-workbook-xlsx.ts',
    'docs/PILOT_UPDATE_V43.md', 'server/catalog-import-v2.ts',
    'docs/PILOT_UPDATE_V42.md',
    'docs/PILOT_UPDATE_V41.md', 'src/document-sizing.ts',
    'docs/PILOT_UPDATE_V40.md',
    'docs/PILOT_UPDATE_V39.md',
    'docs/PILOT_UPDATE_V38.md', 'db/014-document-designer.sql', 'db/migrations/014-document-designer.sql',
    'src/document-layout.ts', 'src/DocumentDesigner.tsx', 'src/CompanyLogo.tsx',
    'server/document-templates.ts', 'server/document-renderer.ts', 'server/document-routes.ts',
    'docs/PILOT_UPDATE_V37.md', 'db/013-mrf-export.sql', 'db/migrations/013-mrf-export.sql', 'src/mrf-form.ts', 'src/pdf-template.ts', 'src/PDFTemplateAdmin.tsx', 'server/pdf-template.ts', 'server/pdf-routes.ts', 'server/mrf-pdf.ts', 'docs/PILOT_UPDATE_V36.md', 'src/image-selection.ts', 'src/PurchasingFields.tsx', 'docs/PILOT_UPDATE_V35.md', 'docs/PILOT_UPDATE_V34.md', 'docs/PILOT_UPDATE_V33.md', 'docs/PILOT_UPDATE_V32.md', 'docs/PILOT_UPDATE_V31.md', 'docs/SITE_ACCOUNTS_AND_JOBS.md', 'db/012-workforce-accounts.sql', 'db/migrations/012-workforce-accounts.sql',
    'server/workforce.ts', 'server/site-accounts.ts', 'server/account-routes.ts', 'src/LoginPage.tsx', 'src/useJobs.ts', 'scripts/recover-cloud-workspace.sh',
    'docs/PILOT_UPDATE_V30.md', 'db/011-line-task-code.sql', 'db/migrations/011-line-task-code.sql',
    'docs/PILOT_UPDATE_V29.md',
    'docs/PILOT_UPDATE_V28.md',
    'docs/PILOT_UPDATE_V27.md', 'server/mrf-foreman.ts', 'db/010-mrf-foreman.sql', 'db/migrations/010-mrf-foreman.sql',
    'docs/PILOT_UPDATE_V26.md',
    'docs/PILOT_UPDATE_V25.md',
    'server/material-categories.ts', 'src/material-categories.ts', 'src/MaterialCategoryAdmin.tsx', 'db/009-material-categories.sql', 'db/migrations/009-material-categories.sql', 'docs/PILOT_UPDATE_V24.md',
    'server/material-table.ts', 'src/MaterialTable.tsx', 'docs/PILOT_UPDATE_V23.md',
    'docs/PILOT_UPDATE_V22.md',
    'docs/PILOT_UPDATE_V21.md',
    'docs/PILOT_UPDATE_V20.md', 'docs/CHATGPT_RESEARCH_IMPORT.md', 'server/prepared-research.ts',
    'docs/PILOT_UPDATE_V19.md', 'scripts/sql-init.ts', 'src/research-attributes.ts', 'db/008-product-details.sql', 'db/migrations/008-product-details.sql',
    'docs/PILOT_UPDATE_V18.md', 'server/research-discovery.ts', 'docs/PILOT_UPDATE_V17.md', 'server/research-output.ts', 'server/research-error.ts', 'docs/PILOT_UPDATE_V16.md', 'docs/AZURE_RESEARCH.md', 'docs/LIVE_AI_ACTIVATION.md', 'scripts/enable-azure-research.py',
    'server/cloud-config.ts', 'server/cloud-main.ts', 'server/ai-provider.ts', 'server/azure-research.ts', 'server/research-policy.ts', 'server/research-ledger.ts', 'server/research-source.ts', 'server/research-pdf.ts', 'server/research-routes.ts', 'server/research-selection.ts', 'src/LiveResearch.tsx',
    'docs/PILOT_UPDATE_V15.md', 'server/catalog-publication.ts', 'docs/PILOT_UPDATE_V14.md',
    'server/cloud-app.ts', 'server/image-assets.ts', 'server/image-routes.ts', 'docs/PILOT_UPDATE_V13.md', 'docs/DESIGN_PREFERENCES.md',
    'server/catalog-inbox.ts', 'server/catalog-workbook.ts', 'src/CatalogInbox.tsx', 'package-lock.json', 'docs/PILOT_UPDATE_V12.md', 'docs/WORKBOOK_PUBLISHING.md',
    'src/CatalogResearch.tsx', 'src/catalog-research.ts', 'server/catalog-research.ts', 'docs/PRODUCT_RESEARCH.md', 'docs/PILOT_UPDATE_V11.md',
    'server/catalog-spreadsheet.ts', 'scripts/build-catalog-workbook.py', 'docs/PILOT_UPDATE_V10.md',
    'src/CatalogReadiness.tsx', 'src/AdminStatus.tsx', 'src/draft-filters.ts',
    'server/catalog-readiness.ts', 'server/draft-list.ts', 'server/catalog-preflight.ts',
    'scripts/catalog-preflight.ts', 'package.json',
    'docs/CATALOG_DELIVERY_READINESS.md', 'docs/DEMONSTRATION_RUNBOOK.md', 'docs/PILOT_UPDATE_V9.md',
    'README.md',
    'src/AdminWorkspace.tsx', 'src/ImageAdmin.tsx', 'src/AIUsage.tsx',
    'docs/ADMIN_WORKSPACE.md', 'docs/PILOT_UPDATE_V8.md',
    'src/SubmissionCenter.tsx', 'server/submissions.ts',
    'db/007-mrf-submissions.sql', 'db/migrations/007-mrf-submissions.sql',
    'docs/MRF_SUBMISSION.md', 'docs/PILOT_UPDATE_V7.md',
    'src/UserAdmin.tsx', 'server/user-access.ts', 'server/auth.ts',
    'db/006-user-access.sql', 'db/migrations/006-user-access.sql',
    'docs/USER_ADMINISTRATION.md', 'docs/PILOT_UPDATE_V6.md',
    'src/draft-storage.ts', 'server/contracts.ts', 'server/repository.ts',
    'db/005-named-drafts.sql', 'db/migrations/005-named-drafts.sql',
    'docs/MRF_COMPLETION_PLAN.md', 'docs/NAMED_DRAFTS_DEMONSTRATION.md', 'docs/PILOT_UPDATE_V5.md',
    'src/CatalogCorrections.tsx', 'server/catalog-history.ts', 'server/store.ts', 'server/sql-store.ts',
    'db/001-azure-sql.sql', 'db/002-catalog.sql', 'db/003-translation-evidence.sql',
    'server/sql-principal.ts', 'scripts/azure-probe.ts', 'scripts/node-cloud.sh',
    'db/004-catalog-revisions.sql', 'db/migrations/004-catalog-revisions.sql',
    'scripts/azure-migrate.ts', 'scripts/migrate-cloud-schema.sh',
    'docs/CATALOG_CORRECTIONS.md', 'docs/PILOT_UPDATE_V4.md',
    'src/ProductPhoto.tsx', 'src/styles.css', 'src/catalog-stream.ts', 'src/App.tsx', 'src/cloud-auth.tsx', 'src/api.ts', 'src/domain.ts', 'src/measurements.ts',
    'src/CatalogAdmin.tsx', 'src/CatalogRelationships.tsx', 'src/JobManufacturerRestrictions.tsx',
    'server/app.ts', 'server/catalog-v2.ts', 'server/catalog-export.ts',
    'scripts/verify-catalog-export.py', 'deploy/check-cloud.py', 'scripts/update-cloud-app.sh',
    'docs/SESSION_DRAFT_REPAIR.md', 'docs/CATALOG_SNAPSHOT.md',
    'docs/LARGE_CATALOG_EXPORT.md', 'docs/CATALOG_ADMIN_WORKFLOWS.md', 'docs/PILOT_UPDATE_V2.md', 'docs/PILOT_UPDATE_V3.md',
]
files += ['docs/PILOT_UPDATE_V49_1.md', 'server/image-contracts.ts', 'scripts/publication-import/prepare-strut.ts', 'scripts/publication-import/start-import.sh', 'scripts/publication-import/status.sh', 'docs/CONTENT_MANAGEMENT.md', 'docs/CMS_ACCEPTANCE.md', 'server/cms.ts', 'db/018-content-management.sql', 'db/migrations/018-content-management.sql', 'scripts/register-cms-surfaces.mjs']
files += [str(path.relative_to(root)) for path in (root / 'src').rglob('*') if path.is_file() and path.suffix in {'.ts', '.tsx', '.css'}]
files = list(dict.fromkeys(files))
files += sorted(str(path.relative_to(root)) for path in (root / 'docs/catalog-starter').iterdir() if path.is_file())
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None and set(archive.namelist()) == set(files)
checksum = hashlib.sha256(output.read_bytes()).hexdigest()
Path(str(output) + '.sha256').write_text(f'{checksum}  {output.name}\n')
print(f'Source-only pilot update prepared: {output.name} ({output.stat().st_size} bytes)')
