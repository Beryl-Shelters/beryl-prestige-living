import { AdminReferrerDetail } from "../../../../components/admin-referrer-detail";
export default async function Page({params}:{params:Promise<{referrerId:string}>}){return <AdminReferrerDetail id={(await params).referrerId}/>;}
