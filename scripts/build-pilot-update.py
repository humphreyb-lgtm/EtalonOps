"""Build the source-only update for the existing West US 3 pilot.

The original deployment directory must already contain dependencies and runtime
state. No state, credentials, dependencies, database or image files are packaged.
"""
from pathlib import Path
import hashlib
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
output = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/EtalonOps-pilot-update-v16.zip')
files = [
    'docs/PILOT_UPDATE_V16.md', 'docs/AZURE_RESEARCH.md', 'docs/LIVE_AI_ACTIVATION.md', 'scripts/enable-azure-research.py',
    'server/cloud-config.ts', 'server/cloud-main.ts', 'server/ai-provider.ts', 'server/azure-research.ts', 'server/research-policy.ts', 'server/research-ledger.ts', 'server/research-source.ts', 'server/research-pdf.ts', 'server/research-routes.ts', 'server/research-selection.ts', 'src/LiveResearch.tsx',
    'docs/PILOT_UPDATE_V15.md', 'server/catalog-publication.ts', 'docs/PILOT_UPDATE_V14.md',
    'server/cloud-app.ts', 'server/image-routes.ts', 'docs/PILOT_UPDATE_V13.md', 'docs/DESIGN_PREFERENCES.md',
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
files += sorted(str(path.relative_to(root)) for path in (root / 'docs/catalog-starter').iterdir() if path.is_file())
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None and set(archive.namelist()) == set(files)
checksum = hashlib.sha256(output.read_bytes()).hexdigest()
Path(str(output) + '.sha256').write_text(f'{checksum}  {output.name}\n')
print(f'Source-only pilot update prepared: {output.name} ({output.stat().st_size} bytes)')
