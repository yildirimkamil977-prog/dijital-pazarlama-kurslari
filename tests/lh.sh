#!/bin/bash
# Usage: lh.sh <path> -> runs lighthouse mobile+desktop on local prod preview server
cd /root/lh
export CHROME_PATH=/usr/bin/google-chrome
P="${1:-/}"
for mode in mobile desktop; do
  F=""; [ $mode = desktop ] && F="--preset=desktop"
  timeout 110 npx lighthouse "http://localhost:5055$P" $F --quiet --chrome-flags="--headless=new --no-sandbox --disable-gpu" --output=json --output-path=/tmp/lh-$mode.json >/dev/null 2>&1
  python3 - "$mode" <<'E'
import json,sys
m=sys.argv[1];d=json.load(open(f'/tmp/lh-{m}.json'));c=d['categories'];a=d['audits']
print(m,{k:round(v['score']*100) for k,v in c.items()}, ' '.join(a[k]['displayValue'] for k in ['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift']))
for i in a.get('layout-shifts',{}).get('details',{}).get('items',[])[:3]: print('  shift',round(i.get('score',0),3), i.get('node',{}).get('snippet','')[:120])
if m=='mobile':
  for cat in ['accessibility','best-practices','seo']:
    for r in d['categories'][cat]['auditRefs']:
      au=a[r['id']]
      if au.get('score') is not None and au['score']<1 and r.get('weight',0)>0:
        print('  FAIL',r['id'])
        for it in (au.get('details') or {}).get('items',[])[:4]:
          n=it.get('node',{}); print('     ',(n.get('snippet') or str(it.get('description') or it)[:140])[:160])
E
done
