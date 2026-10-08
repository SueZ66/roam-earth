"""Download verified desktop/mobile daylight HDRs from Poly Haven (CC0)."""
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'textures'
ASSET = 'kloofendal_48d_partly_cloudy_puresky'

def request(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'RoamEarth/1.0'}), timeout=120) as response:
        return response.read()

if __name__ == '__main__':
    files = json.loads(request(f'https://api.polyhaven.com/files/{ASSET}'))
    records = []
    for resolution, name in [('4k','sky-4k.hdr'),('1k','sky-mobile.hdr')]:
        source = files['hdri'][resolution]['hdr']
        data = request(source['url'])
        if hashlib.md5(data).hexdigest() != source['md5']:
            raise ValueError('HDR checksum mismatch')
        (ROOT/name).write_bytes(data)
        records.append({'file':name,'source':source['url'],'md5':source['md5'],
                        'verified':True,'license':'CC0-1.0','asset':ASSET})
    (ROOT/'sky-sources.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf8')
