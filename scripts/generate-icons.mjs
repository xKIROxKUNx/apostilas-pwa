import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "public/icons";
mkdirSync(OUT_DIR, { recursive: true });

const INK = [0x14, 0x17, 0x1f];
const TABS = [
  [0xc9, 0x68, 0x3d],
  [0x4a, 0x6f, 0xa5],
  [0x4c, 0x7c, 0x6c],
];

function crcOf(buf) {
  const value = crc32(buf) >>> 0;
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value, 0);
  return out;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  return Buffer.concat([lenBuf, typeBuf, data, crcOf(crcInput)]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk("IHDR", ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = chunk("IDAT", deflateSync(raw, { level: 9 }));
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function setPixel(rgba, width, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function inRoundedRect(x, y, rx, ry, rw, rh, radius) {
  if (x < rx || x >= rx + rw || y < ry || y >= ry + rh) return false;
  const cx = x < rx + radius ? rx + radius : x > rx + rw - radius ? rx + rw - radius : x;
  const cy = y < ry + radius ? ry + radius : y > ry + rh - radius ? ry + rh - radius : y;
  if ((x === cx || y === cy) && x >= rx && x < rx + rw && y >= ry && y < ry + rh) {
    const inCornerZoneX = x < rx + radius || x > rx + rw - radius;
    const inCornerZoneY = y < ry + radius || y > ry + rh - radius;
    if (!(inCornerZoneX && inCornerZoneY)) return true;
  }
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function generateIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) setPixel(rgba, size, x, y, INK, 255);
  }

  const margin = maskable ? size * 0.22 : size * 0.14;
  const usableWidth = size - margin * 2;
  const tabWidth = usableWidth * 0.4;
  const tabHeight = size - margin * 2;
  const radius = tabWidth * 0.35;
  const overlap = tabWidth * 0.55;

  const totalTabsWidth = tabWidth + overlap * (TABS.length - 1);
  const startX = (size - totalTabsWidth) / 2;
  const startY = margin;

  TABS.forEach((color, i) => {
    const rx = startX + i * overlap;
    const ry = startY + i * (tabHeight * 0.06);
    const rh = tabHeight - i * (tabHeight * 0.12);
    for (let y = Math.floor(ry); y < Math.ceil(ry + rh); y++) {
      for (let x = Math.floor(rx); x < Math.ceil(rx + tabWidth); x++) {
        if (inRoundedRect(x, y, rx, ry, tabWidth, rh, radius)) {
          setPixel(rgba, size, x, y, color, 255);
        }
      }
    }
  });

  return encodePng(size, size, rgba);
}

writeFileSync(join(OUT_DIR, "icon-192.png"), generateIcon(192));
writeFileSync(join(OUT_DIR, "icon-512.png"), generateIcon(512));
writeFileSync(join(OUT_DIR, "icon-maskable-512.png"), generateIcon(512, { maskable: true }));

console.log("✓ Ícones gerados em public/icons/ (placeholder — troque pela arte final quando tiver uma)");
