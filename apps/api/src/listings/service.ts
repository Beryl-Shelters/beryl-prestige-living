import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthError } from "../auth/errors.js";
import { documentInput, MAX_IMAGES, parseContent, type ListingImage } from "./model.js";
import { conflict, notFound, type CleanupAsset, type ListingsRepository, type Mutation } from "./repository.js";
import { planAsset, type MediaStorage } from "./media.js";
import { validateFile, type UploadFile } from "./uploads.js";
const envelope = z.object({ content:z.unknown(), retained_images:z.array(z.uuid()).max(MAX_IMAGES).optional(), version:z.number().int().positive().optional() }).strict();
export class ListingsService {
  constructor(readonly repository: ListingsRepository, readonly storage: MediaStorage) {}
  async own(owner:string,id:string) { const listing=await this.repository.get(owner,id); if(!listing) throw notFound(); return listing; }
  async cleanup(owner:string, explicit:CleanupAsset[] = []) {
    try {
      const queued=await this.repository.cleanupCandidates(owner);
      for (const asset of [...explicit,...queued]) {
        try {
          if (!await this.repository.claimCleanup(owner,asset) || await this.repository.referenced(owner,asset)) continue;
          await this.storage.remove(asset);
          await this.repository.forgetCleanup(owner,asset);
        }
        catch { console.warn(JSON.stringify({event:"listing_media_cleanup_pending",public_id:asset.public_id})); }
      }
    } catch { console.warn(JSON.stringify({event:"listing_media_cleanup_unavailable"})); }
  }
  private async upload(owner:string,file:UploadFile,document:boolean) {
    validateFile(file,document); const asset=planAsset(file,document);
    await this.repository.journal(owner,asset); // intent survives process/provider/DB failures
    return this.storage.upload(file,asset);
  }
  async save(owner:string,id:string|null,input:unknown,files:UploadFile[]) {
    const payload=envelope.parse(input); const content=parseContent(payload.content);
    const current=id ? await this.own(owner,id) : null;
    if(current && current.version!==payload.version) throw conflict();
    if(current && !["UNLISTED","REJECTED"].includes(current.listing_status)) throw new AuthError(409,"LISTING_LOCKED","Unlist this property before editing it.");
    if(!current && (payload.version || payload.retained_images?.length)) throw new AuthError(400,"INVALID_LISTING","Check the listing information.");
    const keep=payload.retained_images ?? current?.images.map(image=>image.id) ?? [];
    if(new Set(keep).size!==keep.length || keep.some(id=>!current?.images.some(image=>image.id===id))) throw notFound();
    if(keep.length+files.length<1 || keep.length+files.length>MAX_IMAGES) throw new AuthError(400,"INVALID_IMAGES",`Choose between 1 and ${MAX_IMAGES} property images.`);
    files.forEach(file=>validateFile(file,false));
    const images:ListingImage[]=keep.map(id=>current!.images.find(image=>image.id===id)!);
    for(const file of files) images.push({...await this.upload(owner,file,false),id:randomUUID(),sort_order:images.length});
    const saved=await this.repository.mutate(owner,{action:current?"EDIT":"CREATE",id,version:payload.version??null,content,images});
    // A failed/ambiguous DB response leaves intents queued, never eagerly deletes
    // potentially committed uploads. Success can safely reconcile old references.
    await this.cleanup(owner,current?.images.filter(image=>!keep.includes(image.id))??[]);
    return this.own(owner,saved);
  }
  async action(owner:string,id:string,version:number,action:Mutation["action"]) {
    const current=await this.own(owner,id);
    if(current.version!==version) throw conflict();
    if(action==="REQUEST_APPROVAL" && (current.listing_status!=="UNLISTED" || !current.images.length)) throw new AuthError(409,"LISTING_NOT_READY","Complete this unlisted property before requesting approval.");
    if(action==="UNLIST" && current.listing_status!=="PENDING") throw new AuthError(409,"LISTING_NOT_READY","Only pending listings can be unlisted in this release.");
    await this.repository.mutate(owner,{id,version,action});
    await this.cleanup(owner,action==="DELETE"?[...current.images,...current.documents]:[]);
    return action==="DELETE"?null:this.own(owner,id);
  }
  async documents(owner:string,id:string,input:unknown,files:UploadFile[]) {
    const payload=documentInput.parse(input); const listing=await this.own(owner,id);
    if(listing.version!==payload.version) throw conflict();
    if(!["UNLISTED","REJECTED"].includes(listing.listing_status)) throw new AuthError(409,"LISTING_LOCKED","Unlist this property before uploading documents.");
    if(files.length!==1) throw new AuthError(400,"INVALID_DOCUMENTS","Choose exactly one document file.");
    const documents=[{...await this.upload(owner,files[0]!,true),title:payload.title,document_type:payload.document_type,description:payload.description,sort_order:0}];
    await this.repository.mutate(owner,{id,version:payload.version,action:"DOCUMENTS",documents});
    return this.own(owner,id);
  }
}
