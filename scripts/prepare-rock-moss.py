"""Download the CC0 Poly Haven rock set, verify originals and prepare 2K WebP.

Run with Python 3 and Pillow. Original glTF, binary and JPEG files are retained.
Only public/models/rock-moss is written; existing valid downloads are reused.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "models" / "rock-moss"
ASSET_ID = "rock_moss_set_01"
API_URL = f"https://api.polyhaven.com/files/{ASSET_ID}"
USER_AGENT = "RoamEarth-asset-preparation/1.0"


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=90) as response:
        return response.read()


def checksum(data, algorithm="md5"):
    return hashlib.new(algorithm, data).hexdigest()


def local_path(relative):
    target = (OUTPUT / relative).resolve()
    if not target.is_relative_to(OUTPUT.resolve()):
        raise ValueError(f"Unexpected asset path: {relative}")
    return target


def download(job):
    relative, source = job
    if urlparse(source["url"]).hostname != "dl.polyhaven.org":
        raise ValueError("Unexpected download host")
    target = local_path(relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    data = target.read_bytes() if target.exists() else b""
    if checksum(data) != source["md5"]:
        data = fetch(source["url"])
    if len(data) != source["size"] or checksum(data) != source["md5"]:
        raise ValueError(f"Size or API MD5 mismatch: {relative}")
    target.write_bytes(data)
    return {
        "path": relative, "url": source["url"], "bytes": len(data),
        "apiMd5": source["md5"], "verifiedMd5": checksum(data),
        "sha256": checksum(data, "sha256"),
    }


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    entry = json.loads(fetch(API_URL))["gltf"]["2k"]["gltf"]
    original_name = f"{ASSET_ID}_2k.original.gltf"
    jobs = [(original_name, entry), *entry["include"].items()]
    with ThreadPoolExecutor(max_workers=5) as executor:
        originals = list(executor.map(download, jobs))

    document = json.loads(local_path(original_name).read_text(encoding="utf-8"))
    derived = []
    for image in document.get("images", []):
        source_uri = image["uri"]
        source = local_path(source_uri)
        destination = source.with_suffix(".webp")
        # High-quality normal data limits shading changes from lossy re-encoding.
        quality = 96 if "_nor_" in source.name else 90
        with Image.open(source) as texture:
            texture = texture.convert("RGB")
            texture.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
            size = list(texture.size)
            texture.save(destination, format="WEBP", quality=quality, method=6)
        relative = destination.relative_to(OUTPUT).as_posix()
        data = destination.read_bytes()
        derived.append({
            "path": relative, "sourcePath": source_uri,
            "sourceMd5": checksum(source.read_bytes()),
            "derivedMd5": checksum(data), "sha256": checksum(data, "sha256"),
            "bytes": len(data), "dimensions": size,
            "conversion": {"format": "WebP", "quality": quality, "method": 6},
        })
        image["uri"] = relative
        image["mimeType"] = "image/webp"

    # WebP is a glTF extension; declare it instead of relying on a permissive loader.
    for texture in document.get("textures", []):
        source_index = texture.pop("source")
        texture.setdefault("extensions", {})["EXT_texture_webp"] = {"source": source_index}
    for key in ("extensionsUsed", "extensionsRequired"):
        document[key] = sorted(set(document.get(key, []) + ["EXT_texture_webp"]))

    runtime_name = "rock-moss.gltf"
    runtime_data = (json.dumps(document, indent=2) + "\n").encode("utf-8")
    local_path(runtime_name).write_bytes(runtime_data)
    derived.append({
        "path": runtime_name, "sourcePath": original_name,
        "sourceMd5": entry["md5"], "derivedMd5": checksum(runtime_data),
        "sha256": checksum(runtime_data, "sha256"), "bytes": len(runtime_data),
        "conversion": "Original scene and geometry; texture references changed to EXT_texture_webp.",
    })

    # Ensure both variants are self-contained before publishing the manifest.
    for name in (original_name, runtime_name):
        doc = json.loads(local_path(name).read_text(encoding="utf-8"))
        for item in doc.get("images", []) + doc.get("buffers", []):
            assert local_path(item["uri"]).is_file(), item["uri"]
        for buffer in doc.get("buffers", []):
            assert local_path(buffer["uri"]).stat().st_size == buffer["byteLength"]

    manifest = {
        "asset": ASSET_ID, "title": "Rock Moss Set 01", "provider": "Poly Haven",
        "assetUrl": f"https://polyhaven.com/a/{ASSET_ID}", "filesApi": API_URL,
        "license": "CC0-1.0", "licenseUrl": "https://polyhaven.com/license",
        "preparedAt": datetime.now(timezone.utc).isoformat(),
        "runtimeEntry": runtime_name, "originalEntry": original_name,
        "originals": originals, "derived": derived,
        "notes": [
            "All original files were checked against the byte sizes and MD5 hashes returned by the Poly Haven files API.",
            "Geometry and node transforms are unchanged. Original JPEG textures and original glTF are retained.",
            "WebP textures are 2048 x 2048; normal map encoding is OpenGL as provided by the asset.",
            "Preparation script: scripts/prepare-rock-moss.py. Requires Python 3 and Pillow.",
        ],
    }
    local_path("sources.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    triangles = sum(
        document["accessors"][primitive["indices"]]["count"] // 3
        for mesh in document.get("meshes", []) for primitive in mesh["primitives"]
    )
    runtime_bytes = len(runtime_data) + sum(
        local_path(item["uri"]).stat().st_size
        for item in document.get("images", []) + document.get("buffers", [])
    )
    print(json.dumps({
        "entry": runtime_name, "originalsVerified": len(originals),
        "meshes": len(document.get("meshes", [])), "triangles": triangles,
        "runtimeBytes": runtime_bytes, "derived": derived,
    }, indent=2))


if __name__ == "__main__":
    main()
