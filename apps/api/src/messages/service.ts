import { randomUUID } from "node:crypto";
import type { MediaStorage } from "../listings/media.js";
import { validateFile } from "../listings/uploads.js";
import type { TicketsRepository } from "./repository.js";
import type { TicketUpload } from "./uploads.js";

export class TicketAttachmentsService {
  constructor(private readonly repository:TicketsRepository,private readonly storage:MediaStorage){}
  async cleanup(owner:string){
    try{
      for(const publicId of await this.repository.claimCleanup(owner)) {
        try{await this.storage.remove({public_id:publicId,resource_type:"raw",delivery_type:"authenticated"});await this.repository.forgetUpload(owner,publicId);}
        catch{console.warn(JSON.stringify({event:"ticket_attachment_cleanup_pending"}));}
      }
    }catch{console.warn(JSON.stringify({event:"ticket_attachment_cleanup_unavailable"}));}
  }
  async save(owner:string,id:string|null,subject:string|null,message:string,file:TicketUpload){
    if(id)await this.repository.detail(owner,id);
    validateFile(file,true,true);
    await this.cleanup(owner);
    const extension=file.mime==="application/pdf"?"pdf":file.mime==="image/png"?"png":file.mime==="image/webp"?"webp":"jpg";
    const asset={public_id:`beryl-v2/messages/${randomUUID()}.${extension}`,resource_type:"raw" as const,delivery_type:"authenticated" as const};
    await this.repository.reserveUpload(owner,asset.public_id);
    const uploaded=await this.storage.upload(file,asset);
    // Never eagerly delete after an ambiguous DB/provider response: the write
    // may have committed. The durable intent allows safe later reconciliation.
    return this.repository.saveAttachment(owner,id,subject,message,{...uploaded,filename:file.filename});
  }
  async download(owner:string,id:string,attachmentId:string){
    const asset=await this.repository.attachment(owner,id,attachmentId);
    return {asset,bytes:await this.storage.download(asset)};
  }
}
