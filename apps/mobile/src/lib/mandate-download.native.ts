import { File, Paths } from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";
import { Linking, Platform } from "react-native";
import { apiClient } from "./api-client";

export async function downloadAndOpenMandate(listingId:string,reference:string){const bytes=await apiClient.download(`/api/v1/listings/${encodeURIComponent(listingId)}/physical-mandate/pdf`);const file=new File(Paths.cache,`Beryl-Shelter-Sales-Mandate-${reference}.pdf`);file.write(bytes);const uri=Platform.OS==="android"?await getContentUriAsync(file.uri):file.uri;await Linking.openURL(uri);return uri;}
