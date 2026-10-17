#!/usr/bin/env bash
# Run as root on the dedicated app VM. No financial keys are generated.
set -euo pipefail
umask 077
exec 3>&1
exec >>/var/log/mandate-bootstrap.log 2>&1
trap 'echo "Bootstrap failed; inspect /var/log/mandate-bootstrap.log" >&3' ERR
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q -o DPkg::Lock::Timeout=300 ca-certificates curl gnupg git jq python3 openssl postgresql-16 postgresql-client-16 xz-utils make
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat >/etc/apt/sources.list.d/docker.sources <<'DOCKER'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
DOCKER
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /tmp/mandate-caddy-gpg
[ -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ] || gpg --batch --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/mandate-caddy-gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
chmod 0644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update -q
apt-get install -y -q -o DPkg::Lock::Timeout=300 docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin caddy
systemctl enable --now docker
systemctl stop caddy
work=$(mktemp -d)
cd "$work"
curl -fsSLO https://nodejs.org/dist/v22.23.3/node-v22.23.3-linux-x64.tar.xz
curl -fsSLO https://nodejs.org/dist/v22.23.3/SHASUMS256.txt
grep ' node-v22.23.3-linux-x64.tar.xz$' SHASUMS256.txt | sha256sum --check -
tar -xJf node-v22.23.3-linux-x64.tar.xz -C /usr/local --strip-components=1
cd /
rm -rf "$work"
npm install -g pnpm@10.20.0
id mandate-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash mandate-deploy
usermod -aG docker mandate-deploy
install -d -m0755 /opt/mandate /opt/mandate/bin /opt/mandate/config
for directory in private state releases deployments logs backups; do install -d -o mandate-deploy -g mandate-deploy -m0700 "/opt/mandate/$directory"; done
[ -f /opt/mandate/config/release-mode ] || printf 'foundation\n' >/opt/mandate/config/release-mode
chmod 0644 /opt/mandate/config/release-mode
# Public manifests need parent traversal when mounted into the nonroot container.
chmod 0755 /opt/mandate/deployments
# App VM has a small local database; PostgreSQL does not listen on a public interface.
install -d -o postgres -g postgres -m0700 /etc/postgresql/mandate-tls
if [ ! -f /etc/postgresql/mandate-tls/server.key ]; then
 openssl req -x509 -newkey rsa:3072 -nodes -days 365 -subj '/CN=mandate-local-db' \
   -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' \
   -keyout /etc/postgresql/mandate-tls/server.key -out /etc/postgresql/mandate-tls/server.crt
 chown postgres:postgres /etc/postgresql/mandate-tls/server.*
 chmod 0600 /etc/postgresql/mandate-tls/server.key
 chmod 0644 /etc/postgresql/mandate-tls/server.crt
fi
cat >/etc/postgresql/16/main/conf.d/mandate.conf <<'PG'
listen_addresses = '127.0.0.1'
ssl = on
ssl_cert_file = '/etc/postgresql/mandate-tls/server.crt'
ssl_key_file = '/etc/postgresql/mandate-tls/server.key'
password_encryption = 'scram-sha-256'
shared_buffers = '128MB'
max_connections = 50
PG
cat >/etc/postgresql/16/main/pg_hba.conf <<'HBA'
local all postgres peer
local all all peer
hostssl all all 127.0.0.1/32 scram-sha-256
hostnossl all all 127.0.0.1/32 reject
HBA
chown postgres:postgres /etc/postgresql/16/main/conf.d/mandate.conf /etc/postgresql/16/main/pg_hba.conf
chmod 0640 /etc/postgresql/16/main/conf.d/mandate.conf /etc/postgresql/16/main/pg_hba.conf
systemctl restart postgresql@16-main
pg_isready -h 127.0.0.1 -p 5432
if [ ! -f /opt/mandate/state/database-initialized ]; then
 python3 - <<'PY'
import subprocess,secrets,pathlib,os,pwd
base=pathlib.Path('/opt/mandate/private');owner=pwd.getpwnam('mandate-deploy')
roles={r:secrets.token_hex(32) for r in ['mandate_migrator','mandate_runtime','mandate_backup']}
def sql(text,db='postgres'):
 subprocess.run(['runuser','-u','postgres','--','psql','-X','-v','ON_ERROR_STOP=1','-d',db],input=text,text=True,check=True,stdout=subprocess.DEVNULL)
# Fail on partial pre-existing initialization rather than secretly rotate credentials.
for name,password in roles.items():sql(f"CREATE ROLE {name} LOGIN PASSWORD '{password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;")
sql('CREATE DATABASE mandate OWNER mandate_migrator;')
sql('''REVOKE ALL ON DATABASE mandate FROM PUBLIC;
GRANT CONNECT ON DATABASE mandate TO mandate_migrator,mandate_runtime,mandate_backup;
GRANT pg_read_all_data TO mandate_backup;''')
sql('''REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA mandate AUTHORIZATION mandate_migrator;
GRANT USAGE ON SCHEMA mandate TO mandate_runtime;
CREATE TABLE mandate.schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE mandate.schema_migrations OWNER TO mandate_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE mandate_migrator IN SCHEMA mandate GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO mandate_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE mandate_migrator IN SCHEMA mandate GRANT USAGE,SELECT ON SEQUENCES TO mandate_runtime;
ALTER ROLE mandate_runtime IN DATABASE mandate SET search_path=mandate,public;''','mandate')
files={
'runtime.env':f"APP_ENV=production\nDATABASE_URL=postgresql://mandate_runtime:{roles['mandate_runtime']}@127.0.0.1:5432/mandate\nDATABASE_CA_FILE=/run/db-ca.crt\nDATABASE_SCHEMA=mandate\n",
'migration.env':f"MIGRATION_DATABASE_URL=postgresql://mandate_migrator:{roles['mandate_migrator']}@127.0.0.1:5432/mandate\nMIGRATION_EXPECTED_USER=mandate_migrator\nMIGRATION_SCHEMA=mandate\n",
'backup.env':"PGHOST=127.0.0.1\nPGPORT=5432\nPGDATABASE=mandate\nPGUSER=mandate_backup\nPGSSLMODE=verify-full\nPGSSLROOTCERT=/opt/mandate/private/db-ca.crt\nPGPASSFILE=/opt/mandate/private/backup.pgpass\n",
'backup.pgpass':f"127.0.0.1:5432:mandate:mandate_backup:{roles['mandate_backup']}\n",
'db-ca.crt':pathlib.Path('/etc/postgresql/mandate-tls/server.crt').read_text()
}
for name,value in files.items():
 p=base/name;p.write_text(value);p.chmod(0o600);os.chown(p,owner.pw_uid,owner.pw_gid)
pathlib.Path('/opt/mandate/state/database-initialized').touch()
print('Database and private service credentials initialized')
PY
fi
# Root login and password methods are unnecessary; preserve the existing admin key.
printf 'PermitRootLogin no\nPasswordAuthentication no\nKbdInteractiveAuthentication no\n' >/etc/ssh/sshd_config.d/00-mandate.conf
sshd -t
systemctl reload ssh
printf 'MANDATE_BOOTSTRAP_OK\n' >&3
node --version >&3
pnpm --version >&3
docker --version >&3
psql --version >&3
