import os
import re
import json
import time
import html as htmllib
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, HTMLResponse

from deps import db, get_settings_doc, get_public_settings
from routes_courses import course_detail, _course_pricing
from routes_group import get_group

router = APIRouter(prefix="/seo")
SITE = os.environ.get("CORS_ORIGINS", "").split(",")[0].rstrip("/")
FRONTEND_INTERNAL_URL = os.environ.get("FRONTEND_INTERNAL_URL", "")
_shell = {"html": "", "at": 0.0}

HOME_FAQ = [
    ("Eğitimler nasıl gerçekleşiyor?", "Eğitimi satın aldıktan sonra öğrenci paneline giriş yaparak dilediğin zaman, dilediğin cihazdan izlemeye başlayabilirsin."),
    ("Eğitimlere ne kadar süre erişebilirim?", "Eğitimlere ömür boyu erişebilirsin. Yeni eklenen derslere ve kaynaklara da ücretsiz olarak erişmeye devam edersin."),
    ("Eğitimler hangi seviyeye uygun?", "Eğitimler sıfırdan başlar; kurulumlardan ileri seviye stratejilere kadar uygulamalı olarak ilerler. Ön bilgi gerekmez."),
    ("Belge veriyor musunuz?", "Evet. Eğitimi tamamlayan katılımcılara katılım belgesi verilir."),
    ("Ödeme tek seferlik mi?", "Evet, tek seferlik ödeme yaparsın ve ömür boyu güncellenen içeriklere erişirsin."),
]


def plain(s: str, n: int = 160) -> str:
    t = re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def img(url: str, w: int = 1200) -> str:
    if not url:
        return ""
    if "/api/uploads/" in url and "?" not in url:
        return f"{url}?w={w}"
    if "images.pexels.com" in url and "?" not in url:
        return f"{url}?auto=compress&cs=tinysrgb&w={w}"
    return url


def iso_dur(sec: int) -> str:
    h, m = divmod(int(sec or 0) // 60, 60)
    return f"PT{h}H{m}M" if h else f"PT{m}M"


def org(s: dict) -> dict:
    return {"@type": "Organization", "@id": f"{SITE}/#org", "name": s.get("site_name") or "Dijital Pazarlama Kursları",
            "url": f"{SITE}/", "logo": f"{SITE}/favicon.png"}


def person(i: dict) -> dict:
    if not i:
        return None
    p = {"@type": "Person", "name": i["name"], "url": f"{SITE}/egitmen/{i['slug']}"}
    if i.get("title"):
        p["jobTitle"] = i["title"]
    if i.get("avatar"):
        p["image"] = img(i["avatar"], 400)
    same = [v for v in (i.get("social_links") or {}).values() if isinstance(v, str) and v.startswith("http")]
    if same:
        p["sameAs"] = same
    return p


def crumbs(items) -> dict:
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, **({"item": f"{SITE}{u}"} if u is not None else {})}
        for i, (n, u) in enumerate(items)]}


