"""
Máy chủ cục bộ: vừa mở website, vừa lưu sản phẩm + ảnh.
Chạy: py server.py
Mở:   http://localhost:8000
Quản lý: http://localhost:8000/admin.html
"""
from __future__ import annotations

import json
import re
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
PORT = 8000
PRODUCTS_PATH = ROOT / "products.json"
UPLOAD_DIR = ROOT / "images" / "uploads"
MAX_BODY = 8 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".svg"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def read_products() -> list:
    data = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("products.json phải là mảng")
    return data


def write_products(items: list) -> None:
    PRODUCTS_PATH.write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def unique_id(items: list, preferred: str) -> str:
    base = re.sub(r"[^A-Z0-9-]", "-", (preferred or "GM").upper())
    base = re.sub(r"-+", "-", base).strip("-")[:24] or "GM"
    used = {p.get("id") for p in items}
    candidate = base
    n = 2
    while candidate in used:
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def sanitize_upload_name(original: str) -> str | None:
    ext = Path(original or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        return None
    stem = Path(original).stem.lower()
    stem = re.sub(r"[^a-z0-9]+", "-", stem).strip("-")[:40] or "anh"
    return f"{stem}-{int(time.time() * 1000)}{ext}"


def maybe_delete_upload(image_path: str, remaining: list) -> None:
    if not image_path or not image_path.startswith("images/uploads/"):
        return
    if any(p.get("image") == image_path for p in remaining):
        return
    abs_path = (ROOT / image_path).resolve()
    uploads = UPLOAD_DIR.resolve()
    if abs_path.is_file() and uploads in abs_path.parents:
        abs_path.unlink()


def normalize_product(body: dict, items: list, existing_id: str | None) -> dict:
    name = str(body.get("name") or "").strip()
    if not name:
        raise ValueError("Cần tên sản phẩm")
    size = str(body.get("size") or "").strip()
    if not size:
        raise ValueError("Cần kích thước")
    usage = str(body.get("usage") or "").strip()
    if usage not in ("Lát Nền", "Ốp Tường"):
        raise ValueError("Ứng dụng phải là Lát Nền hoặc Ốp Tường")
    try:
        price = int(round(float(body.get("price"))))
    except (TypeError, ValueError):
        raise ValueError("Giá không hợp lệ") from None
    if price < 0:
        raise ValueError("Giá không hợp lệ")
    image = str(body.get("image") or "").strip()
    if not image.startswith("images/"):
        raise ValueError("Cần ảnh sản phẩm")
    product_id = existing_id or unique_id(items, str(body.get("id") or name))
    return {
        "id": product_id[:40],
        "name": name,
        "size": size,
        "usage": usage,
        "price": price,
        "image": image,
        "surface": str(body.get("surface") or "").strip(),
        "material": str(body.get("material") or "").strip(),
        "origin": str(body.get("origin") or "").strip() or "Việt Nam",
        "perBox": str(body.get("perBox") or "").strip(),
        "warranty": str(body.get("warranty") or "").strip(),
        "description": str(body.get("description") or "").strip(),
    }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def _send_json(self, status: int, payload) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValueError("File quá lớn (tối đa 8MB)")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/health":
            self._send_json(200, {"ok": True})
            return
        if self.path.split("?", 1)[0] == "/api/products":
            try:
                self._send_json(200, read_products())
            except Exception as err:
                self._send_json(500, {"error": str(err)})
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        try:
            if path == "/api/products":
                body = self._read_json()
                items = read_products()
                product = normalize_product(body, items, None)
                items.append(product)
                write_products(items)
                self._send_json(201, product)
                return
            if path == "/api/upload":
                body = self._read_json()
                filename = sanitize_upload_name(str(body.get("filename") or ""))
                if not filename:
                    raise ValueError("Chỉ nhận JPG, PNG, WEBP hoặc SVG")
                data_url = str(body.get("data") or "")
                match = re.match(r"^data:image/[a-zA-Z0-9+.-]+;base64,(.+)$", data_url, re.S)
                if not match:
                    raise ValueError("Ảnh không hợp lệ")
                import base64

                blob = base64.b64decode(match.group(1))
                if not blob:
                    raise ValueError("Ảnh trống")
                (UPLOAD_DIR / filename).write_bytes(blob)
                self._send_json(201, {"image": "images/uploads/" + filename})
                return
        except Exception as err:
            self._send_json(400, {"error": str(err)})
            return
        self._send_json(405, {"error": "Không hỗ trợ"})

    def do_PUT(self):
        path = self.path.split("?", 1)[0]
        match = re.match(r"^/api/products/([^/]+)$", path)
        if not match:
            self._send_json(405, {"error": "Không hỗ trợ"})
            return
        try:
            product_id = unquote(match.group(1))
            body = self._read_json()
            items = read_products()
            index = next((i for i, p in enumerate(items) if p.get("id") == product_id), -1)
            if index < 0:
                self._send_json(404, {"error": "Không tìm thấy sản phẩm"})
                return
            old_image = items[index].get("image")
            product = normalize_product(body, items, product_id)
            items[index] = product
            write_products(items)
            if old_image and old_image != product["image"]:
                maybe_delete_upload(old_image, items)
            self._send_json(200, product)
        except Exception as err:
            self._send_json(400, {"error": str(err)})

    def do_DELETE(self):
        path = self.path.split("?", 1)[0]
        match = re.match(r"^/api/products/([^/]+)$", path)
        if not match:
            self._send_json(405, {"error": "Không hỗ trợ"})
            return
        try:
            product_id = unquote(match.group(1))
            items = read_products()
            index = next((i for i, p in enumerate(items) if p.get("id") == product_id), -1)
            if index < 0:
                self._send_json(404, {"error": "Không tìm thấy sản phẩm"})
                return
            removed = items.pop(index)
            write_products(items)
            maybe_delete_upload(removed.get("image", ""), items)
            self._send_json(200, {"ok": True, "id": product_id})
        except Exception as err:
            self._send_json(400, {"error": str(err)})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Shop: http://localhost:{PORT}")
    print(f"Admin: http://localhost:{PORT}/admin.html")
    server.serve_forever()
