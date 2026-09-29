// Lightweight, pure TypeScript PNG encoder for touch signature capture.
// Emits 100% specification-compliant PNG binary with uncompressed Deflate blocks.
// Requires zero native dependencies and passes standard PNG magic-byte validators.

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf: Uint8Array, offset = 0, length = buf.length - offset): number {
  let c = 0xffffffff;
  for (let i = offset; i < offset + length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf: Uint8Array): number {
  let a = 1;
  let b = 0;
  const mod = 65521;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]!) % mod;
    b = (b + a) % mod;
  }
  return ((b << 16) | a) >>> 0;
}

export type Point = { x: number; y: number };
export type Stroke = Point[];

export function renderStrokesToPng(
  strokes: Stroke[],
  width = 400,
  height = 160,
  strokeWidth = 3
): Uint8Array {
  // 1. Allocate RGBA pixel buffer (initialized to transparent 0x00)
  const pixels = new Uint8Array(width * height * 4);

  function setPixel(x: number, y: number, r = 23, g = 18, b = 14, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
  }

  function drawBrush(cx: number, cy: number, radius: number) {
    const r2 = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(height - 1, Math.ceil(cy + radius));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          setPixel(x, y);
        }
      }
    }
  }

  function drawLine(p1: Point, p2: Point, radius: number) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance * 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      drawBrush(p1.x + dx * t, p1.y + dy * t, radius);
    }
  }

  const radius = strokeWidth / 2;
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    if (stroke.length === 1) {
      drawBrush(stroke[0]!.x, stroke[0]!.y, radius);
      continue;
    }
    for (let i = 0; i < stroke.length - 1; i++) {
      drawLine(stroke[i]!, stroke[i + 1]!, radius);
    }
  }

  // 2. Build uncompressed scanlines: each row = 1 byte filter (0) + width * 4 bytes RGBA
  const rawRowLength = 1 + width * 4;
  const rawData = new Uint8Array(height * rawRowLength);
  for (let y = 0; y < height; y++) {
    const rawOffset = y * rawRowLength;
    rawData[rawOffset] = 0; // Filter: None
    const pixelOffset = y * width * 4;
    rawData.set(pixels.subarray(pixelOffset, pixelOffset + width * 4), rawOffset + 1);
  }

  // 3. Compress using Deflate non-compressed blocks (BTYPE = 00)
  // Max Deflate block size = 65535
  const MAX_BLOCK_SIZE = 65535;
  const numBlocks = Math.ceil(rawData.length / MAX_BLOCK_SIZE) || 1;
  const zlibDataSize = 2 + (numBlocks * 5) + rawData.length + 4;
  const zlib = new Uint8Array(zlibDataSize);

  let zPos = 0;
  zlib[zPos++] = 0x78; // CMF: Deflate, 32K window
  zlib[zPos++] = 0x01; // FLG: No preset dictionary, check bits

  for (let bIdx = 0; bIdx < numBlocks; bIdx++) {
    const isFinal = bIdx === numBlocks - 1 ? 1 : 0;
    const start = bIdx * MAX_BLOCK_SIZE;
    const end = Math.min(start + MAX_BLOCK_SIZE, rawData.length);
    const len = end - start;
    const nlen = (~len) & 0xffff;

    zlib[zPos++] = isFinal; // BFINAL + BTYPE(00)
    zlib[zPos++] = len & 0xff;
    zlib[zPos++] = (len >> 8) & 0xff;
    zlib[zPos++] = nlen & 0xff;
    zlib[zPos++] = (nlen >> 8) & 0xff;

    zlib.set(rawData.subarray(start, end), zPos);
    zPos += len;
  }

  // Adler-32 of uncompressed rawData
  const adler = adler32(rawData);
  zlib[zPos++] = (adler >>> 24) & 0xff;
  zlib[zPos++] = (adler >>> 16) & 0xff;
  zlib[zPos++] = (adler >>> 8) & 0xff;
  zlib[zPos++] = adler & 0xff;

  // 4. Assemble PNG Chunks
  // Signature (8 bytes) + IHDR (25 bytes) + IDAT (12 + zlib.length bytes) + IEND (12 bytes)
  const totalLength = 8 + 25 + (12 + zlib.length) + 12;
  const png = new Uint8Array(totalLength);
  let p = 0;

  // PNG Signature
  png.set([137, 80, 78, 71, 13, 10, 26, 10], p);
  p += 8;

  // IHDR chunk
  const ihdrLen = 13;
  png[p++] = (ihdrLen >>> 24) & 0xff;
  png[p++] = (ihdrLen >>> 16) & 0xff;
  png[p++] = (ihdrLen >>> 8) & 0xff;
  png[p++] = ihdrLen & 0xff;
  const ihdrStart = p;
  png.set([0x49, 0x48, 0x44, 0x52], p); // "IHDR"
  p += 4;
  png[p++] = (width >>> 24) & 0xff;
  png[p++] = (width >>> 16) & 0xff;
  png[p++] = (width >>> 8) & 0xff;
  png[p++] = width & 0xff;
  png[p++] = (height >>> 24) & 0xff;
  png[p++] = (height >>> 16) & 0xff;
  png[p++] = (height >>> 8) & 0xff;
  png[p++] = height & 0xff;
  png[p++] = 8; // Bit depth
  png[p++] = 6; // Color type: RGBA
  png[p++] = 0; // Compression
  png[p++] = 0; // Filter
  png[p++] = 0; // Interlace
  const ihdrCrc = crc32(png, ihdrStart, p - ihdrStart);
  png[p++] = (ihdrCrc >>> 24) & 0xff;
  png[p++] = (ihdrCrc >>> 16) & 0xff;
  png[p++] = (ihdrCrc >>> 8) & 0xff;
  png[p++] = ihdrCrc & 0xff;

  // IDAT chunk
  const idatLen = zlib.length;
  png[p++] = (idatLen >>> 24) & 0xff;
  png[p++] = (idatLen >>> 16) & 0xff;
  png[p++] = (idatLen >>> 8) & 0xff;
  png[p++] = idatLen & 0xff;
  const idatStart = p;
  png.set([0x49, 0x44, 0x41, 0x54], p); // "IDAT"
  p += 4;
  png.set(zlib, p);
  p += zlib.length;
  const idatCrc = crc32(png, idatStart, p - idatStart);
  png[p++] = (idatCrc >>> 24) & 0xff;
  png[p++] = (idatCrc >>> 16) & 0xff;
  png[p++] = (idatCrc >>> 8) & 0xff;
  png[p++] = idatCrc & 0xff;

  // IEND chunk
  const iendLen = 0;
  png[p++] = (iendLen >>> 24) & 0xff;
  png[p++] = (iendLen >>> 16) & 0xff;
  png[p++] = (iendLen >>> 8) & 0xff;
  png[p++] = iendLen & 0xff;
  const iendStart = p;
  png.set([0x49, 0x45, 0x4e, 0x44], p); // "IEND"
  p += 4;
  const iendCrc = crc32(png, iendStart, p - iendStart);
  png[p++] = (iendCrc >>> 24) & 0xff;
  png[p++] = (iendCrc >>> 16) & 0xff;
  png[p++] = (iendCrc >>> 8) & 0xff;
  png[p++] = iendCrc & 0xff;

  return png;
}
