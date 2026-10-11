import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("mobile terminology help is tap accessible, dismissible, and theme aware", () => {
  const component = read("src/components/terminology-help.tsx");
  assert.match(component, /accessibilityRole="button"/);
  assert.match(component, /accessibilityLabel=\{`Explain \$\{content\.title\}`\}/);
  assert.match(component, /<Modal/);
  assert.match(component, /onRequestClose=\{\(\) => setOpen\(false\)\}/);
  assert.match(component, /backgroundColor: colors\.surface/);
  assert.match(component, /color: colors\.textMuted/);
});

test("mobile uses the approved centralized explanations", () => {
  const terms = read("src/lib/terminology.ts");
  assert.match(terms, /A lien is a legal claim or financial obligation attached to a property/);
  assert.match(terms, /A document authorizing Beryl Shelter to assist you in searching for or buying a property/);
  assert.match(terms, /The smallest initial payment you are willing to accept/);
  assert.match(terms, /Describe any gifts or benefits associated with the transaction/);
});

test("mobile assistance and listing forms expose help without changing field values", () => {
  const buy = read("app/buy-assistance.tsx");
  const sell = read("app/sell-assistance.tsx");
  const property = read("src/components/listings/property-data-step.tsx");
  const mandate = read("src/components/listings/sales-mandate-step.tsx");
  assert.match(buy, /title="What are your buying requirements"/);
  for (const term of ["propertySubtype", "mortgage", "buyMandate", "transferableGifts"]) assert.match(buy, new RegExp(`term=\\"${term}\\"|helpTerm=\\"${term}\\"`));
  for (const term of ["landArea", "registeredTitleDocument", "lien", "minimumDownPayment", "authorizedThisSale", "transferableGifts"]) assert.match(sell, new RegExp(`term=\\"${term}\\"|helpTerm=\\"${term}\\"`));
  for (const term of ["registeredTitleDocument", "propertySubtype", "lien", "landArea", "minimumDownPayment"]) assert.match(property, new RegExp(`term=\\"${term}\\"|helpTerm=\\"${term}\\"`));
  assert.match(mandate, /helpTerm="salesMandate"/);
  assert.match(mandate, /helpTerm="registeredTitleDocument"/);
});
