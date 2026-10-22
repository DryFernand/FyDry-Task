// Genera los PNG/ICO del logo desde public/logo_task.svg.
// Uso (desde frontend/): node scripts/render-logo.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const pub = path.resolve("public");
const svg = fs.readFileSync(path.join(pub, "logo_task.svg"));
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Logo centrado sobre fondo (o transparente), con margen proporcional. radius = esquinas redondeadas (fracción del lado). */
async function icon(size, file, { bg = null, pad = 0.12, radius = 0 } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(svg, { density: 600 }).resize(inner, inner).png().toBuffer();
  const layers = [{ input: logo, gravity: "center" }];
  if (radius) {
    const r = Math.round(size * radius);
    layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`), blend: "dest-in" });
  }
  // Se aplana antes del recorte para que la máscara afecte también al fondo
  const flat = await sharp({ create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers.slice(0, 1)).png().toBuffer();
  await sharp(flat).composite(layers.slice(1)).png().toFile(path.join(pub, file));
  return fs.readFileSync(path.join(pub, file));
}

await icon(512, "logo_task.png", { pad: 0 });
await icon(512, "logo_task_fondo_blanco.png", { bg: WHITE });
await icon(512, "icon.png", { bg: WHITE });
await icon(192, "icon-192.png", { bg: WHITE });
await icon(180, "apple-touch-icon.png", { bg: WHITE });
// Pestaña del navegador: esquinas redondeadas (iPhone y Android ya redondean los suyos)
await icon(64, "favicon.png", { bg: WHITE, pad: 0.06, radius: 0.22 });

// favicon.ico con PNG embebidos (32 y 16 px)
const pngs = [await icon(32, "_fav32.png", { bg: WHITE, pad: 0.06, radius: 0.22 }), await icon(16, "_fav16.png", { bg: WHITE, pad: 0.04, radius: 0.22 })];
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, i) => {
  const size = i === 0 ? 32 : 16;
  const e = 6 + i * 16;
  header.writeUInt8(size, e);
  header.writeUInt8(size, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(png.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
fs.writeFileSync(path.join(pub, "favicon.ico"), Buffer.concat([header, ...pngs]));
fs.rmSync(path.join(pub, "_fav32.png"));
fs.rmSync(path.join(pub, "_fav16.png"));

// Imagen para compartir en redes (1200x630)
const logoOg = await sharp(svg, { density: 600 }).resize(300, 300).png().toBuffer();
const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#fdfbfa"/>
  <rect x="0" y="600" width="1200" height="30" fill="#6e2234"/>
  <text x="470" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="78" font-weight="700" fill="#1c1416">FyDry <tspan fill="#6e2234">Task</tspan></text>
  <text x="472" y="345" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#4a3f3c">Organiza tus tareas,</text>
  <text x="472" y="392" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#4a3f3c">tranquiliza tu mente.</text>
</svg>`);
await sharp(text).composite([{ input: logoOg, left: 120, top: 150 }]).png().toFile(path.join(pub, "og_task.png"));

console.log("OK: logos generados");
