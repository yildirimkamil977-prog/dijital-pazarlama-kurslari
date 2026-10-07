import io
import asyncio
import base64
import logging
from collections import OrderedDict
from PIL import Image, ImageOps
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from deps import db

logger = logging.getLogger(__name__)
MAX_W = 1920
SKIP = ("image/svg+xml", "image/gif")
_cache: "OrderedDict[tuple, bytes]" = OrderedDict()


def _to_webp(content: bytes, max_w: int) -> bytes:
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(content)))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    if img.width > max_w:
        img.thumbnail((max_w, max_w * 4), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, "WEBP", quality=80, method=4)
    return out.getvalue()


async def optimize_image(content: bytes, ct: str):
    if ct in SKIP:
        return content, ct
    try:
        return await asyncio.to_thread(_to_webp, content, MAX_W), "image/webp"
    except Exception:
        return content, ct


async def resized(upload_id: str, content: bytes, w: int) -> bytes:
    key = (upload_id, w)
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    try:
        data = await asyncio.to_thread(_to_webp, content, w)
    except Exception:
        return content
    _cache[key] = data
    if len(_cache) > 300:
        _cache.popitem(last=False)
    return data


async def _remote_thumb(url: str) -> str:
    import re
    import httpx
    m = re.search(r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/|live/))([\w-]{6,})", url)
    async with httpx.AsyncClient(timeout=8, follow_redirects=True) as cl:
        if m:
            for q in ("maxresdefault", "hqdefault"):
                r = await cl.get(f"https://i.ytimg.com/vi/{m.group(1)}/{q}.jpg")
                if r.status_code == 200 and len(r.content) > 2000:
                    return r.content
            return b""
        m = re.search(r"vimeo\.com/(?:video/)?(\d+)", url)
        if not m:
            return b""
        r = await cl.get("https://vimeo.com/api/oembed.json", params={"url": f"https://vimeo.com/{m.group(1)}", "width": 1280})
        if r.status_code == 200 and r.json().get("thumbnail_url"):
            r = await cl.get(r.json()["thumbnail_url"])
        else:
            r = await cl.get(f"https://vumbnail.com/{m.group(1)}_large.jpg")
        return r.content if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/") else b""


async def video_thumb(url: str) -> str:
    """Downloads the video's cover frame, stores it as optimized WebP, returns its /api/uploads URL."""
    from deps import new_id, now_utc
    if not url:
        return ""
    try:
        content = await _remote_thumb(url)
    except Exception:
        content = b""
    if not content:
        return ""
    content, ct = await optimize_image(content, "image/jpeg")
    uid = new_id("img")
    gid = await AsyncIOMotorGridFSBucket(db).upload_from_stream(uid, content, metadata={"content_type": ct})
    await db.uploads.insert_one({"upload_id": uid, "content_type": ct, "gridfs_id": gid, "optimized": True, "created_at": now_utc().isoformat()})
    return f"/api/uploads/{uid}"


async def migrate_images():
    """One-time: convert legacy uploaded images to optimized WebP in GridFS (same upload_id/URL)."""
    bucket = AsyncIOMotorGridFSBucket(db)
    q = {"content_type": {"$regex": "^image/", "$nin": ["image/webp", *SKIP]}, "optimized": {"$ne": True}}
    n = 0
    async for doc in db.uploads.find(q):
        try:
            if doc.get("gridfs_id"):
                content = await (await bucket.open_download_stream(doc["gridfs_id"])).read()
            else:
                content = base64.b64decode(doc["data"])
            new, ct = await optimize_image(content, doc["content_type"])
            gid = await bucket.upload_from_stream(doc["upload_id"], new, metadata={"content_type": ct})
            await db.uploads.update_one({"_id": doc["_id"]}, {"$set": {"gridfs_id": gid, "content_type": ct, "optimized": True}, "$unset": {"data": ""}})
            if doc.get("gridfs_id"):
                await bucket.delete(doc["gridfs_id"])
            n += 1
        except Exception as e:
            logger.warning("image migrate failed %s: %s", doc.get("upload_id"), e)
    if n:
        logger.info("Optimized %d legacy images", n)
