/**
 * SATED & SALTED - Local Development & Admin Sync Server (server.js)
 * Serves the website on http://localhost:8080 and persists Admin Portal changes
 * (prices, uploaded photos, menu dishes, combos, delivery fees, settings)
 * directly into menu-data.js and uploads/ so Website & Admin are always 100% in sync!
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const MENU_DATA_PATH = path.join(ROOT, "menu-data.js");
const UPLOADS_DIR = path.join(ROOT, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function readStoreFromDisk() {
  try {
    const code = fs.readFileSync(MENU_DATA_PATH, "utf8");
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    if (sandbox.window && sandbox.window.SS_DEFAULT_STORE) {
      return sandbox.window.SS_DEFAULT_STORE;
    }
  } catch (err) {
    console.error("Failed to read menu-data.js:", err.message);
  }
  return null;
}

function saveDataUrlImageIfNeeded(imgStr, prefix = "dish") {
  if (typeof imgStr !== "string" || !imgStr.startsWith("data:image/")) {
    return imgStr;
  }
  try {
    const match = imgStr.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!match) return imgStr;
    let ext = match[1].toLowerCase();
    if (ext === "jpeg") ext = "jpg";
    const buf = Buffer.from(match[2], "base64");
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buf);
    return `uploads/${filename}`;
  } catch (e) {
    return imgStr;
  }
}

function writeStoreToDisk(store) {
  store.updatedAt = Date.now();

  if (Array.isArray(store.menu)) {
    store.menu.forEach((item) => {
      if (item && item.img) {
        item.img = saveDataUrlImageIfNeeded(item.img, item.id || "dish");
      }
    });
  }

  if (Array.isArray(store.combos)) {
    store.combos.forEach((combo) => {
      if (combo && combo.img) {
        combo.img = saveDataUrlImageIfNeeded(combo.img, combo.id || "combo");
      }
    });
  }

  const content =
`/* ==========================================================================
   SATED & SALTED - Shared Store Data (menu-data.js)
   Auto-synced by Admin Portal. Used by both index.html and admin.html.
   ========================================================================== */

window.SS_DEFAULT_STORE = ${JSON.stringify(store, null, 2)};

window.SS_DEFAULT_MENU = window.SS_DEFAULT_STORE.menu;
`;

  fs.writeFileSync(MENU_DATA_PATH, content, "utf8");
  return store;
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // API: GET /api/store
  if (pathname === "/api/store" && req.method === "GET") {
    const store = readStoreFromDisk();
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    });
    return res.end(JSON.stringify({ ok: true, store }));
  }

  // API: POST /api/store
  if (pathname === "/api/store" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        const incoming = JSON.parse(body);
        if (!incoming || !Array.isArray(incoming.menu)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "Invalid store payload" }));
        }
        const saved = writeStoreToDisk(incoming);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ ok: true, store: saved }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Serve Static Files
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  if (safePath === "/" || safePath === "\\") safePath = "/index.html";
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("404 Not Found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-store, no-cache, must-revalidate"
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Sated & Salted Server running at http://localhost:${PORT}`);
  console.log(`Public Website: http://localhost:${PORT}/index.html`);
  console.log(`Admin Portal:   http://localhost:${PORT}/admin.html`);
});
