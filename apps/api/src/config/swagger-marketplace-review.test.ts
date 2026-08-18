import { describe, expect, it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Marketplace Step 4 Swagger", () => {
  const specification = swaggerSpec as any;
  const review = specification.paths["/marketplace/seller/properties/{propertyId}/review"].get;
  const submit = specification.paths["/marketplace/seller/properties/{propertyId}/submit"].post;

  it("documents authenticated Seller review and atomic submit operations", () => {
    expect(review.security).toEqual([{ bearerAuth: [] }]);
    expect(submit.security).toEqual([{ bearerAuth: [] }]);
    expect(submit.description).toMatch(/atomically.*1-10.*exactly one cover.*DRAFT to IN_REVIEW/i);
    expect(submit.description).toMatch(/Supporting documents are optional/i);
  });

  it("keeps fullAddress outside buyerPreview and excludes document/provider fields", () => {
    const buyer = specification.components.schemas.MarketplaceBuyerPreview.properties;
    expect(buyer).not.toHaveProperty("fullAddress");
    expect(buyer).not.toHaveProperty("documents");
    expect(JSON.stringify(buyer)).not.toMatch(/cloudinary|publicId/i);
    expect(specification.components.schemas.MarketplacePropertyReview.properties.sellerPrivate.properties.fullAddress).toBeTruthy();
  });

  it("documents stable incomplete, duplicate, and failed-submission errors without an SLA", () => {
    expect(submit.responses["400"].content["application/json"].examples.incomplete.value).toMatchObject({ code: "LISTING_SUBMISSION_INCOMPLETE", missingSections: ["PROPERTY_INFORMATION", "PHOTOS", "SALES_MANDATE"] });
    expect(submit.responses["409"].content["application/json"].examples.duplicate.value.code).toBe("LISTING_ALREADY_SUBMITTED");
    expect(submit.responses["503"].content["application/json"].example.code).toBe("LISTING_SUBMISSION_FAILED");
    expect(JSON.stringify(submit)).not.toMatch(/expectedReviewDate|working days|24 hours|48 hours/i);
  });
});
