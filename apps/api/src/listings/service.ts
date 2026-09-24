import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthCipher } from "../auth/crypto.js";
import { AuthError } from "../auth/errors.js";
import { documentInput, mandateInput, mandateSaveInput, MAX_IMAGES, parseContent, presentMandate, type ListingImage, type MandateDocumentInput, type MediaAsset, type SalesMandate, type SalesMandateView } from "./model.js";
import { conflict, notFound, type CleanupAsset, type ListingsRepository, type Mutation } from "./repository.js";
import { planAsset, type MediaStorage } from "./media.js";
import { validateFile, type UploadFile } from "./uploads.js";
const envelope = z.object({ content:z.unknown(), retained_images:z.array(z.uuid()).max(MAX_IMAGES).optional(), version:z.number().int().positive().optional() }).strict();
export class ListingsService {
  constructor(readonly repository: ListingsRepository, readonly storage: MediaStorage, private readonly uploadCipher?: AuthCipher) {}
  private handlePurpose = "listing-mandate-upload";
  private uploadHandle(owner:string,listingId:string,purpose:"document"|"signature",asset:MediaAsset) {
    if (!this.uploadCipher) throw new AuthError(503,"LISTINGS_UNAVAILABLE","Listings are temporarily unavailable. Please try again.");
    return this.uploadCipher.seal({ version:1, owner, listing_id:listingId, purpose, expires_at:Date.now()+3600000, asset },this.handlePurpose);
  }
  private resolveUpload(owner:string,listingId:string,purpose:"document"|"signature",uploadId:string):MediaAsset {
    const value=this.uploadCipher?.open<unknown>(uploadId,this.handlePurpose);
    const parsed=z.object({
      version:z.literal(1),owner:z.uuid(),listing_id:z.uuid(),purpose:z.enum(["document","signature"]),expires_at:z.number().int(),
      asset:z.object({public_id:z.string().min(1).max(200),resource_type:z.literal("raw"),delivery_type:z.literal("authenticated"),url:z.literal(""),mime_type:z.enum(["application/pdf","image/png","image/jpeg"]),size_bytes:z.number().int().positive().max(10485760)}).strict(),
    }).strict().safeParse(value);
    if(!parsed.success||parsed.data.owner!==owner||parsed.data.listing_id!==listingId||parsed.data.purpose!==purpose||parsed.data.expires_at<Date.now())
      throw new AuthError(400,"INVALID_UPLOAD","The uploaded file reference is invalid or expired. Upload the file again.");
    if(purpose==="signature"&&(parsed.data.asset.mime_type!=="image/png"||parsed.data.asset.size_bytes>2097152))
      throw new AuthError(400,"INVALID_UPLOAD","The uploaded signature reference is invalid or expired. Upload it again.");
    return parsed.data.asset;
  }
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
  async mandateDocumentsUpload(owner: string, id: string, input: unknown, files: UploadFile[]) {
    const listing = await this.own(owner, id);
    if (!["UNLISTED", "REJECTED"].includes(listing.listing_status)) throw new AuthError(409, "LISTING_LOCKED", "Unlist this property before editing.");
    if (files.length < 1 || files.length > 10) throw new AuthError(400, "INVALID_DOCUMENTS", "Choose between 1 and 10 documents.");
    const titles = z.array(z.string().trim().min(1).max(160)).min(1).max(10).parse(input);
    if (titles.length !== files.length) throw new AuthError(400, "INVALID_DOCUMENTS", "Provide titles for all documents.");
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const asset = planAsset(files[i]!, false, false, true);
      await this.repository.journal(owner, asset);
      const uploaded = await this.storage.upload(files[i]!, asset);
      results.push({ upload_id: this.uploadHandle(owner, id, "document", uploaded), title: titles[i]!, mime_type: uploaded.mime_type, size_bytes: uploaded.size_bytes });
    }
    return results;
  }
  async mandateSignatureUpload(owner: string, id: string, files: UploadFile[]) {
    const listing = await this.own(owner, id);
    if (!["UNLISTED", "REJECTED"].includes(listing.listing_status)) throw new AuthError(409, "LISTING_LOCKED", "Unlist this property before editing.");
    if (files.length !== 1) throw new AuthError(400, "INVALID_SIGNATURE", "Provide exactly one signature.");
    const file = files[0]!;
    const asset = planAsset(file, false, true);
    await this.repository.journal(owner, asset);
    const uploaded = await this.storage.upload(file, asset);
    return { upload_id: this.uploadHandle(owner, id, "signature", uploaded), mime_type: uploaded.mime_type, size_bytes: uploaded.size_bytes };
  }
  async saveMandate(owner: string, id: string, input: unknown) {
    const listing = await this.own(owner, id);
    if (!["UNLISTED", "REJECTED"].includes(listing.listing_status)) throw new AuthError(409, "LISTING_LOCKED", "Unlist this property before editing.");
    const payload = mandateSaveInput.parse(input);
    const currentMandate = await this.repository.mandate(owner, id);
    const signature = payload.signature.kind === "upload"
      ? this.resolveUpload(owner, id, "signature", payload.signature.upload_id)
      : currentMandate
        ? { public_id: currentMandate.signature_public_id, resource_type: "raw" as const, delivery_type: "authenticated" as const, url: "", mime_type: currentMandate.signature_mime_type, size_bytes: currentMandate.signature_size_bytes }
        : null;
    if (!signature) throw new AuthError(400, "INVALID_UPLOAD", "A saved signature was not found. Upload the signature again.");
    const documents: MandateDocumentInput[] = payload.documents.map((document) => {
      if (document.kind === "upload") return { ...this.resolveUpload(owner, id, "document", document.upload_id), title: document.title };
      const retained = currentMandate?.documents.find((candidate) => candidate.id === document.id);
      if (!retained) throw notFound();
      return { public_id: retained.public_id, resource_type: retained.resource_type, delivery_type: retained.delivery_type, mime_type: retained.mime_type, size_bytes: retained.size_bytes, title: retained.title };
    });
    const content = mandateInput.parse({ ...payload.content, signature_public_id: signature.public_id, signature_mime_type: signature.mime_type, signature_size_bytes: signature.size_bytes });
    const signature_public_id = signature.public_id;
    const oldSignature: CleanupAsset | null = currentMandate && currentMandate.signature_public_id !== signature_public_id
      ? { public_id: currentMandate.signature_public_id, resource_type: "raw", delivery_type: "authenticated" }
      : null;
    const newSignatureAsset: CleanupAsset = { public_id: signature_public_id, resource_type: "raw", delivery_type: "authenticated" };

    try {
      await this.repository.mutateMandate(owner, id, content, documents);
    } catch (error) {
      // Reconcile through the reference-aware cleanup path. A retained signature
      // must never be deleted, and an ambiguous RPC result may have committed.
      if (!currentMandate || currentMandate.signature_public_id !== signature_public_id)
        await this.cleanup(owner, [newSignatureAsset]);
      throw error;
    }

    const explicitCleanup: CleanupAsset[] = [];
    if (oldSignature) explicitCleanup.push(oldSignature);
    if (currentMandate?.documents) {
      for (const doc of currentMandate.documents) {
        if (!documents.some(d => d.public_id === doc.public_id)) {
          explicitCleanup.push({ public_id: doc.public_id, resource_type: doc.resource_type, delivery_type: doc.delivery_type });
        }
      }
    }
    await this.cleanup(owner, explicitCleanup);
    return this.mandate(owner, id);
  }
  async mandateRecord(owner: string, id: string): Promise<SalesMandate> {
    const mandate = await this.repository.mandate(owner, id);
    if (!mandate) throw notFound();
    return mandate;
  }
  async mandate(owner: string, id: string): Promise<SalesMandateView> {
    return presentMandate(await this.mandateRecord(owner, id));
  }
  async submit(owner: string, id: string) {
    await this.repository.submit(owner, id);
    return this.own(owner, id);
  }
}
