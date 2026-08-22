import { useLocalSearchParams } from "expo-router";
import { SellerEditorScreen } from "@/components/seller-marketplace/seller-editor-screen";
import { stepFromSlug } from "@/seller-marketplace/helpers";
export default function SellerEditorRoute(){const {propertyId,step,resubmit}=useLocalSearchParams<{propertyId:string;step?:string;resubmit?:string}>();return <SellerEditorScreen propertyId={propertyId} initialStep={stepFromSlug(step)} resubmit={resubmit==="1"}/>}
