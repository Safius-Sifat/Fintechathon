#!/usr/bin/env bash
set -euo pipefail
cloud-init status --wait >/dev/null
python3 - <<'PY'
import json,os
memory = next(int(line.split()[1]) for line in open('/proc/meminfo') if line.startswith('MemTotal:'))
assert os.cpu_count() == 2
assert memory > 3500000
print(json.dumps({'hostname':os.uname().nodename,'architecture':os.uname().machine,'vcpus':os.cpu_count(),'memoryKiB':memory}))
PY
systemctl start ssh.service
systemctl is-active --quiet ssh.service
/usr/sbin/sshd -T | awk '/^(passwordauthentication|permitrootlogin|pubkeyauthentication) /'
printf 'SSH_HOST_KEY '
cat /etc/ssh/ssh_host_ed25519_key.pub
printf 'MANDATE_VM_READY\n'