def _fmt_dur(sec) -> str:
    h, m = divmod(int(sec or 0) // 60, 60)
    return f"{h} sa {m} dk" if h else f"{m} dk"


ICON = '<span class="w-4 h-4 inline-block"></span>'


def _shell_wrap(inner: str, settings: dict) -> str:
    promo = settings.get("promo_enabled") and any(s.strip() for s in (settings.get("promo_text") or "").split("\n"))
    return (f'<div class="min-h-screen flex flex-col bg-background"><main class="flex-1 {"pt-[104px]" if promo else "pt-[72px]"}">'
            f'{inner}</main></div>')


def _course_hero(c: dict) -> str:
    e = htmllib.escape
    meta = "".join(f'<span class="flex items-center gap-2">{ICON} {t}</span>' for t in
                   [f"{c.get('lesson_count', 0)} ders", _fmt_dur(c.get("total_seconds")), "Katılım Belgeli", "Ömür boyu erişim"])
    return ('<div class="relative pb-24 lg:pb-0"><div class="relative overflow-hidden border-b border-white/10">'
            '<div class="absolute inset-0">'
            + (f'<img src="{e(img(c["thumbnail"], 1200))}" alt="" aria-hidden="true" fetchpriority="high" class="w-full h-full object-cover opacity-15" />' if c.get("thumbnail") else "")
            + '<div class="absolute inset-0 bg-gradient-to-br from-ink via-ink/90 to-blue-950/40"></div></div>'
            '<div class="relative max-w-7xl mx-auto px-5 sm:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start"><div class="lg:col-span-7">'
            + ('<div class="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-200 text-xs font-bold">YAKINDA YAYINDA</div>' if c.get("is_upcoming") else "")
            + f'<h1 class="font-heading font-black text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[0.95]">{e(c["title"])}</h1>'
            f'<p class="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl">{e(c.get("subtitle") or "")}</p>'
            f'<div class="flex flex-wrap items-center gap-5 mt-6 text-sm text-muted-foreground">{meta}</div></div></div></div></div>')


def _poster(g: dict) -> str:
    return img(g.get("promo_thumb") or g.get("image"), 1200)


def _group_hero(g: dict) -> str:
    e = htmllib.escape
    meta = []
    if g.get("start_date"):
        meta.append(f"Başlangıç: {g['start_date']}")
    meta += [f"{len(g.get('lessons', []))} canlı oturum", f"{g.get('capacity', 0)} kişilik kontenjan"]
    spans = "".join(f'<span class="flex items-center gap-2">{ICON} {t}</span>' for t in meta)
    return ('<div class="relative pb-28 lg:pb-0"><div class="relative overflow-hidden border-b border-white/5">'
            '<div class="relative max-w-6xl mx-auto px-5 sm:px-8 pt-8 pb-10">'
            f'<nav class="text-xs text-muted-foreground flex items-center gap-2 mb-6"><a href="/">Anasayfa</a><span>/</span><a href="/canli-grup-egitimleri">Canlı Grup Eğitimleri</a><span>/</span><span class="text-foreground/80 truncate">{e(g["title"])}</span></nav>'
            '<div class="grid lg:grid-cols-3 gap-6 items-end"><div class="lg:col-span-2"><div class="flex items-center gap-3 flex-wrap">'
            '<span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-300 text-xs font-bold"><span class="relative flex h-2 w-2"></span>CANLI YAYIN</span>'
            '<span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium"><span class="w-4 h-4 inline-block"></span> Google Meet</span></div>'
            f'<h1 class="mt-5 font-heading font-black text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[1.05]">{e(g["title"])}</h1>'
            f'<div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">{spans}</div>'
            '</div></div></div></div>'
            + (f'<div class="max-w-6xl mx-auto px-5 sm:px-8 py-10"><div class="grid grid-cols-1 lg:grid-cols-3 gap-8"><div class="lg:col-span-2 space-y-10">'
               f'<div class="relative aspect-video rounded-3xl overflow-hidden bg-ink border border-white/10 shadow-2xl"><img src="{e(_poster(g))}" alt="{e(g["title"])}" fetchpriority="high" width="1200" height="675" class="w-full h-full object-cover" /></div>'
               '</div></div></div>' if _poster(g) else "")
            + '</div>')


async def _course_seo(slug: str, s: dict, site: str) -> dict:
    c = await course_detail(slug, None)
    url = f"{SITE}/kurslar/{slug}"
    price = c.get("effective_price") if c.get("effective_price") is not None else c.get("price", 0)
    desc = c["seo"].get("meta_description") or c.get("subtitle") or plain(c.get("description") or c.get("long_description"))
    inst = person(c.get("instructor"))
    course = {
        "@context": "https://schema.org", "@type": "Course", "@id": f"{url}#course", "name": c["title"],
        "description": plain(c.get("description") or c.get("long_description") or desc, 500) or desc,
        "url": url, "inLanguage": "tr-TR", "isAccessibleForFree": price == 0,
        "educationalLevel": c.get("level"), "provider": org(s), "publisher": {"@id": f"{SITE}/#org"},
        "teaches": c.get("what_you_learn") or None, "coursePrerequisites": c.get("requirements") or None,
        "timeRequired": iso_dur(c.get("total_seconds")),
        "offers": {"@type": "Offer", "category": "Free" if price == 0 else "Paid", "price": price, "priceCurrency": "TRY",
                   "availability": "https://schema.org/OutOfStock" if c.get("sale_closed") else "https://schema.org/PreOrder" if c.get("is_upcoming") else "https://schema.org/InStock", "url": url},
        "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "Online", "courseWorkload": iso_dur(c.get("total_seconds")),
                              **({"instructor": inst} if inst else {})},
        "syllabusSections": [{"@type": "Syllabus", "name": m["title"], "description": ", ".join(l["title"] for l in m["lessons"])[:300],
                              "timeRequired": iso_dur(sum(l.get("duration_seconds", 0) for l in m["lessons"]))} for m in c.get("modules", [])] or None,
    }
    if c.get("thumbnail"):
        course["image"] = [img(c["thumbnail"], 1200)]
    if inst:
        course["author"] = inst
    if c.get("updated_at"):
        course["dateModified"] = c["updated_at"]
    course = {k: v for k, v in course.items() if v is not None}
    return {"title": f"{c['seo'].get('meta_title') or c['title']} | {site}", "description": desc[:160],
            "keywords": c["seo"].get("meta_keywords", ""), "image": img(c.get("thumbnail"), 1200), "canonical": url,
            "og_type": "product", "lcp": img(c.get("thumbnail"), 1200),
            "jsonld": [course, crumbs([("Anasayfa", "/"), ("Kurslar", "/kurslar"), (c["title"], None)])],
            "prerender": _course_hero(c),
            "initial": {f"course:{slug}": c}}


