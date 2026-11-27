
import threading
import webbrowser
import base64
import hashlib
import hmac
import json
import random
import re
import secrets
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

BASE = Path(__file__).parent
USERS_FILE = BASE / "users.json"
CATALOG_FILE = BASE / "catalog.json"
SECRET_FILE = BASE / ".crema_secret"
LOCK = threading.Lock()

app = FastAPI(title="CREMA", docs_url=None, redoc_url=None)
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[A-Za-zА-Яа-я]{2,}$")

# ── роли: администратор витрины и читатель ──
ROLE_ADMIN = "editor"
ROLE_READER = "reader"

ASSETS = {
    "style.css": "text/css",
    "login.css": "text/css",
    "app.css": "text/css",
    "pages.css": "text/css",
    "app.js": "text/javascript",
    "wire.js": "text/javascript",
    "auth-gate.js": "text/javascript",
    "beans-bg.png": "image/png",
    "beans-bg.jpg": "image/jpeg",
    "beans-bg.webp": "image/webp",
}

WIRE_TAG = '<script src="wire.js"></script>'

# В вёрстке ссылки вида index.html / login.html — отправляем их на «чистые» адреса FastAPI.
PAGE_ALIASES = {
    "index.html": "/",
    "login.html": "/login",
    "register.html": "/register",
    "profile.html": "/profile",
    "admin.html": "/admin",
    "404.html": "/404",
}


# ─────────── внедрение wire.js в конец каждой страницы ───────────
def page(name: str, status: int = 200) -> HTMLResponse:
    file = BASE / name
    if not file.is_file():
        raise HTTPException(404, "Страница не найдена: " + name)
    html = file.read_text("utf-8")
    if "wire.js" not in html and (BASE / "wire.js").is_file():
        if "</body>" in html:
            html = html.replace("</body>", WIRE_TAG + "\n</body>", 1)
        elif "</html>" in html:
            html = html.replace("</html>", WIRE_TAG + "\n</html>", 1)
        else:
            html += "\n" + WIRE_TAG
    return HTMLResponse(html, status_code=status)


# ─────────── подпись и хранилища ───────────
def secret() -> bytes:
    if SECRET_FILE.exists():
        return SECRET_FILE.read_text("utf-8").strip().encode()
    s = secrets.token_hex(32)
    SECRET_FILE.write_text(s, "utf-8")
    return s.encode()


SECRET = secret()


