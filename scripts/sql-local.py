"""Prepare an isolated SQL Server Developer container; never expose it publicly."""
from pathlib import Path
import json
import os
import secrets
import subprocess

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / '.runtime' / 'sqlserver'
IMAGE = 'mcr.microsoft.com/mssql/server@sha256:cf8f0ab2ebe61feec2eed2629061a07d247f791c2a8ddda74a4ac9f06a291718'
NAME = 'etalonops-local-sql'
LABEL = 'com.etalonops.purpose=local-sqlserver'
os.umask(0o077)

def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def inspect(kind, name):
    result = subprocess.run(['docker', kind, 'inspect', name], capture_output=True, text=True)
    if result.returncode:
        return None
    return json.loads(result.stdout)[0]

STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
existing = inspect('container', NAME)
if existing:
    if existing['Config'].get('Labels', {}).get('com.etalonops.purpose') != 'local-sqlserver':
        raise SystemExit('Refusing to reuse an unrelated container with the same name.')
    if not (STATE / 'control.json').exists():
        raise SystemExit('Local SQL configuration is missing; refusing to reset existing data.')
    run('openssl', 'x509', '-checkend', '86400', '-noout', '-in', str(STATE / 'server.crt'), stdout=subprocess.DEVNULL)
    if not existing['State']['Running']:
        run('docker', 'start', NAME, stdout=subprocess.DEVNULL)
    print('Existing isolated SQL Server container retained. Run the SQL initialization/readiness command next.')
    raise SystemExit(0)

if not inspect('image', IMAGE):
    run('docker', 'pull', IMAGE)

control = STATE / 'control.json'
if control.exists():
    values = json.loads(control.read_text())
else:
    values = {'saPassword': 'DevA!' + secrets.token_hex(24), 'appPassword': 'AppA!' + secrets.token_hex(24)}
    control.write_text(json.dumps(values))
    control.chmod(0o600)
if not (STATE / 'server.crt').exists():
    commands = [
        ['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-noenc', '-sha256', '-days', '365', '-keyout', 'ca.key', '-out', 'ca.crt', '-subj', '/CN=EtalonOps local development CA'],
        ['openssl', 'req', '-new', '-newkey', 'rsa:2048', '-noenc', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=localhost'],
        ['openssl', 'x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.crt', '-days', '365', '-sha256', '-extfile', 'extensions.cnf'],
    ]
    (STATE / 'extensions.cnf').write_text('subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n')
    for command in commands:
        run(*command, cwd=STATE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
run('openssl', 'verify', '-CAfile', str(STATE / 'ca.crt'), str(STATE / 'server.crt'), stdout=subprocess.DEVNULL)
(STATE / 'mssql.conf').write_text('[network]\nforceencryption = 1\ntlscert = /var/opt/mssql/certs/server.crt\ntlskey = /var/opt/mssql/certs/server.key\ntlsprotocols = 1.2\n[memory]\nmemorylimitmb = 2048\n')
for name in ('etalonops-sql-data', 'etalonops-sql-tls'):
    volume = inspect('volume', name)
    if volume and (volume.get('Labels') or {}).get('com.etalonops.purpose') != 'local-sqlserver':
        raise SystemExit('Refusing to reuse an unrelated Docker volume.')
    if not volume:
        run('docker', 'volume', 'create', '--label', LABEL, name, stdout=subprocess.DEVNULL)
run('docker', 'run', '--rm', '--user', '0', '--entrypoint', '/bin/bash',
    '--mount', f'type=bind,source={STATE},target=/input,readonly',
    '--mount', 'type=volume,source=etalonops-sql-tls,target=/tls',
    '--mount', 'type=volume,source=etalonops-sql-data,target=/data', IMAGE, '-c',
    'cp /input/server.crt /input/server.key /tls/ && cp /input/mssql.conf /data/mssql.conf && chown 10001:0 /data /data/mssql.conf /tls /tls/* && chmod 770 /data /tls && chmod 600 /data/mssql.conf /tls/*',
    stdout=subprocess.DEVNULL)
environment = dict(os.environ, MSSQL_SA_PASSWORD=values['saPassword'])
run('docker', 'run', '-d', '--name', NAME, '--label', LABEL, '--memory', '3g', '--cpus', '2',
    '-p', '127.0.0.1:1433:1433', '--env', 'ACCEPT_EULA=Y', '--env', 'MSSQL_PID=Developer', '--env', 'MSSQL_SA_PASSWORD',
    '--mount', 'type=volume,source=etalonops-sql-data,target=/var/opt/mssql',
    '--mount', 'type=volume,source=etalonops-sql-tls,target=/var/opt/mssql/certs,readonly', IMAGE,
    env=environment, stdout=subprocess.DEVNULL)
print('Started local SQL Server Developer: loopback-only, 2 CPUs / 3 GiB limit, certificate-verified TLS. Readiness is checked separately.')
