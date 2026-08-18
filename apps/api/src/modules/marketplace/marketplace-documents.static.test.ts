import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.resolve(__dirname, relative), "utf8");

describe("Marketplace document route boundaries", () => {
  const routes = read("marketplace.routes.ts");
  const middleware = read("../../middlewares/upload.middleware.ts");
  const cloudinary = read("../../utils/cloudinary.ts");
  const controller = read("marketplace.controller.ts");

  it("mounts upload and delete behind verified customer authorization", () => {
    expect(routes).toContain('router.use("/seller",customerSessionMiddleware,requireVerifiedCustomer)');
    expect(routes).toContain('router.post("/seller/properties/:propertyId/documents",uploadPropertyDocument,c.uploadDocument)');
    expect(routes).toContain('router.delete("/seller/properties/:propertyId/documents/:documentId",c.deleteDocument)');
  });

  it("preserves the photo limit and independently enforces the document contract", () => {
    expect(middleware).toContain("fileSize: 5 * 1024 * 1024");
    expect(middleware).toContain("fileSize: 10 * 1024 * 1024");
    expect(middleware).toContain('file.mimetype !== "application/pdf"');
    expect(middleware).toContain('documentUpload.single("document")');
    expect(middleware).toContain('"DOCUMENT_TOO_LARGE"');
  });

  it("reuses the configured Cloudinary client with authenticated raw delivery", () => {
    expect(cloudinary).toContain('import cloudinary from "../config/cloudinary"');
    expect(cloudinary).toContain('resource_type: "raw"');
    expect(cloudinary).toContain('type: "authenticated"');
    expect(cloudinary).toContain('result.result === "not found"');
  });

  it("returns only the safe service DTO envelope", () => {
    expect(controller).toContain("data:{document}");
    expect(controller).not.toMatch(/cloudinaryPublicId|cloudinaryResourceType|secure_url/);
  });
});
