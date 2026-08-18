import { SellerDraftEditor } from "@/components/marketplace/seller-draft-editor";

type EditorStep = "PROPERTY_INFORMATION" | "PHOTOS_DOCUMENTS" | "SALES_MANDATE" | "REVIEW";

const normalizeStep = (step?: string): EditorStep | undefined => {
  switch (step?.toUpperCase().replaceAll("-", "_")) {
    case "PROPERTY_INFORMATION":
    case "PHOTOS_DOCUMENTS":
    case "SALES_MANDATE":
    case "REVIEW":
      return step.toUpperCase().replaceAll("-", "_") as EditorStep;
    default:
      return undefined;
  }
};

export default async function EditSellerListingPage({
  params,
  searchParams
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ propertyId }, { step }] = await Promise.all([params, searchParams]);
  return <SellerDraftEditor propertyId={propertyId} initialStep={normalizeStep(step)} />;
}
