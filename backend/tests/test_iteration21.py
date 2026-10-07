"""Iteration 21: group curriculum + schedule with end_time.

Validates:
- Admin PUT persists curriculum (trimmed empties/modules) and end_time
- Public GET returns curriculum and lessons[].end_time
- SEO JSON-LD EducationEvent uses end_time; subEvent entries have endDate;
  Course has syllabusSections from curriculum.

Restores original group doc at the end.
"""
import json
import os
import pytest
import requests

def _load_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    return os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

BASE = _load_env()
API = f"{BASE}/api"
ADMIN_EMAIL = "yildirimkamil977@gmail.com"
ADMIN_PW = "Admin!2026Panel"
SLUG = "google-ads-canli-grup-egitimi"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def gid():
    with open("/tmp/gid") as f:
        return f.read().strip()


@pytest.fixture(scope="module")
def orig():
    with open("/tmp/orig_group.json") as f:
        return json.load(f)


def _body(orig, lessons, curriculum):
    return {
        "title": orig["title"],
        "description": orig.get("description", ""),
        "long_description": orig.get("long_description", ""),
        "image": orig.get("image", ""),
        "promo_video": orig.get("promo_video", ""),
        "what_you_learn": orig.get("what_you_learn", []),
        "requirements": orig.get("requirements", []),
        "price": orig.get("price", 0),
        "capacity": orig.get("capacity", 0),
        "instructor_id": orig.get("instructor_id", ""),
        "lessons": lessons,
        "curriculum": curriculum,
        "is_published": orig.get("is_published", True),
    }


def test_update_persists_curriculum_and_endtime(admin, gid, orig):
    lessons = [
        {"id": orig["lessons"][0]["id"], "title": "Hesap Kurulumu & Strateji", "date": "2026-09-07",
         "time": "20:00", "end_time": "22:00", "meet_link": "", "recording_url": orig["lessons"][0].get("recording_url", "")},
        {"id": orig["lessons"][1]["id"], "title": "Kampanya Optimizasyonu", "date": "2026-09-14",
         "time": "20:00", "end_time": "22:30", "meet_link": "", "recording_url": ""},
    ]
    curriculum = [
        {"id": "", "title": "Modül 1: Temeller", "topics": ["Hesap kurulumu", "Dönüşüm takibi", ""]},
        {"id": "", "title": "", "topics": []},  # empty, must be dropped
        {"id": "", "title": "Modül 2: Optimizasyon", "topics": ["Teklif stratejileri", "A/B testi"]},
    ]
    r = admin.put(f"{API}/admin/group-trainings/{gid}", json=_body(orig, lessons, curriculum))
    assert r.status_code == 200, r.text
    doc = r.json()
    # curriculum: empty module trimmed, empty topics stripped
    assert len(doc["curriculum"]) == 2
    assert doc["curriculum"][0]["title"] == "Modül 1: Temeller"
    assert doc["curriculum"][0]["topics"] == ["Hesap kurulumu", "Dönüşüm takibi"]
    assert doc["curriculum"][1]["title"] == "Modül 2: Optimizasyon"
    for m in doc["curriculum"]:
        assert m.get("id"), "module id must be generated"
    # lesson end_time persisted
    end_times = {l["id"]: l.get("end_time") for l in doc["lessons"]}
    assert end_times.get(orig["lessons"][0]["id"]) == "22:00"
    assert end_times.get(orig["lessons"][1]["id"]) == "22:30"


def test_public_get_returns_curriculum_and_endtime():
    r = requests.get(f"{API}/group-trainings/{SLUG}")
    assert r.status_code == 200
    d = r.json()
    assert "curriculum" in d and len(d["curriculum"]) == 2
    assert d["curriculum"][0]["topics"] == ["Hesap kurulumu", "Dönüşüm takibi"]
    assert all("end_time" in l for l in d["lessons"])
    assert d["lessons"][0]["end_time"] in ("22:00", "22:30")


def test_seo_meta_eventschedule_syllabus():
    r = requests.get(f"{API}/seo/meta", params={"path": f"/canli-grup-egitimleri/{SLUG}"})
    assert r.status_code == 200
    d = r.json()
    ld = d.get("jsonld", [])
    course = next((x for x in ld if x.get("@type") == "Course"), None)
    event = next((x for x in ld if x.get("@type") == "EducationEvent"), None)
    assert course is not None, "Course JSON-LD missing"
    assert event is not None, "EducationEvent JSON-LD missing"
    # syllabusSections comes from curriculum
    syl = course.get("syllabusSections") or []
    assert len(syl) == 2
    assert syl[0]["name"] == "Modül 1: Temeller"
    assert "Hesap kurulumu" in syl[0]["description"]
    # Event endDate uses end_time (22:30 is the max lesson end)
    assert event["endDate"].startswith("2026-09-14T22:30:00")
    assert event["startDate"].startswith("2026-09-07T20:00:00")
    # subEvents each carry endDate
    sub = event.get("subEvent") or []
    assert len(sub) == 2
    assert sub[0]["endDate"].startswith("2026-09-07T22:00:00")
    assert sub[1]["endDate"].startswith("2026-09-14T22:30:00")


def test_zz_restore_group(admin, gid, orig):
    """Restore the original group doc exactly as before tests."""
    r = admin.put(
        f"{API}/admin/group-trainings/{gid}",
        json=_body(orig, orig["lessons"], orig.get("curriculum", []) or []),
    )
    assert r.status_code == 200
    # verify
    pub = requests.get(f"{API}/group-trainings/{SLUG}").json()
    assert pub["curriculum"] == []
    for l in pub["lessons"]:
        assert l.get("end_time", "") == ""
