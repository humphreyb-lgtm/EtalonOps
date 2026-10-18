"""Build the source-only update for the existing West US 3 pilot.

The original deployment directory must already contain dependencies and runtime
state. No state, credentials, dependencies, database or image files are packaged.
"""
from pathlib import Path
import hashlib
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
output = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/EtalonOps-pilot-update-v3.zip')
files = [
    'src/ProductPhoto.tsx', 'src/styles.css', 'src/catalog-stream.ts', 'src/App.tsx', 'src/cloud-auth.tsx', 'src/api.ts', 'src/domain.ts', 'src/measurements.ts',
    'src/CatalogAdmin.tsx', 'src/CatalogRelationships.tsx', 'src/JobManufacturerRestrictions.tsx',
    'server/app.ts', 'server/catalog-v2.ts', 'server/catalog-export.ts',
    'scripts/verify-catalog-export.py', 'deploy/check-cloud.py', 'scripts/update-cloud-app.sh',
    'docs/SESSION_DRAFT_REPAIR.md', 'docs/CATALOG_SNAPSHOT.md',
    'docs/LARGE_CATALOG_EXPORT.md', 'docs/CATALOG_ADMIN_WORKFLOWS.md', 'docs/PILOT_UPDATE_V2.md', 'docs/PILOT_UPDATE_V3.md',
]
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None and set(archive.namelist()) == set(files)
checksum = hashlib.sha256(output.read_bytes()).hexdigest()
Path(str(output) + '.sha256').write_text(f'{checksum}  {output.name}\n')
print(f'Source-only pilot update prepared: {output.name} ({output.stat().st_size} bytes)')