def sign(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    b = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    return f"{b}.{hmac.new(SECRET, b.encode(), hashlib.sha256).hexdigest()[:32]}"


def unsign(token: str):
    try:
        b, sig = token.split(".")
        if not hmac.compare_digest(sig, hmac.new(SECRET, b.encode(), hashlib.sha256).hexdigest()[:32]):
            return None
        return json.loads(base64.urlsafe_b64decode(b + "=" * (-len(b) % 4)))
    except Exception:
        return None


def read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text("utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")


def load_users() -> list:
    return read_json(USERS_FILE, [])


def save_users(rows: list) -> None:
    write_json(USERS_FILE, rows)


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def current_user(request: Request):
    data = unsign(request.cookies.get("crema_session", ""))
    if not data or data.get("e", 0) < time.time():
        return None
    return next((u for u in load_users() if u["id"] == data.get("uid")), None)


def require_editor(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "Нужен вход в аккаунт редактора.")
    if u.get("role") != ROLE_ADMIN:
        raise HTTPException(403, "Роль читателя не позволяет менять витрину.")
    return u


def public_user(u: dict) -> dict:
    return {"authenticated": True, "id": u["id"], "name": u["name"], "email": u["email"],
            "role": u.get("role", ROLE_READER), "newsletter": u.get("newsletter", True),
            "created_at": u.get("created_at"), "favorites": u.get("favorites", []),
            "lists": u.get("lists", [])}


# ─────────── политика ролей: первый — админ, остальные — читатели ───────────
def next_role(rows: list) -> str:
    """Роль нового аккаунта: администратор, если в системе ещё нет ни одного пользователя."""
    return ROLE_ADMIN if not rows else ROLE_READER


def normalize_roles() -> None:
    """Приводит существующий users.json к политике «первый — админ, остальные — читатели».
    Выполняется один раз при старте; идемпотентно."""
    rows = load_users()
    if not rows:
        return
    rows.sort(key=lambda u: u.get("created_at") or "")
    changed = False
    for i, u in enumerate(rows):
        want = ROLE_ADMIN if i == 0 else ROLE_READER
        if u.get("role") != want:
            u["role"] = want
            changed = True
    if changed:
        save_users(rows)


normalize_roles()


# ─────────── страницы ───────────
@app.get("/")
async def index(request: Request):
    # Главная — только для авторизованных: гостя отправляем на страницу входа.
    if current_user(request) is None:
        return RedirectResponse("/login", status_code=303)
    resp = page("index.html")
    resp.headers["Cache-Control"] = "no-store"  # после выхода кнопка «Назад» не покажет витрину из кэша
    return resp


@app.get("/login")
async def login_page():
    return page("login.html")


@app.get("/register")
async def register_page():
    return page("register.html")


@app.get("/profile")
async def profile_page():
    return page("profile.html")


@app.get("/admin")
async def admin_page():
    return page("admin.html")


@app.get("/404")
async def error_page():
    return page("404.html", status=404)


# ─────────── каталог витрины ───────────
def load_catalog() -> dict:
    return read_json(CATALOG_FILE, {"varieties": [], "drinks": [], "revision": 0, "updatedAt": None})


def save_catalog(c: dict) -> dict:
    c["revision"] = int(c.get("revision", 0)) + 1
    c["updatedAt"] = now_iso()
    write_json(CATALOG_FILE, c)
    return c


@app.get("/api/catalog")
def catalog_get():
    return load_catalog()


class CatalogIn(BaseModel):
    varieties: list
    drinks: list


@app.post("/api/catalog/seed")
def catalog_seed(payload: CatalogIn, request: Request):
    require_editor(request)
    with LOCK:
        c = load_catalog()
        if c["varieties"] or c["drinks"]:
            return c
        c["varieties"], c["drinks"] = payload.varieties, payload.drinks
        return save_catalog(c)


@app.post("/api/catalog/replace")
def catalog_replace(payload: CatalogIn, request: Request):
    require_editor(request)
    with LOCK:
        c = load_catalog()
        c["varieties"], c["drinks"] = payload.varieties, payload.drinks
        return save_catalog(c)


class ReorderIn(BaseModel):
    kind: str
    ids: list


@app.post("/api/catalog/reorder")
def catalog_reorder(payload: ReorderIn, request: Request):
    require_editor(request)
    if payload.kind not in ("varieties", "drinks"):
        raise HTTPException(404, "Неизвестный раздел.")
    with LOCK:
        c = load_catalog()
        rows = c.get(payload.kind, [])
        index = {x.get("id"): x for x in rows}
        ordered = [index[i] for i in payload.ids if i in index]
        ordered += [x for x in rows if x.get("id") not in payload.ids]
        c[payload.kind] = ordered
        return save_catalog(c)


class BulkIn(BaseModel):
    kind: str
    ids: list = []
    items: list = []
    percent: float = 0


@app.post("/api/catalog/bulk-delete")
def bulk_delete(payload: BulkIn, request: Request):
    require_editor(request)
    if payload.kind not in ("varieties", "drinks"):
        raise HTTPException(404, "Неизвестный раздел.")
    with LOCK:
        c = load_catalog()
        c[payload.kind] = [x for x in c.get(payload.kind, []) if x.get("id") not in payload.ids]
        return save_catalog(c)


@app.post("/api/catalog/bulk-create")
def bulk_create(payload: BulkIn, request: Request):
    require_editor(request)
    if payload.kind not in ("varieties", "drinks"):
        raise HTTPException(404, "Неизвестный раздел.")
    with LOCK:
        c = load_catalog()
        c.setdefault(payload.kind, []).extend(payload.items)
        return save_catalog(c)


@app.post("/api/catalog/bulk-patch")
def bulk_patch(payload: BulkIn, request: Request):
    require_editor(request)
    if payload.kind not in ("varieties", "drinks"):
        raise HTTPException(404, "Неизвестный раздел.")
    with LOCK:
        c = load_catalog()
        for x in c.get(payload.kind, []):
            if x.get("id") in payload.ids:
                x["price"] = max(10, round(float(x.get("price", 0)) * (1 + payload.percent / 100)))
        return save_catalog(c)


# шаблонный маршрут создания — объявлен ПОСЛЕ точных, чтобы не перехватывать reorder/bulk
@app.post("/api/catalog/{kind}")
def catalog_create(kind: str, request: Request, item: dict):
    require_editor(request)
    if kind not in ("varieties", "drinks"):
        raise HTTPException(404, "Неизвестный раздел.")
    if not item.get("id"):
        item["id"] = secrets.token_hex(4)
    with LOCK:
        c = load_catalog()
        c[kind] = [x for x in c[kind] if x.get("id") != item["id"]]
        c[kind].insert(0, item)
        return save_catalog(c)


@app.put("/api/catalog/{kind}/{item_id}")
def catalog_update(kind: str, item_id: str, request: Request, item: dict):
    require_editor(request)
    if kind not in ("varieties", "drinks"):
        raise HTTPException(404, "Неизвестный раздел.")
    with LOCK:
        c = load_catalog()
        row = next((x for x in c.get(kind, []) if x.get("id") == item_id), None)
        if row is None:
            raise HTTPException(404, "Запись не найдена.")
        item["id"] = item_id
        c[kind][c[kind].index(row)] = item
        return save_catalog(c)


@app.delete("/api/catalog/{kind}/{item_id}")
def catalog_delete(kind: str, item_id: str, request: Request):
    require_editor(request)
    if kind not in ("varieties", "drinks"):
        raise HTTPException(404, "Неизвестный раздел.")
    with LOCK:
        c = load_catalog()
        c[kind] = [x for x in c.get(kind, []) if x.get("id") != item_id]
        return save_catalog(c)


# ─────────── кофейная капча ───────────
CAPTCHA = [
    {"q": "Что такое «крема» в чашке эспрессо?", "o": ["Молочная пена", "Плотная пенка из масел и CO₂ на поверхности эспрессо", "Слой сахара", "Осадок от жмыха"], "a": 1},
    {"q": "В каком зерне больше кофеина?", "o": ["В арабике", "В робусте", "Одинаково", "В либерике"], "a": 1},
    {"q": "Что происходит при «первом крэке»?", "o": ["Зерно трескается и раскрывается", "Ломается жернов", "Кипит вода", "Трескается чашка"], "a": 0},
    {"q": "Родина арабики — это…", "o": ["Бразилия", "Вьетнам", "Эфиопия", "Колумбия"], "a": 2},
    {"q": "Что взбивают вместе с эспрессо в рафе?", "o": ["Молоко 3,2%", "Сливки и ванильный сахар", "Сгущёнку", "Кокосовое молоко"], "a": 1},
    {"q": "Сколько настаивается колд брю?", "o": ["20 минут", "2 часа", "16–18 часов", "3 суток"], "a": 2},
    {"q": "Какой сорт прославился в панамском Бокете?", "o": ["Бурбон", "Гейша", "Типика", "SL28"], "a": 1},
    {"q": "Рабочая температура воды для фильтра:", "o": ["70–75 °C", "80–85 °C", "92–96 °C", "100 °C"], "a": 2},
]


@app.get("/api/captcha")
def captcha():
    i = random.randrange(len(CAPTCHA))
    token = sign({"i": i, "a": CAPTCHA[i]["a"], "e": int(time.time()) + 300, "n": secrets.token_hex(4)})
    return {"token": token, "question": CAPTCHA[i]["q"], "options": CAPTCHA[i]["o"]}


# ─────────── регистрация: роль по правилу «первый — админ» ───────────
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    newsletter: bool = True


@app.post("/register")
def register(payload: RegisterIn):
    name, email, pwd = payload.name.strip(), payload.email.strip().lower(), payload.password
    if len(name) < 2:
        raise HTTPException(422, "Имя должно содержать минимум 2 символа.")
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Проверьте адрес почты: нужен формат name@domain.ru.")
    if len(pwd) < 8 or not re.search(r"[a-zа-яё]", pwd) or not re.search(r"[A-ZА-ЯЁ]", pwd) or not re.search(r"\d", pwd):
        raise HTTPException(422, "Пароль: 8+ символов, буквы обоих регистров и цифра.")
    with LOCK:
        rows = load_users()
        if any(u["email"] == email for u in rows):
            raise HTTPException(409, "Этот адрес уже зарегистрирован. Войдите в аккаунт.")
        role = next_role(rows)  # первый аккаунт в системе — editor, каждый следующий — reader
        salt = secrets.token_hex(16)
        created = now_iso()
        rows.append({"id": secrets.token_hex(8), "name": name, "email": email, "role": role,
                     "newsletter": payload.newsletter, "salt": salt,
                     "password_hash": hash_password(pwd, salt), "created_at": created,
                     "favorites": [], "lists": []})
        save_users(rows)
    return JSONResponse({"ok": True, "name": name, "email": email, "role": role,
                         "newsletter": payload.newsletter, "created_at": created}, status_code=201)


# ─────────── вход и сессия ───────────
class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    captcha_token: str
    captcha_answer: int
    remember: bool = True


@app.post("/login")
def login(payload: LoginIn):
    cap = unsign(payload.captcha_token)
    if not cap or cap.get("e", 0) < time.time():
        raise HTTPException(400, "Капча устарела. Обновите кофейный вопрос.")
    if payload.captcha_answer != cap.get("a"):
        raise HTTPException(400, "Неверный ответ на кофейный вопрос. Попробуйте другой.")
    
    ident = payload.identifier.strip().lower()
    rows = load_users()
    
    user = next((u for u in rows if u["name"].lower() == ident), None)
    if user is None:
        raise HTTPException(401, "Пользователь не найден. Проверьте логин.")
    
    if not hmac.compare_digest(user["password_hash"], hash_password(payload.password, user["salt"])):
        raise HTTPException(401, "Неверный пароль.")
    
    max_age = 7 * 86400 if payload.remember else 86400
    resp = JSONResponse({"ok": True, "name": user["name"], "email": user["email"],
                         "role": user.get("role", ROLE_READER)})
    resp.set_cookie("crema_session", sign({"uid": user["id"], "e": int(time.time()) + max_age}),
                    max_age=max_age, httponly=True, samesite="lax", path="/")
    return resp


@app.get("/api/me")
def me(request: Request):
    u = current_user(request)
    return public_user(u) if u else {"authenticated": False}


@app.post("/api/logout")
def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("crema_session", path="/")
    return resp


class MeIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=5, max_length=120)
    newsletter: bool = True


