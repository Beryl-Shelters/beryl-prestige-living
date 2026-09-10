import {ListingDetail} from "../../../../components/listings/listing-detail";
export default async function Page({params}:{params:Promise<{listingId:string}>}){const {listingId}=await params;return <ListingDetail id={listingId}/>;}
