#!/usr/bin/env python3
"""Local deterministic API used to document the bundled CLI's behaviour."""

from __future__ import annotations

import hashlib
import io
import json
import os
import tarfile
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs


HOST = "127.0.0.1"
PORT = int(os.environ.get("SECSOURCE_MOCK_PORT", "18991"))
LOG_FILE = Path(os.environ.get("SECSOURCE_MOCK_LOG", "/tmp/secsource-mock.jsonl"))
HEALTH_STATUS = int(os.environ.get("SECSOURCE_MOCK_HEALTH_STATUS", "200"))
REPORT = {
    "metadata": {
        "scan_id": "job-mock-001",
        "mode": "deep",
        "started_at": "2026-08-19T01:00:00Z",
        "finished_at": "2026-08-19T01:00:03Z",
        "tool_versions": {"opengrep": "1.25.0", "trivy": "0.71.2"},
        "degraded_reasons": [],
    },
    "findings": [],
    "investigated_findings": [],
    "degraded": False,
}


def append_log(event: dict[str, object]) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(event, sort_keys=True) + "\n")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args: object) -> None:
        return

    def _body(self) -> bytes:
        return self.rfile.read(int(self.headers.get("Content-Length", "0")))

    def _send(self, status: int, body: bytes, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, value: object) -> None:
        self._send(status, json.dumps(value, separators=(",", ":")).encode())

    def _auth(self) -> str:
        value = self.headers.get("Authorization", "")
        return "Bearer <redacted>" if value.startswith("Bearer ") else value

    def do_GET(self) -> None:  # noqa: N802
        append_log({"method": "GET", "path": self.path, "authorization": self._auth()})
        if self.path == "/health":
            if HEALTH_STATUS != 200 or self.headers.get("Authorization") == "Bearer bad-health":
                self._json(HEALTH_STATUS if HEALTH_STATUS != 200 else 401, {"detail": "invalid token"})
            else:
                self._json(200, {"status": "ok"})
            return

        if self.path.endswith("/wait"):
            key = self.path.split("/")[-2]
            status = "failed" if key == "job-failed" else "completed"
            self._json(200, {"key": key, "status": status})
            return

        if self.path.endswith("/result"):
            key = self.path.split("/")[-2]
            if key == "missing-job":
                self._json(404, {"detail": "job not found"})
            elif key == "pending-job":
                self._json(409, {"detail": "job not completed"})
            elif key == "sarif-job":
                self._send(200, b'{"version":"2.1.0","runs":[]}')
            else:
                self._send(200, json.dumps(REPORT, separators=(",", ":")).encode())
            return

        if self.path.startswith("/v1/jobs/"):
            key = self.path.rsplit("/", 1)[-1]
            if key == "missing-job":
                self._json(404, {"detail": "job not found"})
            else:
                self._json(200, {"key": key, "status": "completed"})
            return

        self._json(404, {"detail": "unknown route"})

    def do_POST(self) -> None:  # noqa: N802
        body = self._body()
        event: dict[str, object] = {
            "method": "POST",
            "path": self.path,
            "authorization": self._auth(),
            "content_type": self.headers.get("Content-Type"),
        }

        if self.path == "/oauth/token":
            form = parse_qs(body.decode())
            event["form"] = {
                key: "<redacted>" if key == "password" else values[0]
                for key, values in form.items()
            }
            append_log(event)
            if form.get("username") == ["bad"]:
                self._json(401, {"detail": "bad credentials"})
            else:
                self._json(200, {"access_token": "MOCK_ACCESS_TOKEN"})
            return

        if self.path == "/v1/jobs":
            message = BytesParser(policy=default).parsebytes(
                b"Content-Type: "
                + self.headers["Content-Type"].encode()
                + b"\r\nMIME-Version: 1.0\r\n\r\n"
                + body
            )
            fields: dict[str, str] = {}
            archive: dict[str, object] = {}
            for part in message.iter_parts():
                name = part.get_param("name", header="content-disposition")
                payload = part.get_payload(decode=True) or b""
                filename = part.get_filename()
                if filename:
                    archive = {
                        "field": name,
                        "filename": filename,
                        "content_type": part.get_content_type(),
                        "size": len(payload),
                        "sha256": hashlib.sha256(payload).hexdigest(),
                    }
                    try:
                        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as tar:
                            archive["members"] = sorted(tar.getnames())
                    except tarfile.TarError:
                        archive["members"] = "not-a-tar.gz"
                elif name:
                    fields[name] = payload.decode()
            event["fields"] = fields
            event["archive"] = archive
            event["idempotency_key"] = self.headers.get("Idempotency-Key")
            append_log(event)

            if self.headers.get("Authorization") == "Bearer reject":
                self._json(401, {"detail": "invalid token"})
                return
            key = {
                "deep": "job-mock-001",
                "shallow": "job-failed",
            }.get(fields.get("mode", "auto"), "job-auto-001")
            if fields.get("format") == "sarif":
                key = "sarif-job"
            self._json(202, {"key": key, "status": "pending"})
            return

        append_log(event)
        self._json(404, {"detail": "unknown route"})

    def do_DELETE(self) -> None:  # noqa: N802
        append_log({"method": "DELETE", "path": self.path, "authorization": self._auth()})
        key = self.path.rsplit("/", 1)[-1]
        if key == "missing-job":
            self._json(404, {"detail": "job not found"})
        else:
            self._json(200, {"status": "cancelled", "job_id": key})


if __name__ == "__main__":
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