@app.post("/api/me")
def me_update(payload: MeIn, request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "Нужен вход в аккаунт.")
    email = payload.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Проверьте адрес почты.")
    with LOCK:
        rows = load_users()
        if any(x["email"] == email and x["id"] != u["id"] for x in rows):
            raise HTTPException(409, "Этот адрес занят другим аккаунтом.")
        row = next(x for x in rows if x["id"] == u["id"])
        row.update(name=payload.name.strip(), email=email, newsletter=payload.newsletter)
        save_users(rows)
        return public_user(row)


class PwIn(BaseModel):
    current: str
    password: str = Field(min_length=8, max_length=128)


@app.post("/api/me/password")
def me_password(payload: PwIn, request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "Нужен вход в аккаунт.")
    if not hmac.compare_digest(u["password_hash"], hash_password(payload.current, u["salt"])):
        raise HTTPException(400, "Текущий пароль неверен.")
    p = payload.password
    if not (re.search(r"[a-zа-яё]", p) and re.search(r"[A-ZА-ЯЁ]", p) and re.search(r"\d", p)):
        raise HTTPException(422, "Пароль: 8+ символов, оба регистра и цифра.")
    with LOCK:
        rows = load_users()
        row = next(x for x in rows if x["id"] == u["id"])
        row["salt"] = secrets.token_hex(16)
        row["password_hash"] = hash_password(p, row["salt"])
        save_users(rows)
    return {"ok": True}


