// Generates icons, OG image and web logo from brand/logo-source.webp.
// Usage (from the project root): node scripts/generate-brand-assets.mjs
import fs from "node:fs";
import sharp from "sharp";
const SRC = process.argv[2] ?? "brand/logo-source.webp";
const OUT = process.argv[3] ?? ".";
const CREAM = { r: 251, g: 246, b: 236, alpha: 1 };

async function head(size, { circle }) {
  const crop = await sharp(SRC).extract({ left: 405, top: 70, width: 560, height: 560 }).resize(Math.round(size * 0.9)).png().toBuffer();
  const bg = circle
    ? Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#FBF6EC"/></svg>`)
    : { create: { width: size, height: size, channels: 4, background: CREAM } };
  const base = circle ? sharp(bg) : sharp(bg);
  const layers = [{ input: crop, gravity: "south" }];
  if (circle) {
    // Clip everything to the circle so the artwork doesn't spill past its edge.
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#000"/></svg>`);
    layers.push({ input: mask, blend: "dest-in" });
  }
  const flat = await base.composite(layers.slice(0, 1)).png().toBuffer();
  return sharp(flat).composite(layers.slice(1)).png({ palette: size > 64, compressionLevel: 9 }).toBuffer();
}

function ico(pngs) {
  // ICO container with PNG-encoded entries.
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e); header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(buf.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.buf)]);
}

const w = (p, b) => fs.writeFileSync(`${OUT}/${p}`, b);
fs.mkdirSync(`${OUT}/src/app`, { recursive: true });
fs.mkdirSync(`${OUT}/public`, { recursive: true });

// App icons (Next.js file conventions).
w("src/app/icon.png", await head(256, { circle: true }));
w("src/app/apple-icon.png", await head(180, { circle: false }));
const icoEntries = [];
for (const size of [16, 32, 48]) icoEntries.push({ size, buf: await head(size, { circle: true }) });
w("src/app/favicon.ico", ico(icoEntries));

// Header mark and full logo for pages/README.
w("public/brand-mark.png", await head(96, { circle: true }));
w("public/logo.webp", await sharp(SRC).resize(640).webp({ quality: 90 }).toBuffer());

// Open Graph image 1200x630: full logo on cream.
const logo = await sharp(SRC).resize(560).png().toBuffer();
w(
  "src/app/opengraph-image.png",
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: CREAM } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ palette: true, compressionLevel: 9 })
    .toBuffer(),
);
console.log("done");
