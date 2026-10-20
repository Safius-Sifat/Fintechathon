#!/usr/bin/env python3
"""Assert local transport denial without emitting tokens or private responses."""
import json,os,pathlib,subprocess,urllib.request,urllib.error,time
private=pathlib.Path(os.environ['MPC_PRIVATE_DIR'])
root=pathlib.Path(__file__).resolve().parents[2]
credentials=json.loads((private/'transport.json').read_text())
def request(path,method='GET',data=None,authenticated=True):
 req=urllib.request.Request('http://127.0.0.1:18500'+path,method=method,data=data,headers={'X-Consul-Token':credentials['consulToken']} if authenticated else {})
 try:
  with urllib.request.urlopen(req,timeout=5) as response:return response.status
 except urllib.error.HTTPError as error:return error.code
for _ in range(30):
 try:
  if request('/v1/kv/qualification:compat','PUT',b'public-check')==200:break
 except OSError:pass
 time.sleep(1)
else:raise SystemExit('Consul unavailable')
cases=[]
for name,path,method,data,auth,expected in [
 ('colon-key','/v1/kv/qualification:compat','GET',None,True,200),
 ('anonymous-read','/v1/kv/qualification:compat','GET',None,False,403),
 ('anonymous-write','/v1/kv/no-auth','PUT',b'x',False,403),
 ('anonymous-register','/v1/agent/service/register','PUT',b'{"Name":"unauthorized"}',False,403),
 ('traversal','/v1/kv/a/%252e%252e/b','PUT',b'x',True,500)]:
 observed=request(path,method,data,auth)
 if observed!=expected:raise SystemExit(f'{name}: expected{expected}, got{observed}')
 cases.append({'name':name,'httpStatus':observed,'result':'LOCAL_PASS'})
p=subprocess.run([str(root/'.cache/mpcium/bin/qualify'),'transport-denial'],capture_output=True,text=True,check=True)
cases.append(json.loads(p.stdout))
print(json.dumps(cases,indent=2))