async def _group_seo(slug: str, s: dict, site: str) -> dict:
    g = await get_group(slug)
    url = f"{SITE}/canli-grup-egitimleri/{slug}"
    desc = plain(g.get("description") or g.get("long_description")) or f"{g['title']} canlı online grup eğitimi. Google Meet üzerinden interaktif dersler."
    inst = person(g.get("instructor"))
    offer = {"@type": "Offer", "price": g.get("effective_price", g.get("price", 0)), "priceCurrency": "TRY", "url": url,
             "availability": "https://schema.org/SoldOut" if g.get("sold_out") else "https://schema.org/InStock"}
    image = [img(g["image"], 1200)] if g.get("image") else None

    def at(l, end=False):
        t = (l.get("end_time") if end else None) or l.get("time") or "20:00"
        return f"{l['date']}T{t[:5]}:00+03:00" if l.get("date") else None

    lessons = [l for l in g.get("lessons", []) if l.get("date")]
    course = {"@context": "https://schema.org", "@type": "Course", "@id": f"{url}#course", "name": g["title"], "description": desc,
              "url": url, "inLanguage": "tr-TR", "provider": org(s), "teaches": g.get("what_you_learn") or None,
              "syllabusSections": [{"@type": "Syllabus", "name": m["title"], "description": ", ".join(m.get("topics", []))[:300]} for m in g.get("curriculum", [])] or None,
              "coursePrerequisites": g.get("requirements") or None, "offers": {**offer, "category": "Paid"},
              "hasCourseInstance": {"@type": "CourseInstance", "courseMode": "Online", "location": {"@type": "VirtualLocation", "url": url},
                                    "courseWorkload": f"{len(g.get('lessons', []))} canlı oturum",
                                    **({"startDate": at(lessons[0]), "endDate": at(lessons[-1], True)} if lessons else {}),
                                    **({"instructor": inst} if inst else {})}}
    out = [course]
    if lessons:
        ev = {"@context": "https://schema.org", "@type": "EducationEvent", "name": g["title"], "description": desc, "url": url,
              "startDate": at(lessons[0]), "endDate": at(lessons[-1], True), "eventStatus": "https://schema.org/EventScheduled",
              "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode", "inLanguage": "tr-TR",
              "location": {"@type": "VirtualLocation", "url": url}, "organizer": org(s), "offers": {**offer, "validFrom": g.get("updated_at")},
              "maximumAttendeeCapacity": g.get("capacity") or None, "remainingAttendeeCapacity": g.get("remaining"),
              "subEvent": [{"@type": "EducationEvent", "name": l["title"] or g["title"], "startDate": at(l), "endDate": at(l, True), "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
                            "location": {"@type": "VirtualLocation", "url": url}} for l in lessons]}
        if inst:
            ev["performer"] = inst
        if image:
            ev["image"] = image
        out.append({k: v for k, v in ev.items() if v is not None})
    if image:
        course["image"] = image
    out[0] = {k: v for k, v in course.items() if v is not None}
    out.append(crumbs([("Anasayfa", "/"), ("Canlı Grup Eğitimleri", "/canli-grup-egitimleri"), (g["title"], None)]))
    return {"title": f"{g['title']} | Canlı Grup Eğitimi | {site}", "description": desc[:160],
            "keywords": f"{g['title']}, canlı eğitim, online grup eğitimi, google meet", "image": img(g.get("image"), 1200),
            "canonical": url, "og_type": "website", "lcp": _poster(g), "jsonld": out, "prerender": _group_hero(g), "initial": {f"group:{slug}": g}}


