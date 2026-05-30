const fs = require("fs");
const path = require("path");

const manifest = { stickers: [], generatedAt: new Date().toISOString() };
const outDir = path.join(__dirname, "..", "public");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "sticker-manifest.json"), JSON.stringify(manifest, null, 2));
