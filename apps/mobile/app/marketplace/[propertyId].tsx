import { useLocalSearchParams } from "expo-router";
import { PropertyDetailScreen } from "@/components/marketplace/property-detail-screen";
export default function MarketplacePropertyRoute(){const {propertyId}=useLocalSearchParams<{propertyId:string}>();return <PropertyDetailScreen propertyId={propertyId}/>;}
