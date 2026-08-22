import { normalizeAmenities, normalizeSellerDraft } from "@/seller-marketplace/helpers";
import type { SellerDraft } from "@/types/seller-marketplace";

describe("Seller draft media normalization",()=>{
  const mediaCases: Array<[Partial<SellerDraft> & Pick<SellerDraft,"id">,number,number]> = [
    [{id:"draft-1",images:undefined,documents:undefined},0,0],
    [{id:"draft-1",images:[],documents:[]},0,0]
  ];

  it.each(mediaCases)("normalizes partial and empty media DTOs",(value,imageCount,documentCount)=>{
    const draft=normalizeSellerDraft(value);
    expect(draft.images).toHaveLength(imageCount);
    expect(draft.documents).toHaveLength(documentCount);
  });

  it("removes blank and duplicate amenity labels",()=>{
    expect(normalizeAmenities(["", "   ", "Security", " security ", "Swimming pool"])).toEqual(["Security","Swimming pool"]);
  });
});
