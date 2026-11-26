import assert from "node:assert/strict";
import { test } from "node:test";
import { propertySubtypes } from "../src/lib/property-taxonomy";

test("mobile listing fallback and buyer filters expose all detailed property types", () => {
  assert.equal(propertySubtypes.length, 23);
  assert.equal(new Set(propertySubtypes).size, 23);
  for (const subtype of ["Flat", "Duplex", "Land", "Studio Apartment", "Office Space", "Warehouse"]) {
    assert(propertySubtypes.includes(subtype as typeof propertySubtypes[number]));
  }
});
