import { AdminPropertyDetail } from "../../../../components/admin-property-detail";
export default async function AdminPropertyDetailPage({params}:{params:Promise<{propertyCode:string}>}){const {propertyCode}=await params;return <AdminPropertyDetail code={propertyCode}/>;}
