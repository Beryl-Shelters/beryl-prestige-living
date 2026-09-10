import {ListingEditorScreen} from "../../../../../components/listings/listing-editor";
export default async function Page({params}:{params:Promise<{listingId:string}>}){const {listingId}=await params;return <ListingEditorScreen id={listingId}/>;}
