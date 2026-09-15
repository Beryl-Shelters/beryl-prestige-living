import { randomUUID } from "node:crypto";
import { AuthError } from "../auth/errors.js";
import type { MediaStorage } from "../listings/media.js";
import type { KycSubmissionInput } from "./model.js";
import type { KycRepository } from "./repository.js";
import type { KycUpload } from "./uploads.js";

export class KycService{
  constructor(private readonly repository:KycRepository,private readonly storage:MediaStorage){}
  async cleanup(owner:string){try{for(const publicId of await this.repository.claimCleanup(owner)){try{await this.storage.remove({public_id:publicId,resource_type:"raw",delivery_type:"authenticated"});await this.repository.releaseCleanup(owner,publicId,true);}catch{await this.repository.releaseCleanup(owner,publicId,false).catch(()=>{});console.warn(JSON.stringify({event:"kyc_document_cleanup_pending"}));}}}catch{console.warn(JSON.stringify({event:"kyc_document_cleanup_unavailable"}));}}
  async submit(owner:string,input:KycSubmissionInput,files:KycUpload[]){
    const required=input.documentType==="PASSPORT"?["FRONT"]:["FRONT","BACK"];
    if(files.length!==required.length||required.some(side=>!files.some(file=>file.side===side)))throw new AuthError(400,"INVALID_KYC_SUBMISSION","Upload the required document sides.");
    await this.cleanup(owner);const documents=[] as {side:"FRONT"|"BACK";publicId:string}[];
    for(const file of files){const extension=file.mime==="application/pdf"?"pdf":file.mime==="image/png"?"png":"jpg",asset={public_id:`beryl-v2/kyc/${owner}/${randomUUID()}.${extension}`,resource_type:"raw" as const,delivery_type:"authenticated" as const};await this.repository.journal(owner,asset.public_id);const uploaded=await this.storage.upload(file,asset);await this.repository.reserve(owner,{public_id:uploaded.public_id,resource_type:"raw",delivery_type:"authenticated",url:"",mime_type:uploaded.mime_type,size_bytes:uploaded.size_bytes,filename:file.filename});documents.push({side:file.side,publicId:asset.public_id});}
    const result=await this.repository.submit(owner,input,documents);await this.cleanup(owner);return result;
  }
  async download(owner:string,id:string){const asset=await this.repository.document(owner,id);return{asset,bytes:await this.storage.download(asset)};}
}
