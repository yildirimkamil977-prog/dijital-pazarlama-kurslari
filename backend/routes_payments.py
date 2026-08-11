import base64
import hashlib
import hmac
import json
import os

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Optional

from deps import (
    db, now_utc, new_id, get_current_user, get_paytr_credentials, schedule_email,
)

router = APIRouter(prefix="/payments")

FRONTEND_URL = os.environ.get("CORS_ORIGINS", "").split(",")[0]


class CheckoutItem(BaseModel):
    course_id: str


class CheckoutIn(BaseModel):
    items: List[CheckoutItem]
    discount_code: Optional[str] = None


async def _price_of(course: dict) -> float:
    dp = course.get("discount_price")
    if dp is not None and dp >= 0:
        return float(dp)
    return float(course.get("price", 0))


async def _apply_discount(code: Optional[str], subtotal: float):
    if not code:
        return 0.0, None
    doc = await db.discount_codes.find_one({"code": code.upper(), "active": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=400, detail="Geçersiz indirim kodu")
    if doc.get("usage_limit") and doc.get("used_count", 0) >= doc["usage_limit"]:
        raise HTTPException(status_code=400, detail="İndirim kodu kullanım limiti doldu")
    if doc.get("min_amount") and subtotal < doc["min_amount"]:
        raise HTTPException(status_code=400, detail=f"Bu kod min. {doc['min_amount']} TL için geçerli")
    if doc["type"] == "percent":
        disc = subtotal * (doc["value"] / 100.0)
    else:
        disc = float(doc["value"])
    return min(disc, subtotal), doc["code"]


@router.post("/validate-discount")
async def validate_discount(body: dict, request: Request):
    await get_current_user(request)
    code = body.get("code")
    subtotal = float(body.get("subtotal", 0))
    disc, applied = await _apply_discount(code, subtotal)
    return {"discount": round(disc, 2), "code": applied, "total": round(subtotal - disc, 2)}


async def _enroll_free(user, order):
    for it in order["items"]:
        exists = await db.enrollments.find_one({"user_id": user["user_id"], "course_id": it["course_id"]})
        if not exists:
            await db.enrollments.insert_one({
                "enrollment_id": new_id("enr"), "user_id": user["user_id"],
                "course_id": it["course_id"], "source": "free",
                "enrolled_at": now_utc().isoformat(),
            })
        schedule_email("purchase", user["email"],
                       {"name": user.get("name"), "course_title": it["title"], "amount": "0"})


@router.post("/checkout")
async def checkout(body: CheckoutIn, request: Request):
    user = await get_current_user(request)
    if not body.items:
        raise HTTPException(status_code=400, detail="Sepet boş")
    items = []
    subtotal = 0.0
    for it in body.items:
        c = await db.courses.find_one({"course_id": it.course_id, "is_published": True}, {"_id": 0})
        if not c:
            raise HTTPException(status_code=404, detail="Eğitim bulunamadı")
        if await db.enrollments.find_one({"user_id": user["user_id"], "course_id": c["course_id"]}):
            raise HTTPException(status_code=400, detail=f"'{c['title']}' eğitimine zaten kayıtlısınız")
        price = await _price_of(c)
        subtotal += price
        items.append({"course_id": c["course_id"], "title": c["title"], "price": price})

    discount, applied_code = await _apply_discount(body.discount_code, subtotal)
    total = round(subtotal - discount, 2)

    order = {
        "order_id": new_id("PT").replace("_", ""), "user_id": user["user_id"],
        "user_email": user["email"], "user_name": user.get("name"),
        "items": items, "subtotal": round(subtotal, 2), "discount": round(discount, 2),
        "discount_code": applied_code, "total": total, "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    await db.orders.insert_one({**order})

    # Free order -> enroll immediately
    if total <= 0:
        await db.orders.update_one({"order_id": order["order_id"]},
                                   {"$set": {"status": "paid", "updated_at": now_utc().isoformat()}})
        if applied_code:
            await db.discount_codes.update_one({"code": applied_code}, {"$inc": {"used_count": 1}})
        await _enroll_free(user, order)
        return {"status": "free", "order_id": order["order_id"]}

    creds = await get_paytr_credentials()
    if not creds:
        raise HTTPException(status_code=503, detail="Ödeme sistemi henüz yapılandırılmadı. Lütfen daha sonra tekrar deneyin.")

    user_ip = request.client.host if request.client else "127.0.0.1"
    amount = int(round(total * 100))
    basket = base64.b64encode(json.dumps(
        [[i["title"], f"{i['price']:.2f}", 1] for i in items], ensure_ascii=False).encode()).decode()
    test_mode = 1 if creds["test_mode"] else 0
    oid = order["order_id"]

    raw = (creds["merchant_id"] + user_ip + oid + user["email"] + str(amount) +
           basket + "0" + "0" + "TL" + str(test_mode) + creds["merchant_salt"])
    paytr_token = base64.b64encode(hmac.new(
        creds["merchant_key"].encode(), raw.encode(), hashlib.sha256).digest()).decode()

    form = {
        "merchant_id": creds["merchant_id"], "user_ip": user_ip, "merchant_oid": oid,
        "email": user["email"], "payment_amount": amount, "paytr_token": paytr_token,
        "user_basket": basket, "no_installment": 0, "max_installment": 0,
        "currency": "TL", "test_mode": test_mode, "debug_on": 1, "timeout_limit": 30,
        "lang": "tr", "user_name": user.get("name", "Musteri"),
        "user_address": "Turkiye", "user_phone": "05000000000",
        "merchant_ok_url": f"{FRONTEND_URL}/odeme/sonuc?oid={oid}",
        "merchant_fail_url": f"{FRONTEND_URL}/odeme/sonuc?oid={oid}&fail=1",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post("https://www.paytr.com/odeme/api/get-token", data=form)
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ödeme sağlayıcısına ulaşılamadı: {e}")
    if data.get("status") != "success":
        await db.orders.update_one({"order_id": oid},
                                   {"$set": {"status": "token_failed", "reason": data.get("reason")}})
        raise HTTPException(status_code=502, detail=f"PayTR: {data.get('reason', 'token alınamadı')}")
    await db.orders.update_one({"order_id": oid}, {"$set": {"iframe_token": data["token"]}})
    return {"status": "paytr", "order_id": oid,
            "iframe_url": "https://www.paytr.com/odeme/guvenli/" + data["token"]}


@router.post("/paytr/callback", response_class=PlainTextResponse)
async def paytr_callback(request: Request):
    creds = await get_paytr_credentials()
    if not creds:
        return "OK"
    form = await request.form()
    p = {k: str(v) for k, v in form.items()}
    for k in ["merchant_oid", "status", "total_amount", "hash"]:
        if not p.get(k):
            raise HTTPException(status_code=400, detail="Eksik callback verisi")
    expected = base64.b64encode(hmac.new(
        creds["merchant_key"].encode(),
        (p["merchant_oid"] + creds["merchant_salt"] + p["status"] + p["total_amount"]).encode(),
        hashlib.sha256).digest()).decode()
    if not hmac.compare_digest(expected, p["hash"]):
        raise HTTPException(status_code=400, detail="Hash doğrulaması başarısız")

    new_status = "paid" if p["status"] == "success" else "failed"
    order = await db.orders.find_one_and_update(
        {"order_id": p["merchant_oid"], "status": "pending"},
        {"$set": {"status": new_status, "total_amount": int(p["total_amount"]),
                  "updated_at": now_utc().isoformat()}},
    )
    if order and new_status == "paid":
        if order.get("discount_code"):
            await db.discount_codes.update_one({"code": order["discount_code"]}, {"$inc": {"used_count": 1}})
        for it in order["items"]:
            if not await db.enrollments.find_one({"user_id": order["user_id"], "course_id": it["course_id"]}):
                await db.enrollments.insert_one({
                    "enrollment_id": new_id("enr"), "user_id": order["user_id"],
                    "course_id": it["course_id"], "source": "purchase",
                    "order_id": order["order_id"], "enrolled_at": now_utc().isoformat(),
                })
            schedule_email("purchase", order["user_email"],
                           {"name": order.get("user_name"), "course_title": it["title"],
                            "amount": f"{order['total']:.2f}"})
    return "OK"


@router.get("/order/{order_id}")
async def order_status(order_id: str, request: Request):
    user = await get_current_user(request)
    order = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    return {"order_id": order["order_id"], "status": order["status"], "total": order.get("total"),
            "items": order.get("items", [])}
