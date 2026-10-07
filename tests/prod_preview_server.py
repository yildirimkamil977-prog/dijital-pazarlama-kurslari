import gzip, mimetypes, os, sys, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

ROOT = "/app/frontend/build"
SEO = ("/", "/kurslar", "/canli-grup-egitimleri", "/hakkimda", "/iletisim")


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype, cache):
        if "gzip" in self.headers.get("Accept-Encoding", "") and ctype.split(";")[0] in ("text/html", "text/css", "application/javascript", "application/json", "image/svg+xml"):
            body = gzip.compress(body)
            enc = True
        else:
            enc = False
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", cache)
        if enc:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = self.path.split("?")[0]
        if p.startswith("/api/"):
            req = urllib.request.Request(f"http://localhost:8001{self.path}", headers={k: v for k, v in self.headers.items() if k.lower() in ("cookie", "authorization")})
            try:
                r = urllib.request.urlopen(req)
                return self.send(r.status, r.read(), r.headers.get("Content-Type", "application/json"), r.headers.get("Cache-Control", "no-cache"))
            except urllib.error.HTTPError as e:
                return self.send(e.code, e.read(), "application/json", "no-cache")
        if p == "/index.html":
            return self.send(200, open(f"{ROOT}/index.html", "rb").read(), "text/html; charset=utf-8", "no-cache")
        if p in SEO or p.startswith(("/kurslar/", "/canli-grup-egitimleri/", "/egitmen/")):
            r = urllib.request.urlopen(f"http://localhost:8002/api/seo/html?path={urllib.request.quote(p)}")
            return self.send(r.status, r.read(), "text/html; charset=utf-8", "no-cache")
        f = os.path.join(ROOT, p.lstrip("/"))
        if os.path.isfile(f):
            ct = mimetypes.guess_type(f)[0] or "application/octet-stream"
            cache = "public, max-age=31536000, immutable" if p.startswith(("/static/", "/fonts/")) else "public, max-age=3600"
            return self.send(200, open(f, "rb").read(), ct, cache)
        return self.send(200, open(f"{ROOT}/index.html", "rb").read(), "text/html; charset=utf-8", "no-cache")


ThreadingHTTPServer(("0.0.0.0", int(sys.argv[1]) if len(sys.argv) > 1 else 5055), H).serve_forever()
