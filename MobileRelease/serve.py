"""Serve the self-contained MobileRelease folder (app + packed Assets)."""
from __future__ import annotations

import argparse
import mimetypes
import posixpath
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote

MOBILE = Path(__file__).resolve().parent


def _safe_join(base: Path, rel: str) -> Path | None:
    rel = rel.replace("\\", "/").lstrip("/")
    target = (base / rel).resolve()
    try:
        target.relative_to(base.resolve())
    except ValueError:
        return None
    return target


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed = unquote(path.split("?", 1)[0])
        parsed = posixpath.normpath(parsed)
        if parsed in ("/", ""):
            return str(MOBILE / "index.html")
        joined = _safe_join(MOBILE, parsed.lstrip("/"))
        return str(joined) if joined else str(MOBILE / "index.html")

    def log_message(self, format: str, *args) -> None:
        __import__("sys").stderr.write("%s - %s\n" % (self.address_string(), format % args))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    mimetypes.add_type("application/manifest+json", ".webmanifest")
    mimetypes.add_type("font/ttf", ".ttf")
    mimetypes.add_type("video/mp4", ".mp4")
    mimetypes.add_type("video/mp4", ".MP4")
    packed = MOBILE / "Assets"
    print(f"DFNAF mobile  http://127.0.0.1:{args.port}")
    print(f"  folder: {MOBILE}")
    print(f"  assets: {'packed' if packed.is_dir() else 'MISSING — run pack_assets.py'}")
    print("Host this whole MobileRelease folder on HTTPS for phone use without a PC.")
    ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