async def build_seo(path: str) -> dict:
    s = await get_settings_doc()
    site = s.get("site_name") or "Dijital Pazarlama Kursları"
    seo = s.get("seo", {}) or {}
    path = "/" + path.strip("/")
    parts = [p for p in path.split("/") if p]
    base = {"title": seo.get("meta_title") or f"{site} - Dijital Pazarlama Eğitimleri",
            "description": seo.get("meta_description") or "Google Ads, Meta reklamları, SEO ve daha fazlası. Uygulamalı video eğitimler, canlı grup eğitimleri ve birebir danışmanlık.",
            "keywords": seo.get("meta_keywords", ""), "image": img(seo.get("og_image") or s.get("hero_poster"), 1200),
            "canonical": f"{SITE}{path if path != '/' else '/'}", "og_type": "website", "jsonld": [], "initial": {}}
    if len(parts) == 2 and parts[0] == "kurslar":
        return {**base, **await _course_seo(parts[1], s, site)}
    if len(parts) == 2 and parts[0] == "canli-grup-egitimleri":
        return {**base, **await _group_seo(parts[1], s, site)}
    if not parts:
        base["jsonld"] = [
            {"@context": "https://schema.org", **org(s)},
            {"@context": "https://schema.org", "@type": "WebSite", "@id": f"{SITE}/#website", "name": site, "url": f"{SITE}/", "inLanguage": "tr-TR", "publisher": {"@id": f"{SITE}/#org"}},
            {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in HOME_FAQ]},
        ]
        return base
    if parts == ["kurslar"]:
        cs = await db.courses.find({"is_published": True}, {"_id": 0, "slug": 1, "title": 1}).to_list(200)
        base.update(title=f"Online Dijital Pazarlama Kursları | {site}",
                    description="Google Ads, Meta reklamları ve SEO alanında uygulamalı, ömür boyu erişimli online video kurslar.",
                    jsonld=[{"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
                        {"@type": "ListItem", "position": i + 1, "url": f"{SITE}/kurslar/{c['slug']}", "name": c["title"]} for i, c in enumerate(cs)]},
                        crumbs([("Anasayfa", "/"), ("Kurslar", None)])])
    elif parts == ["canli-grup-egitimleri"]:
        gs = await db.group_trainings.find({"is_published": True}, {"_id": 0, "slug": 1, "title": 1}).to_list(100)
        base.update(title=f"Canlı Grup Eğitimleri | {site}",
                    description="Google Meet üzerinden eğitmenle canlı, interaktif ve uygulamalı dijital pazarlama grup eğitimleri.",
                    jsonld=[{"@context": "https://schema.org", "@type": "ItemList", "itemListElement": [
                        {"@type": "ListItem", "position": i + 1, "url": f"{SITE}/canli-grup-egitimleri/{g['slug']}", "name": g["title"]} for i, g in enumerate(gs)]},
                        crumbs([("Anasayfa", "/"), ("Canlı Grup Eğitimleri", None)])])
    elif len(parts) == 2 and parts[0] == "egitmen":
        i = await db.instructors.find_one({"slug": parts[1]}, {"_id": 0})
        if not i:
            raise HTTPException(status_code=404)
        p = person(i)
        base.update(title=f"{i['name']} | Eğitmen | {site}", description=plain(i.get("bio")) or f"{i['name']} eğitmen profili.",
                    image=img(i.get("avatar"), 800), og_type="profile",
                    jsonld=[{"@context": "https://schema.org", "@type": "ProfilePage", "mainEntity": p}])
    elif parts == ["hakkimda"]:
        base.update(title=f"Hakkımda | {site}")
    elif parts == ["iletisim"]:
        base.update(title=f"İletişim | {site}")
    return base


@router.get("/meta")
async def seo_meta(path: str = "/"):
    d = await build_seo(path)
    d.pop("initial", None)
    d.pop("prerender", None)
    return d


async def _get_shell() -> str:
    if _shell["html"] and time.time() - _shell["at"] < 60:
        return _shell["html"]
    async with httpx.AsyncClient(timeout=10) as cl:
        r = await cl.get(f"{FRONTEND_INTERNAL_URL}/index.html", headers={"Accept": "text/html"})
    _shell.update(html=r.text, at=time.time())
    return r.text