class FavIn(BaseModel):
    favorites: list


@app.post("/api/me/favorites")
def me_favorites(payload: FavIn, request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "Нужен вход в аккаунт.")
    with LOCK:
        rows = load_users()
        row = next(x for x in rows if x["id"] == u["id"])
        row["favorites"] = list(dict.fromkeys(payload.favorites))[:400]
        save_users(rows)
    return {"ok": True, "favorites": row["favorites"]}


class ListsIn(BaseModel):
    lists: list


@app.post("/api/me/lists/bulk")
def me_lists(payload: ListsIn, request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401, "Нужен вход в аккаунт.")
    with LOCK:
        rows = load_users()
        row = next(x for x in rows if x["id"] == u["id"])
        row["lists"] = payload.lists[:100]
        save_users(rows)
    return {"ok": True, "lists": row["lists"]}


# ─────────── статика ───────────
@app.get("/{asset}")
async def asset(asset: str):
    if asset in PAGE_ALIASES:
        return RedirectResponse(PAGE_ALIASES[asset], status_code=307)
    if asset in ASSETS and (BASE / asset).is_file():
        return FileResponse(BASE / asset, media_type=ASSETS[asset], headers={"Cache-Control": "no-cache"})
    raise HTTPException(404)


@app.exception_handler(404)
async def not_found(request: Request, exc):
    last = request.url.path.rsplit("/", 1)[-1]
    if request.method == "GET" and last in PAGE_ALIASES and request.url.path != "/" + last:
        return RedirectResponse(PAGE_ALIASES[last], status_code=307)  # относительные ссылки с вложенных адресов
    if request.method != "GET" or request.url.path.startswith(("/api", "/docs", "/openapi")):
        return JSONResponse({"detail": "Not found"}, status_code=404)
    try:
        return page("404.html", status=404)
    except HTTPException:
        return JSONResponse({"detail": "Not found"}, status_code=404)


def _open_browser(url: str, delay: float = 1.2) -> None:
    """Открывает страницу в браузере через delay секунд после запуска сервера."""
    def _worker():
        time.sleep(delay)
        webbrowser.open(url)
    threading.Thread(target=_worker, daemon=True).start()


if __name__ == "__main__":
    HOST = "127.0.0.1"
    PORT = 8000
    START_PAGE = "/login.html"          # какую страницу открыть при старте
    _open_browser(f"http://{HOST}:{PORT}{START_PAGE}")
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
