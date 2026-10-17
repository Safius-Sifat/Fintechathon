# Run on the app VM once. Never prints configuration values or bearer tokens.
import json, urllib.request, urllib.parse, urllib.error, pathlib, pwd, os, time
vault='https://mandate-app-kv-04323111.vault.azure.net'
base=pathlib.Path('/opt/mandate/private')
request=urllib.request.Request('http://169.254.169.254/metadata/identity/oauth2/token?'+urllib.parse.urlencode({'api-version':'2018-02-01','resource':'https://vault.azure.net'}),headers={'Metadata':'true'})
token=json.load(urllib.request.urlopen(request,timeout=15))['access_token']
entries=[]
for name in ['runtime.env','migration.env','backup.env','backup.pgpass','db-ca.crt']:
 value=(base/name).read_text()
 body=json.dumps({'value':value,'contentType':'text/plain','tags':{'project':'mandate','purpose':'app-infrastructure'}}).encode()
 req=urllib.request.Request(vault+'/secrets/'+name.replace('.','-')+'?api-version=7.4',data=body,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='PUT')
 for attempt in range(18):
  try:
   result=json.load(urllib.request.urlopen(req,timeout=20));break
  except urllib.error.HTTPError as e:
   if e.code!=403 or attempt==17:raise RuntimeError('Vault initialization denied: '+str(e.code)) from None
   time.sleep(10)
 entries.append({'file':name,'secretId':result['id']})
p=base/'key-vault-map.json';p.write_text(json.dumps({'schemaVersion':1,'entries':entries},indent=2)+'\n');p.chmod(0o600)
user=pwd.getpwnam('mandate-deploy');os.chown(p,user.pw_uid,user.pw_gid)
print('APP_VAULT_INITIALIZED: '+str(len(entries))+' version-pinned entries')
