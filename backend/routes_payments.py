import base64
import hashlib
import hmac
import json
import os
import secrets

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from typing import List, Optional

from deps import (
    db, now_utc, new_id, get_current_user, get_optional_user, get_paytr_credentials,
    get_settings_doc, hash_password, create_session, set_session_cookie, schedule_email,
)

router = APIRouter(prefix="/payments")

FRONTEND_URL = os.environ.get("CORS_ORIGINS", "").split(",")[0]


class CheckoutItem(BaseModel):
    course_id: str


class Customer(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""


class Billing(BaseModel):
    type: str = "individual"  # individual | corporate
    tckn: str = ""
    company_name: str = ""
    tax_office: str = ""
    tax_no: str = ""
    address: str = ""


class CheckoutIn(BaseModel):
    items: List[CheckoutItem]
    discount_code: Optional[str] = None
    payment_method: str = "paytr"  # paytr | transfer
    customer: Optional[Customer] = None
    billing: Optional[Billing] = None


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
    return min(disc, subtotal), doc


@router.post("/validate-discount")
async def validate_discount(body: dict, request: Request):
    await get_current_user(request)
    code = body.get("code")
    subtotal = float(body.get("subtotal", 0))
    disc, doc = await _apply_discount(code, subtotal)
    label = f"%{int(doc['value'])} indirim" if doc and doc["type"] == "percent" else f"{int(doc['value'])} ₺ indirim" if doc else ""
    return {
        "discount": round(disc, 2), "code": doc["code"] if doc else None,
        "type": doc["type"] if doc else None, "value": doc["value"] if doc else None,
        "label": label, "total": round(subtotal - disc, 2),
    }


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


def _bank_html(accounts):
    if not accounts:
        return "<p>Banka bilgileri yakında iletilecektir.</p>"
    rows = ""
    for a in accounts:
        rows += f"<div style='margin:8px 0;padding:10px;border:1px solid #eee;border-radius:8px'><b>{a.get('bank_name','')}</b><br/>Alıcı: {a.get('holder','')}<br/>IBAN: {a.get('iban','')}{('<br/>Şube: ' + a.get('branch','')) if a.get('branch') else ''}</div>"
    return rows


async def _resolve_user(request, response, body):
    """Return (user, created). Uses logged-in user or creates/finds guest by email."""
    user = await get_optional_user(request)
    if user:
        return user, False
    cust = body.customer
    if not cust or not cust.email or not cust.name:
        raise HTTPException(status_code=400, detail="Ad, e-posta ve telefon bilgileri gereklidir")
    email = cust.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        # attach to existing account and log them in
        token = await create_session(existing["user_id"])
        set_session_cookie(response, token)
        if cust.phone:
            await db.users.update_one({"user_id": existing["user_id"]}, {"$set": {"phone": cust.phone}})
        return await db.users.find_one({"user_id": existing["user_id"]}, {"_id": 0, "password_hash": 0}), False
    temp_pw = secrets.token_urlsafe(8)
    u = {
        "user_id": new_id("user"), "name": cust.name.strip(), "email": email,
        "phone": cust.phone, "password_hash": hash_password(temp_pw), "role": "student",
        "picture": "", "auth_provider": "password", "accepted_terms": True,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(u)
    token = await create_session(u["user_id"])
    set_session_cookie(response, token)
    schedule_email("password_reset", email, {"name": u["name"], "new_password": temp_pw})
    return {k: v for k, v in u.items() if k != "password_hash"}, True


@router.post("/checkout")
async def checkout(body: CheckoutIn, request: Request, response: Response):
    if not body.items:
        raise HTTPException(status_code=400, detail="Sepet boş")
    user, _created = await _resolve_user(request, response, body)
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

    discount, disc_doc = await _apply_discount(body.discount_code, subtotal)
    applied_code = disc_doc["code"] if disc_doc else None
    after_code = subtotal - discount

    settings = await get_settings_doc()
    method = body.payment_method if body.payment_method in ("paytr", "transfer") else "paytr"
    transfer_pct = settings.get("transfer_discount_pct", 0) if method == "transfer" else 0
    transfer_discount = round(after_code * (transfer_pct / 100.0), 2)
    total = round(after_code - transfer_discount, 2)

    billing = body.billing.model_dump() if body.billing else {}
    order = {
        "order_id": new_id("PT").replace("_", ""), "user_id": user["user_id"],
        "user_email": user["email"], "user_name": user.get("name"),
        "user_phone": (body.customer.phone if body.customer else user.get("phone", "")),
        "items": items, "subtotal": round(subtotal, 2), "discount": round(discount, 2),
        "discount_code": applied_code, "payment_method": method,
        "transfer_discount": transfer_discount, "billing": billing,
        "total": total, "status": "pending", "created_at": now_utc().isoformat(),
    }
    await db.orders.insert_one({**order})
    oid = order["order_id"]

    # Free order -> enroll immediately
    if total <= 0:
        await db.orders.update_one({"order_id": oid}, {"$set": {"status": "paid", "updated_at": now_utc().isoformat()}})
        if applied_code:
            await db.discount_codes.update_one({"code": applied_code}, {"$inc": {"used_count": 1}})
        await _enroll_free(user, order)
        return {"status": "free", "order_id": oid}

    # Bank transfer (Havale/EFT)
    if method == "transfer":
        banks = settings.get("bank_accounts", [])
        await db.orders.update_one({"order_id": oid}, {"$set": {"status": "awaiting_transfer"}})
        schedule_email("bank_transfer", user["email"], {
            "name": user.get("name"), "course_title": ", ".join(i["title"] for i in items),
            "amount": f"{total:.2f}", "order_id": oid, "bank_info": _bank_html(banks),
        })
        return {"status": "transfer", "order_id": oid, "total": total, "bank_accounts": banks}

    # PayTR card
    creds = await get_paytr_credentials()
    if not creds:
        raise HTTPException(status_code=503, detail="Kart ile ödeme henüz yapılandırılmadı. Havale/EFT seçeneğini kullanabilir veya daha sonra tekrar deneyebilirsiniz.")

    user_ip = request.client.host if request.client else "127.0.0.1"
    amount = int(round(total * 100))
    basket = base64.b64encode(json.dumps(
        [[i["title"], f"{i['price']:.2f}", 1] for i in items], ensure_ascii=False).encode()).decode()
    test_mode = 1 if creds["test_mode"] else 0

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
        "user_address": (billing.get("address") or "Turkiye"), "user_phone": (order["user_phone"] or "05000000000"),
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
        await db.orders.update_one({"order_id": oid}, {"$set": {"status": "token_failed", "reason": data.get("reason")}})
        raise HTTPException(status_code=502, detail=f"PayTR: {data.get('reason', 'token alınamadı')}")
    await db.orders.update_one({"order_id": oid}, {"$set": {"iframe_token": data["token"]}})
    return {"status": "paytr", "order_id": oid, "iframe_url": "https://www.paytr.com/odeme/guvenli/" + data["token"]}



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
