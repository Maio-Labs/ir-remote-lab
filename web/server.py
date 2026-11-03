"""Local web server for the IR Remote Lab.

Serves the pages in web/static and a small JSON API on top of the irlab
command-line tool and the Token Lab helpers. Listens on 127.0.0.1 only.

    python3 web/server.py          # http://127.0.0.1:8000
    PORT=9000 python3 web/server.py
"""
import json
import os
import subprocess
import sys
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import duels
import sessions

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "web" / "static"
IRLAB = ROOT / "build" / "irlab"
MAX_BODY = 50 * 1024 * 1024


def run_irlab(args):
    if not IRLAB.exists():
        return HTTPStatus.SERVICE_UNAVAILABLE, {"ok": False, "error": "build/irlab not found: run make first"}
    try:
        result = subprocess.run([str(IRLAB)] + [str(a) for a in args], capture_output=True, text=True, timeout=5)
        payload = json.loads(result.stdout)
    except (subprocess.TimeoutExpired, ValueError):
        return HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": "irlab failed"}
    # A signal that does not decode is a normal answer, not a server error.
    return HTTPStatus.OK, payload


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def log_message(self, format, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path))

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValueError("request body is too large")
        return self.rfile.read(length).decode("utf-8", errors="replace")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/protocols":
            return self.send_json(*run_irlab(["protocols"]))
        if path == "/api/duels":
            return self.send_json(HTTPStatus.OK, duels.list_duels(ROOT))
        if path == "/api/sessions":
            return self.send_json(HTTPStatus.OK, sessions.list_sessions(ROOT))
        if path.startswith("/api/sessions/"):
            try:
                return self.send_json(HTTPStatus.OK, sessions.load_session(ROOT, path.rsplit("/", 1)[1]))
            except KeyError:
                return self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "session not found"})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            raw = self.read_body()
            if path == "/api/sessions/parse":
                return self.send_json(HTTPStatus.OK, sessions.parse_lines(raw.splitlines()))
            body = json.loads(raw or "{}")
        except ValueError as error:
            return self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(error)})

        if path == "/api/encode":
            args = ["encode", body.get("protocol", ""), body.get("address", ""),
                    body.get("command", ""), body.get("toggle", 0)]
            return self.send_json(*run_irlab(args))
        if path == "/api/decode":
            durations = body.get("durations") or []
            if not all(isinstance(d, (int, float)) for d in durations):
                return self.send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "durations must be numbers"})
            return self.send_json(*run_irlab(["decode", body.get("protocol") or "auto"] + [int(d) for d in durations]))
        if path == "/api/duels/run":
            try:
                return self.send_json(HTTPStatus.OK, duels.run_duel(ROOT, body.get("id")))
            except KeyError:
                return self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "unknown duel"})
        return self.send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "unknown endpoint"})


def main():
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("IR Remote Lab on http://127.0.0.1:%d (Ctrl+C to stop)" % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
