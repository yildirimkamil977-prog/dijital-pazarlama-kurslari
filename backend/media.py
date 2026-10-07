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