def _head(d: dict, settings: dict) -> str:
    e = lambda v: htmllib.escape(v or "", quote=True)
    js = lambda v: json.dumps(v, ensure_ascii=False).replace("</", "<\\/")
    tags = [f"<title>{e(d['title'])}</title>",
            f'<meta name="description" content="{e(d["description"])}" />',
            f'<link rel="canonical" href="{e(d["canonical"])}" />',
            '<meta name="robots" content="index, follow, max-image-preview:large" />',
            f'<meta property="og:title" content="{e(d["title"])}" />',
            f'<meta property="og:description" content="{e(d["description"])}" />',
            f'<meta property="og:type" content="{e(d["og_type"])}" />',
            f'<meta property="og:url" content="{e(d["canonical"])}" />',
            '<meta property="og:locale" content="tr_TR" />',
            '<meta name="twitter:card" content="summary_large_image" />',
            f'<meta name="twitter:title" content="{e(d["title"])}" />',
            f'<meta name="twitter:description" content="{e(d["description"])}" />']
    if d.get("keywords"):
        tags.append(f'<meta name="keywords" content="{e(d["keywords"])}" />')
    if d.get("image"):
        tags += [f'<meta property="og:image" content="{e(d["image"])}" />', f'<meta name="twitter:image" content="{e(d["image"])}" />']
    if d.get("lcp"):
        tags.append(f'<link rel="preload" as="image" href="{e(d["lcp"])}" fetchpriority="high" />')
    if d.get("jsonld"):
        tags.append(f'<script type="application/ld+json" id="seo-jsonld">{js(d["jsonld"])}</script>')
    tags.append(f"<script>window.__SETTINGS__={js(settings)};</script>")
    if d.get("initial"):
        tags.append(f"<script>window.__INITIAL__={js(d['initial'])};window.__SEO__={js({k: v for k, v in d.items() if k not in ('initial', 'prerender')})};</script>")
    return "".join(tags)


@router.get("/html", response_class=HTMLResponse)
async def seo_html(path: str = "/"):
    shell = await _get_shell()
    status = 200
    try:
        d = await build_seo(path)
    except HTTPException:
        status = 404
        d = {"title": "Sayfa bulunamadı", "description": "", "canonical": f"{SITE}{path}", "og_type": "website"}
    shell = re.sub(r"<title>.*?</title>", "", shell, flags=re.S)
    shell = re.sub(r'<meta name="description"[^>]*>', "", shell)
    settings = await get_public_settings()
    head = _head(d, settings)
    if status == 404:
        head = head.replace("index, follow, max-image-preview:large", "noindex")
    shell = shell.replace("</head>", head + "</head>", 1)
    if d.get("prerender"):
        shell = shell.replace('<div id="root"></div>', f'<div id="root">{_shell_wrap(d["prerender"], settings)}</div>', 1)
    return HTMLResponse(shell, status_code=status,
                        headers={"Cache-Control": "no-cache"})


@router.get("/sitemap.xml")
async def sitemap():
    def u(loc, lastmod=None, pr="0.7"):
        lm = f"<lastmod>{lastmod[:10]}</lastmod>" if lastmod else ""
        return f"<url><loc>{SITE}{loc}</loc>{lm}<changefreq>weekly</changefreq><priority>{pr}</priority></url>"
    items = [u("/", None, "1.0"), u("/kurslar", None, "0.9"), u("/canli-grup-egitimleri", None, "0.9"), u("/hakkimda", None, "0.5"), u("/iletisim", None, "0.5")]
    async for c in db.courses.find({"is_published": True}, {"_id": 0, "slug": 1, "updated_at": 1}):
        items.append(u(f"/kurslar/{c['slug']}", c.get("updated_at"), "0.9"))
    async for g in db.group_trainings.find({"is_published": True}, {"_id": 0, "slug": 1, "updated_at": 1, "created_at": 1}):
        items.append(u(f"/canli-grup-egitimleri/{g['slug']}", g.get("updated_at") or g.get("created_at"), "0.9"))
    async for i in db.instructors.find({}, {"_id": 0, "slug": 1}):
        items.append(u(f"/egitmen/{i['slug']}", None, "0.6"))
    for doc in (await get_settings_doc()).get("legal_documents", []) or []:
        if doc.get("slug"):
            items.append(u(f"/sozlesmeler/{doc['slug']}", None, "0.3"))
    xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(items) + "</urlset>"
    return Response(content=xml, media_type="application/xml")


@router.get("/robots.txt")
async def robots():
    body = "User-agent: *\nAllow: /\nDisallow: /yonetim\nDisallow: /panel\nDisallow: /odeme\nDisallow: /sepet\n\n" f"Sitemap: {SITE}/sitemap.xml\n"
    return Response(content=body, media_type="text/plain")
