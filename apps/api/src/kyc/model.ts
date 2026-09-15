import { z } from "zod";
export const documentTypes=["PASSPORT","DRIVERS_LICENSE","NATIONAL_ID"] as const;
export const kycSubmissionInput=z.object({country:z.string().trim().min(2).max(100),documentType:z.enum(documentTypes),declarationAccepted:z.literal(true)}).strict();
export type KycSubmissionInput=z.infer<typeof kycSubmissionInput>;
export type KycDocument={id:string;side:"FRONT"|"BACK";filename:string;mimeType:string;sizeBytes:number};
export type KycStatus="NOT_SUBMITTED"|"PENDING_REVIEW"|"APPROVED"|"REJECTED";
export type KycView={status:KycStatus;country:string|null;documentType:typeof documentTypes[number]|null;submittedAt:string|null;rejectionReason:string|null;documents:KycDocument[]};
export type KycAsset={public_id:string;resource_type:"raw";delivery_type:"authenticated";url:string;mime_type:string;size_bytes:number;filename:string};
