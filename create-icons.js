// Node.js標準モジュールのみでPNGを生成
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  // 各ピクセルをRGBAで描画
  const pixels = new Uint8Array(size * size * 4);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
  }

  function fillRect(x, y, w, h, r, g, b, a = 255) {
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++)
        setPixel(x + dx, y + dy, r, g, b, a);
  }

  function roundedRect(x, y, w, h, radius, r, g, b) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        const lx = px - x, ly = py - y;
        let inCorner = false;
        if (lx < radius && ly < radius) {
          inCorner = Math.pow(lx - radius, 2) + Math.pow(ly - radius, 2) > Math.pow(radius, 2);
        } else if (lx > w - radius - 1 && ly < radius) {
          inCorner = Math.pow(lx - (w - radius - 1), 2) + Math.pow(ly - radius, 2) > Math.pow(radius, 2);
        } else if (lx < radius && ly > h - radius - 1) {
          inCorner = Math.pow(lx - radius, 2) + Math.pow(ly - (h - radius - 1), 2) > Math.pow(radius, 2);
        } else if (lx > w - radius - 1 && ly > h - radius - 1) {
          inCorner = Math.pow(lx - (w - radius - 1), 2) + Math.pow(ly - (h - radius - 1), 2) > Math.pow(radius, 2);
        }
        if (!inCorner) setPixel(px, py, r, g, b);
      }
    }
  }

  // 背景を透明に
  fillRect(0, 0, size, size, 0, 0, 0, 0);

  const rad = Math.round(size * 0.18);
  // 背景: #4f46e5
  roundedRect(0, 0, size, size, rad, 79, 70, 229);

  // チェックボックス + バー（白）
  const items = [0.28, 0.46, 0.64];
  const barWidths = [0.38, 0.28, 0.32];
  items.forEach((yRatio, i) => {
    const boxX = Math.round(size * 0.20);
    const boxY = Math.round(size * yRatio);
    const boxSize = Math.max(2, Math.round(size * 0.15));
    const boxR = Math.max(1, Math.round(size * 0.04));
    roundedRect(boxX, boxY, boxSize, boxSize, boxR, 255, 255, 255);

    const barX = Math.round(size * 0.42);
    const barY = Math.round(size * (yRatio + 0.02));
    const barW = Math.max(2, Math.round(size * barWidths[i]));
    const barH = Math.max(1, Math.round(size * 0.10));
    const barR = Math.max(1, Math.round(size * 0.03));
    roundedRect(barX, barY, barW, barH, barR, 255, 255, 255);
  });

  // PNG形式で出力
  return encodePNG(pixels, size);
}

function encodePNG(pixels, size) {
  // フィルタリング（None = 0 を各行に追加）
  const filtered = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    filtered[y * (size * 4 + 1)] = 0; // filter type None
    for (let x = 0; x < size * 4; x++) {
      filtered[y * (size * 4 + 1) + 1 + x] = pixels[y * size * 4 + x];
    }
  }

  const compressed = zlib.deflateSync(filtered, { level: 9 });

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    const table = makeCRCTable();
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function makeCRCTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    return table;
  }

  function chunk(type, data) {
    const typeArr = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcData = Buffer.concat([typeArr, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([len, typeArr, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdr = chunk('IHDR', ihdrData);
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

const outDir = path.join(__dirname, 'assets', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

[16, 32, 48, 128].forEach(size => {
  const png = createPNG(size);
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✅ icon-${size}.png (${png.length} bytes)`);
});

console.log('\nアイコン生成完了！');
