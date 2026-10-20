#!/usr/bin/env python3
"""Run real local MPC qualification; output only public results and hashes."""
import hashlib,json,os,pathlib,subprocess,time,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[2]
PRIVATE=pathlib.Path(os.environ['MPC_PRIVATE_DIR']).resolve()
IMAGE=os.environ['MPC_NODE_IMAGE']
PIN='90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2'
if PRIVATE.is_relative_to(ROOT) or not IMAGE.startswith('sha256:'):raise SystemExit('External private directory and immutable image ID required')
assert subprocess.check_output(['git','-C',str(ROOT/'vendor/mpcium'),'rev-parse','HEAD'],text=True).strip()==PIN
assert not subprocess.check_output(['git','-C',str(ROOT/'vendor/mpcium'),'status','--porcelain'],text=True).strip()
configs=[json.loads((PRIVATE/f'node{i}/config.json').read_text()) for i in range(3)]
for cfg in configs:
 assert cfg['mpc_threshold']==1 and cfg['max_concurrent_keygen']==1 and cfg['max_concurrent_signing']==1
 auth=cfg['authorization'];assert auth['enabled'] and auth['required_authorizers']==['mandate-policy-v1']
 assert auth['authorizer_public_keys']['mandate-policy-v1']['public_key']==json.loads((PRIVATE/'authorizer/mandate-policy-v1.authorizer.identity.json').read_text())['public_key']
 assert cfg['event_initiator_pubkey']==json.loads((PRIVATE/'initiator/mandate-adapter-a.identity.json').read_text())['public_key']
 assert len(bytes.fromhex(cfg['chain_code']))==32
assert len({c['chain_code'] for c in configs})==1
assert len({(PRIVATE/f'node{i}/db-password').read_text() for i in range(3)})==3
compose=['docker','compose','-f',str(ROOT/'infra/release/compose.mpcium.yaml')]
cli=str(ROOT/'.cache/mpcium/bin/qualify')
logdir=PRIVATE/('run-'+time.strftime('%Y%m%dT%H%M%S'));logdir.mkdir(mode=0o700)
public=pathlib.Path(os.environ.get('MPC_PUBLIC_DIR',str(ROOT/('evidence/person2/artifacts/mpc-local-'+time.strftime('%Y%m%dT%H%M%S')))));public.mkdir(parents=True,exist_ok=True)
def docker(*args):subprocess.run([*compose,*args],check=True,stdout=subprocess.DEVNULL)
def run(name,mode,fail=False):
 env=dict(os.environ);env['MPC_EXPECT_FAILURE']='1' if fail else '0'
 p=subprocess.run([cli,mode],env=env,capture_output=True,text=True)
 (logdir/(name+'.txt')).write_text(p.stdout+p.stderr)
 if p.returncode:raise RuntimeError(f'{name} failed with exit{p.returncode}; private diagnostic retained')
 start=p.stdout.rfind('{\n  "walletId"')
 if start<0:raise RuntimeError('missing public qualification result')
 value=json.loads(p.stdout[start:]);(public/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n');return value
try:
 docker('up','-d','nats','consul');time.sleep(5)
 transport=subprocess.run(['python3',str(ROOT/'infra/scripts/check-mpc-transport.py')],check=True,capture_output=True,text=True);(public/'transport-denials.json').write_text(transport.stdout)
 docker('up','-d','node0','node1','node2');time.sleep(20)
 for service in ['nats','consul','node0','node1','node2']:
  cid=subprocess.check_output([*compose,'ps','-q',service],text=True).strip();info=json.loads(subprocess.check_output(['docker','inspect',cid]))[0]
  for bindings in (info['HostConfig']['PortBindings'] or {}).values():
   for binding in bindings:assert binding['HostIp']=='127.0.0.1'
  if service.startswith('node'):assert info['Image']==IMAGE
 if not (PRIVATE/'public-wallet.json').exists():run('dkg','dkg')
 run('twenty-signatures','sign20')
 for down,pair in [(2,'01'),(1,'02'),(0,'12')]:
  docker('stop',f'node{down}');time.sleep(12);run('pair-'+pair,'sign');docker('start',f'node{down}');time.sleep(15)
 for alone in range(3):
  stopped=[f'node{i}' for i in range(3) if i!=alone];docker('stop',*stopped);time.sleep(12);run('single-'+str(alone),'sign',True);docker('start',*stopped);time.sleep(15)
 docker('stop','node0');time.sleep(12);run('outage-one','sign');docker('stop','node1');time.sleep(12);run('outage-two','sign',True);docker('start','node0','node1');time.sleep(15);run('restart-persistent-share','sign')
 for mode in ['deny-missing','deny-wrong','deny-mutated']:run(mode,mode,True)
 p=subprocess.run([cli,'transport-denial'],capture_output=True,text=True,check=True);(public/'nats-denial.json').write_text(p.stdout)
 info=json.loads(subprocess.check_output(['docker','info','--format','{{json .}}']))
 (public/'host-resources.json').write_text(json.dumps({'dockerVersion':info['ServerVersion'],'dockerCPUs':info['NCPU'],'dockerMemoryBytes':info['MemTotal'],'azure4GiBQualification':False},indent=2)+'\n')
 (public/'config-hashes.json').write_text(json.dumps({f'node{i}':hashlib.sha256((PRIVATE/f'node{i}/config.json').read_bytes()).hexdigest() for i in range(3)},indent=2)+'\n')
 print('LOCAL_PASS: real local DKG, signatures, quorum, outages and denials; financial/public-chain gates remain incomplete')
finally:
 # Restore only this dedicated project; never remove private files or volumes.
 docker('start','node0','node1','node2')
