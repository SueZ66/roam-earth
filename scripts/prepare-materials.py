"""Rebuild local PBR assets from Poly Haven. Requires Python 3 + Pillow.

HTTPS_PROXY is supported. Original downloads are cached outside public/.
All originals are MD5-verified against the provider's API before conversion.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import os
import urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'work' / 'material-originals'
OUT = ROOT / 'public' / 'textures' / 'pbr'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
MATERIALS = {
    'grass': ('rocky_terrain_02', 90.0, '4k'),
    'rock': ('dark_rock_02', 2.001, '4k'),
    'sand': ('damp_beach_sand_02', 1.87, '2k'),
    'dune': ('sand_03', 2.0, '2k'),
    'snow': ('snow_02', 2.0, '2k'),
    'cliff': ('rocky_terrain', 90.0, '2k'),
}

def request(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'RoamEarth/1.0'}), timeout=90).read()

def fetch_verified(item):
    path = CACHE / item['url'].rsplit('/', 1)[1]
    if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest() != item['md5']:
        for attempt in range(3):
            try:
                data = request(item['url'])
                if hashlib.md5(data).hexdigest() != item['md5']:
                    raise ValueError('MD5 mismatch: ' + item['url'])
                path.write_bytes(data)
                break
            except Exception:
                if attempt == 2: raise
    return path

def material(entry):
    name, (asset, metres, resolution) = entry
    info = json.loads(request(f'https://api.polyhaven.com/info/{asset}'))
    files = json.loads(request(f'https://api.polyhaven.com/files/{asset}'))
    def variant(channel, size):
        key = next(k for k in files if k.lower() == channel.lower())
        return files[key][size]['jpg']
    channels = {'diff': variant('Diffuse', resolution), 'normal': variant('nor_gl', '2k'),
                'arm': variant('arm', '2k'), 'height': variant('Displacement', '2k')}
    with ThreadPoolExecutor(max_workers=4) as pool:
        downloaded = dict(zip(channels, pool.map(fetch_verified, channels.values())))
    albedo = Image.open(downloaded['diff']).convert('RGB')
    normal = Image.open(downloaded['normal']).convert('RGB')
    arm = Image.open(downloaded['arm']).convert('RGB')
    height = Image.open(downloaded['height']).convert('L').resize(arm.size, Image.Resampling.LANCZOS)
    # The metallic channel is unused for these dielectrics; carry height there.
    packed = Image.merge('RGB', (arm.getchannel('R'), arm.getchannel('G'), height))
    outputs = []
    for tier, maximum in [('desktop',4096),('mobile',1024)]:
        folder = OUT / tier
        folder.mkdir(exist_ok=True)
        for suffix, source in [('diff', albedo),('normal', normal),('surface',packed)]:
            image = source.copy()
            image.thumbnail((maximum,maximum),Image.Resampling.LANCZOS)
            target = folder / f'{name}-{suffix}.webp'
            image.save(target, 'WEBP', quality=95 if suffix != 'diff' else 92, method=6)
            outputs.append({'file':str(target.relative_to(ROOT/'public')).replace('\\','/'),
                            'width':image.width,'height':image.height,
                            'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    print(f'{name}: {asset}, {albedo.width}x{albedo.height}, {len(outputs)} outputs', flush=True)
    return {'kind':name,'asset':asset,'metres':metres,'license':'CC0-1.0',
            'page':f'https://polyhaven.com/a/{asset}', 'authors':info.get('authors',{}),
            'published':info.get('date_published'), 'sources':channels, 'outputs':outputs}

if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=3) as pool:
        result = list(pool.map(material, MATERIALS.items()))
    (OUT/'sources.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print('Verified and wrote all material variants.', flush=True)
