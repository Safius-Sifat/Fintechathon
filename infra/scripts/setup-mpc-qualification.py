#!/usr/bin/env python3
"""Generate disposable LOCAL qualification identities using the pinned upstream CLI."""
import json, os, pathlib, secrets, shutil, subprocess, pty, select, time
ROOT=pathlib.Path(__file__).resolve().parents[2]
PIN='90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2'
private=pathlib.Path(os.environ['MPC_PRIVATE_DIR']).resolve()
if private.is_relative_to(ROOT) or private.exists(): raise SystemExit('Use a fresh private directory outside the checkout; existing files are preserved')
assert subprocess.check_output(['git','-C',str(ROOT/'vendor/mpcium'),'rev-parse','HEAD'],text=True).strip()==PIN
assert not subprocess.check_output(['git','-C',str(ROOT/'vendor/mpcium'),'status','--porcelain'],text=True).strip()
os.umask(0o077);private.mkdir(parents=True)
cli=str(ROOT/'.cache/mpcium/bin/mpcium-cli')
def run(*args): subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
def encrypted(args,password):
 master,slave=pty.openpty();p=subprocess.Popen([cli,*args,'--encrypt'],stdin=slave,stdout=slave,stderr=slave);os.close(slave)
 data=b'';sent=0;deadline=time.monotonic()+90
 while p.poll() is None and time.monotonic()<deadline:
  ready,_,_=select.select([master],[],[],1)
  if ready:
   try:data+=os.read(master,4096)
   except OSError:break
   prompts=data.count(b'Enter passphrase to encrypt private key:')+data.count(b'Confirm passphrase:')
   if prompts>sent:os.write(master,(password+'\n').encode());sent+=1
 if p.poll() is None:p.wait(timeout=10)
 os.close(master)
 if p.returncode or sent!=2:raise RuntimeError('pinned CLI identity generation failed (private output withheld)')
run(cli,'generate-peers','-n','3','--output',str(private/'peers.json'))
for kind,args in [('initiator',['generate-initiator','--node-name','mandate-adapter-a']),('authorizer',['generate-authorizer','--name','mandate-policy-v1'])]:
 d=private/kind;d.mkdir();password=secrets.token_hex(16)+'!';(d/'password').write_text(password)
 encrypted([*args,'--output-dir',str(d)],password)
for i in range(3):
 d=private/f'node{i}';(d/'identity').mkdir(parents=True);password=secrets.token_hex(16)+'!';(d/'identity-password').write_text(password);(d/'db-password').write_text(secrets.token_hex(16))
 encrypted(['generate-identity','--node',f'node{i}','--peers',str(private/'peers.json'),'--output-dir',str(d/'identity')],password)
for i in range(3):
 d=private/f'node{i}';shutil.copy(private/'peers.json',d/'peers.json')
 for j in range(3):
  if i!=j:shutil.copy(private/f'node{j}/identity/node{j}_identity.json',d/'identity')
tls=private/'tls';tls.mkdir()
run('openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','2','-subj','/CN=mandate-local-qualification','-keyout',str(tls/'ca.key'),'-out',str(tls/'ca.crt'))
(tls/'extensions').write_text('subjectAltName=DNS:nats,DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth,clientAuth\n')
run('openssl','req','-newkey','rsa:2048','-nodes','-subj','/CN=nats','-keyout',str(tls/'transport.key'),'-out',str(tls/'transport.csr'))
run('openssl','x509','-req','-in',str(tls/'transport.csr'),'-CA',str(tls/'ca.crt'),'-CAkey',str(tls/'ca.key'),'-CAcreateserial','-days','2','-extfile',str(tls/'extensions'),'-out',str(tls/'transport.crt'))
(tls/'runtime').mkdir()
for filename in ['ca.crt','transport.crt','transport.key']:shutil.copy(tls/filename,tls/'runtime'/filename)
natsPassword=secrets.token_hex(24);token=secrets.token_hex(16);chain=secrets.token_hex(32)
(private/'transport.json').write_text(json.dumps({'natsPassword':natsPassword,'consulToken':token}))
(private/'nats.conf').write_text(f'''port:4222
jetstream {{store_dir:"/data"}}
tls {{cert_file:"/tls/transport.crt",key_file:"/tls/transport.key",ca_file:"/tls/ca.crt",verify:true}}
authorization {{users:[{{user:mandate,password:"{natsPassword}",permissions:{{publish:[">"],subscribe:[">"]}}}}]}}
''')
(private/'consul.hcl').write_text(f'''disable_kv_key_validation=false
datacenter="mandate-local"
data_dir="/consul/data"
server=true
bootstrap_expect=1
bind_addr="0.0.0.0"
client_addr="0.0.0.0"
acl {{enabled=true,default_policy="deny",enable_token_persistence=true,tokens {{initial_management="{token}",agent="{token}"}}}}
''')
initiator=json.loads((private/'initiator/mandate-adapter-a.identity.json').read_text())['public_key'];authorizer=json.loads((private/'authorizer/mandate-policy-v1.authorizer.identity.json').read_text())['public_key']
for i in range(3):
 cfg={'environment':'production','nats':{'url':'tls://nats:4222','username':'mandate','password':natsPassword,'tls':{'client_cert':'/tls/transport.crt','client_key':'/tls/transport.key','ca_cert':'/tls/ca.crt'}},'consul':{'address':'consul:8500','token':token},'mpc_threshold':1,'event_initiator_pubkey':initiator,'event_initiator_algorithm':'ed25519','chain_code':chain,'max_concurrent_keygen':1,'max_concurrent_signing':1,'session_warm_up_delay_ms':500,'db_path':'/shares/db','backup_enabled':True,'backup_period_seconds':60,'backup_dir':'/shares/backups','authorization':{'enabled':True,'required_authorizers':['mandate-policy-v1'],'authorizer_public_keys':{'mandate-policy-v1':{'public_key':authorizer,'algorithm':'ed25519'}}}}
 (private/f'node{i}/config.json').write_text(json.dumps(cfg,indent=2))
(private/'wallet-id').write_text(__import__('uuid').uuid4().__str__())
print('Created isolated qualification material outside Git. Private directory: '+str(private))
