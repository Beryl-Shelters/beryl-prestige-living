import { describe,expect,it } from "vitest";
import { swaggerSpec } from "./swagger";

describe("Marketplace Buyer interest Swagger",()=>{
  const specification=swaggerSpec as any;
  const operation=specification.paths["/marketplace/properties/{propertyId}/interest"].post;

  it("documents verified customer authentication, LIVE-only behavior, and no SLA",()=>{
    expect(operation.security).toEqual([{bearerAuth:[]}]);
    expect(operation.description).toMatch(/customer-session/i);
    expect(operation.description).toMatch(/regardless of active.*persona/i);
    expect(operation.description).toMatch(/marketplace_status=LIVE/i);
    expect(operation.description).toMatch(/No response-time or follow-up SLA is promised/i);
    expect(Object.keys(specification.paths)).toHaveLength(130);
  });

  it("documents the exact safe request and success DTO",()=>{
    const request=specification.components.schemas.MarketplaceInterestRequest;
    expect(request.required).toEqual(["contactMethod"]);
    expect(request.properties.contactMethod.enum).toEqual(["WHATSAPP","CALL","EMAIL"]);
    expect(request.properties.message.maxLength).toBe(1000);
    const result=specification.components.schemas.MarketplaceInterestResult;
    expect(result.required).toEqual(["inquiryId","propertyId","referenceId","title","askingPrice","preferredContactMethod","submittedAt","nextAction"]);
    expect(Object.keys(result.properties).join(",")).not.toMatch(/seller|buyer|email|phone|whatsappNumber|fullAddress|message|document|mandate/i);
  });

  it("documents stable validation, availability, rate, and persistence errors",()=>{
    expect(operation.responses["400"].content["application/json"].examples.contactMethod.value.code).toBe("INVALID_CONTACT_METHOD");
    expect(operation.responses["404"].content["application/json"].example.code).toBe("PROPERTY_NOT_AVAILABLE");
    expect(operation.responses["409"].content["application/json"].example.code).toBe("CONTACT_METHOD_UNAVAILABLE");
    expect(operation.responses["429"].content["application/json"].example.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(operation.responses["503"].content["application/json"].examples.persistence.value.code).toBe("INTEREST_SUBMISSION_FAILED");
  });
});
