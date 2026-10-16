import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { SALES_MANDATE_AGREEMENT_SNAPSHOT, SALES_MANDATE_AGREEMENT_VERSION } from "./mandate-agreement.js";

export type MandatePdfInput = {
  propertyReference: string;
  propertyTitle: string;
  propertyAddress: string;
  propertyType: string;
  propertySubtype: string;
  registeredTitleDocument: string | null;
  sellerName: string;
  sellerEmail: string;
  sellerTelephone: string | null;
  generatedAt: string;
};

const A4: [number, number] = [595.28, 841.89];
const margin = 48;

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = text.split(/\s+/).flatMap(word => {
    if (font.widthOfTextAtSize(word, size) <= width) return [word];
    const parts: string[] = []; let part = "";
    for (const character of word) {
      if (font.widthOfTextAtSize(part + character, size) <= width) part += character;
      else { if (part) parts.push(part); part = character; }
    }
    if (part) parts.push(part); return parts;
  }); const lines: string[] = []; let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line); return lines;
}

export async function generateSalesMandatePdf(input: MandatePdfInput): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const generated = new Date(input.generatedAt);
  document.setTitle(`Exclusive Sales Mandate - ${input.propertyReference}`);
  document.setAuthor("Beryl Shelter Nigeria Limited");
  document.setSubject(SALES_MANDATE_AGREEMENT_VERSION);
  document.setCreationDate(generated); document.setModificationDate(generated);
  const createPage = (): { page: PDFPage; y: number } => {
    const nextPage = document.addPage(A4); let nextY = A4[1] - margin;
    nextPage.drawText("BERYL SHELTER NIGERIA LIMITED", { x: margin, y: nextY, size: 13, font: bold, color: rgb(0.73, 0.45, 0.17) });
    nextPage.drawText(input.propertyReference, { x: A4[0] - margin - regular.widthOfTextAtSize(input.propertyReference, 9), y: nextY + 2, size: 9, font: regular });
    nextY -= 24; nextPage.drawLine({ start: { x: margin, y: nextY }, end: { x: A4[0] - margin, y: nextY }, thickness: 0.6, color: rgb(0.72, 0.72, 0.72) }); nextY -= 18;
    return { page: nextPage, y: nextY };
  };
  let { page, y } = createPage();
  const ensure = (height: number) => { if (y - height < 58) ({ page, y } = createPage()); };
  const drawWrapped = (text: string, size = 10, font = regular, indent = 0, spacing = 14) => {
    const lines = wrap(text, font, size, A4[0] - margin * 2 - indent); ensure(lines.length * spacing + 4);
    for (const line of lines) { page.drawText(line, { x: margin + indent, y, size, font, color: rgb(0.08, 0.08, 0.08) }); y -= spacing; }
    y -= 4;
  };
  const field = (label: string, value: string | null) => {
    const shown = value?.trim() || "", lines = shown ? wrap(shown, regular, 9.5, A4[0] - margin - 190) : [""];
    ensure(Math.max(30, lines.length * 14 + 10)); page.drawText(label, { x: margin, y, size: 9, font: bold });
    for (const line of lines) {
      if (line) page.drawText(line, { x: 190, y, size: 9.5, font: regular });
      page.drawLine({ start: { x: 190, y: y - 3 }, end: { x: A4[0] - margin, y: y - 3 }, thickness: 0.45, color: rgb(0.45, 0.45, 0.45) }); y -= 14;
    }
    y -= 10;
  };

  page.drawText("EXCLUSIVE SALES MANDATE (SELLERS)", { x: margin, y, size: 16, font: bold }); y -= 20;
  page.drawText(`Agreement version: ${SALES_MANDATE_AGREEMENT_VERSION}`, { x: margin, y, size: 8.5, font: regular }); y -= 13;
  page.drawText(`Generated: ${generated.toISOString()}`, { x: margin, y, size: 8.5, font: regular }); y -= 24;
  page.drawText("PART 1 - SELLER AND PROPERTY DETAILS", { x: margin, y, size: 12, font: bold }); y -= 24;
  field("Seller/Client name", input.sellerName);
  field("Registered email", input.sellerEmail);
  field("Telephone", input.sellerTelephone);
  field("Property name/title", input.propertyTitle);
  field("Property reference", input.propertyReference);
  field("Property location/address", input.propertyAddress);
  field("Property type", [input.propertyType, input.propertySubtype].filter(Boolean).join(" - "));
  field("Registered title document", input.registeredTitleDocument);
  field("Other information", null);
  field("Mandate date", null);
  field("Seller title", null);
  field("Date of birth", null);
  field("Gender", null);
  field("Nationality", null);
  field("Post code", null);

  ensure(60); page.drawText("PART 2 - EXCLUSIVE MANDATE TERMS AND CONDITIONS", { x: margin, y, size: 12, font: bold }); y -= 24;
  for (const clause of SALES_MANDATE_AGREEMENT_SNAPSHOT.clauses) {
    const heading = `${clause.number}.${clause.title ? ` ${clause.title}:` : ""}`;
    drawWrapped(heading, 10, bold);
    for (const paragraph of clause.paragraphs) drawWrapped(paragraph);
    for (const bullet of clause.bullets ?? []) drawWrapped(`- ${bullet}`, 10, regular, 12);
    y -= 3;
  }

  ensure(190); y -= 4;
  page.drawText("HANDWRITTEN SIGNATURE AND ACKNOWLEDGMENT", { x: margin, y, size: 12, font: bold }); y -= 25;
  field("Seller/Client name", input.sellerName);
  field("Address", null);
  field("Telephone", input.sellerTelephone);
  field("Email address", input.sellerEmail);
  field("Signature date", null);
  ensure(92); page.drawText("Handwritten signature", { x: margin, y, size: 9, font: bold }); y -= 78;
  page.drawRectangle({ x: margin, y, width: A4[0] - margin * 2, height: 70, borderWidth: 0.7, borderColor: rgb(0.35, 0.35, 0.35) }); y -= 18;

  const pages = document.getPages();
  for (let index = 0; index < pages.length; index += 1) {
    const footer = `Property ${input.propertyReference} | ${SALES_MANDATE_AGREEMENT_VERSION} | Page ${index + 1} of ${pages.length}`;
    pages[index]!.drawText(footer, { x: margin, y: 28, size: 8, font: regular, color: rgb(0.35, 0.35, 0.35) });
  }
  return document.save({ useObjectStreams: false, addDefaultPage: false });
}
