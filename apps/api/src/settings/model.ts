import { z } from "zod";
const optionalText=(maximum:number)=>z.string().trim().max(maximum);
export const settingsProfileInput=z.object({firstName:z.string().trim().min(1).max(100),lastName:z.string().trim().min(1).max(100),phoneNumber:z.string().regex(/^\d{5,15}$/),briefBio:optionalText(1000),accountName:optionalText(160),bankName:optionalText(120),accountNumber:z.string().trim().regex(/^$|^[0-9]{6,20}$/),streetAddress:z.string().trim().min(1).max(300),zipCode:z.string().trim().regex(/^[A-Za-z0-9 -]{2,20}$/),city:z.string().trim().min(1).max(100),state:z.string().trim().min(1).max(100),country:z.string().trim().min(1).max(100)}).strict().refine(value=>[value.accountName,value.bankName,value.accountNumber].every(Boolean)||[value.accountName,value.bankName,value.accountNumber].every(value=>!value),{message:"Complete all bank fields or leave all three blank."});
export type SettingsProfileInput=z.infer<typeof settingsProfileInput>;
export type SettingsProfile=SettingsProfileInput&{email:string;countryCode:string|null;accountType:string|null;profileImageUrl:string|null};
export type ProfileImage={public_id:string;url:string;mime_type:string;size_bytes:number};
