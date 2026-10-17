#!/usr/bin/env bash
set -euo pipefail
umask 077
# Ledger is pre-created with migration-owner privileges, before automatic app-table grants.
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 -d mandate <<'SQL'
CREATE TABLE IF NOT EXISTS mandate.schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE mandate.schema_migrations OWNER TO mandate_migrator;
REVOKE ALL ON mandate.schema_migrations FROM mandate_runtime,PUBLIC;
SQL
cat >/etc/caddy/Caddyfile <<'CADDY'
{
  admin off
}
mandate-demo-04323111.malaysiawest.cloudapp.azure.com {
  encode zstd gzip
  header -Server
  reverse_proxy 127.0.0.1:3000
}
CADDY
chmod 0644 /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable caddy
systemctl restart caddy
# Check least privileges using verified TLS; no connection strings appear in output.
python3 - <<'PY'
import os,pathlib,subprocess,urllib.parse
text=pathlib.Path('/opt/mandate/private/runtime.env').read_text();url=next(x.split('=',1)[1] for x in text.splitlines() if x.startswith('DATABASE_URL='));u=urllib.parse.urlparse(url)
env={**os.environ,'PGHOST':u.hostname,'PGPORT':'5432','PGUSER':u.username,'PGPASSWORD':u.password,'PGDATABASE':u.path[1:],'PGSSLMODE':'verify-full','PGSSLROOTCERT':'/opt/mandate/private/db-ca.crt'}
def query(sql):return subprocess.run(['psql','-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-At'],input=sql,env=env,text=True,capture_output=True)
p=query('SELECT 1;');assert p.returncode==0,'Runtime TLS connection failed'
for sql in ['BEGIN;CREATE TABLE mandate.forbidden_runtime_ddl(id int);ROLLBACK;', 'BEGIN;UPDATE mandate.schema_migrations SET sha256=sha256;ROLLBACK;']:
 p=query(sql);assert p.returncode!=0 and '42501' in p.stderr,'Runtime privilege boundary failed'
print('RUNTIME_TLS_OK; DDL_DENIED; MIGRATION_LEDGER_WRITE_DENIED')
PY
printf 'MANDATE_APP_HOST_CONFIGURED\n'

# The API cannot obtain the host identity and its migration/backup secrets.
cat >/opt/mandate/bin/runtime-network-policy <<'POLICY'
#!/bin/bash
set -euo pipefail
iptables -w -C OUTPUT -d 169.254.169.254/32 -m owner --uid-owner 10001 -j REJECT 2>/dev/null || iptables -w -I OUTPUT -d 169.254.169.254/32 -m owner --uid-owner 10001 -j REJECT
POLICY
chmod 0755 /opt/mandate/bin/runtime-network-policy
cat >/etc/systemd/system/mandate-runtime-network.service <<'UNIT'
[Unit]
Description=Block app runtime access to Azure VM identity
After=network-pre.target
Before=docker.service caddy.service
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/opt/mandate/bin/runtime-network-policy
[Install]
WantedBy=multi-user.target
UNIT
install -d -m0755 /etc/systemd/system/docker.service.d
cat >/etc/systemd/system/docker.service.d/mandate-runtime.conf <<'DOCKERUNIT'
[Unit]
Requires=mandate-runtime-network.service
After=mandate-runtime-network.service
DOCKERUNIT
systemctl daemon-reload
systemctl enable --now mandate-runtime-network.service
printf 'API_IDENTITY_BOUNDARY_CONFIGURED\n'
