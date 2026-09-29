import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import { renderStrokesToPng, type Stroke } from "../src/lib/png-encoder";

test("PNG encoder produces standard specification-compliant PNG binary", () => {
  const strokes: Stroke[] = [
    [
      { x: 10, y: 10 },
      { x: 50, y: 50 },
      { x: 100, y: 30 },
      { x: 150, y: 80 },
    ],
  ];

  const png = renderStrokesToPng(strokes, 200, 100);

  // 1. Verify PNG magic signature
  const signature = Array.from(png.subarray(0, 8));
  assert.deepEqual(signature, [137, 80, 78, 71, 13, 10, 26, 10]);

  // 2. Verify IHDR chunk
  const ihdrLen = (png[8]! << 24) | (png[9]! << 16) | (png[10]! << 8) | png[11]!;
  assert.equal(ihdrLen, 13);
  const ihdrType = String.fromCharCode(...png.subarray(12, 16));
  assert.equal(ihdrType, "IHDR");
  const width = (png[16]! << 24) | (png[17]! << 16) | (png[18]! << 8) | png[19]!;
  const height = (png[20]! << 24) | (png[21]! << 16) | (png[22]! << 8) | png[23]!;
  assert.equal(width, 200);
  assert.equal(height, 100);
  assert.equal(png[24], 8); // bit depth
  assert.equal(png[25], 6); // color type RGBA

  // 3. Extract and inflate IDAT zlib payload
  const idatLen = (png[33]! << 24) | (png[34]! << 16) | (png[35]! << 8) | png[36]!;
  const idatType = String.fromCharCode(...png.subarray(37, 41));
  assert.equal(idatType, "IDAT");
  const zlibData = png.subarray(41, 41 + idatLen);
  const decompressed = inflateSync(Buffer.from(zlibData));
  const expectedScanlineLen = (1 + 200 * 4) * 100;
  assert.equal(decompressed.length, expectedScanlineLen);

  // 4. Verify IEND chunk at end
  const iendStart = png.length - 12;
  const iendLen = (png[iendStart]! << 24) | (png[iendStart + 1]! << 16) | (png[iendStart + 2]! << 8) | png[iendStart + 3]!;
  assert.equal(iendLen, 0);
  const iendType = String.fromCharCode(...png.subarray(iendStart + 4, iendStart + 8));
  assert.equal(iendType, "IEND");

  // 5. Verify drawn pixels exist in decompressed stream
  let nonZeroAlpha = 0;
  for (let i = 0; i < decompressed.length; i += 4) {
    if (decompressed[i + 3]! > 0) nonZeroAlpha++;
  }
  assert.ok(nonZeroAlpha > 50, "Expected drawn stroke pixels with positive alpha");
});
