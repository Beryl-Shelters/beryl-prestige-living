import { useLocalSearchParams } from "expo-router";
import { SellerManagementScreen } from "@/components/seller-marketplace/seller-management-screen";
export default function SellerManagementRoute(){const {propertyId}=useLocalSearchParams<{propertyId:string}>();return <SellerManagementScreen propertyId={propertyId}/>}
