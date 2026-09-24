import { createHash, randomUUID } from "node:crypto";
import { AuthError } from "../auth/errors.js";
import type { MediaAsset } from "./model.js";
import type { CleanupAsset } from "./repository.js";
import type { UploadFile } from "./uploads.js";
export interface MediaStorage {
  upload(file: UploadFile, asset: CleanupAsset): Promise<MediaAsset>;
  remove(asset: CleanupAsset): Promise<void>;
  download(asset: MediaAsset): Promise<Uint8Array>;
}
const unavailable = () => new AuthError(503,"MEDIA_UNAVAILABLE","File storage is temporarily unavailable. Please try again.");
export function planAsset(file: UploadFile, document: boolean, signature: boolean = false, mandateDocument: boolean = false): CleanupAsset {
  const extension = file.mime === "application/pdf" ? "pdf" : file.mime === "image/png" ? "png" : "jpg";
  if (signature) return { public_id: `beryl-v2/mandates/signatures/${randomUUID()}.png`, resource_type: "raw", delivery_type: "authenticated" };
  if (mandateDocument) return { public_id: `beryl-v2/mandates/documents/${randomUUID()}.${extension}`, resource_type: "raw", delivery_type: "authenticated" };
  return { public_id: `beryl-v2/listings/${randomUUID()}${document ? `.${extension}` : ""}`, resource_type: document ? "raw" : "image", delivery_type: document ? "authenticated" : "upload" };
}
export class CloudinaryStorage implements MediaStorage {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env, private readonly transport: typeof fetch = fetch) {}
  private config() {
    const cloud=this.env.CLOUDINARY_CLOUD_NAME, key=this.env.CLOUDINARY_API_KEY, secret=this.env.CLOUDINARY_API_SECRET;
    if (!cloud || !/^[\w-]+$/.test(cloud) || !key || !secret) throw unavailable();
    return { cloud, key, secret };
  }
  private signed(params: Record<string,string>) {
    const { key, secret }=this.config();
    const signature=createHash("sha1").update(Object.keys(params).sort().map(key=>`${key}=${params[key]}`).join("&")+secret).digest("hex");
    return { ...params, api_key:key, signature };
  }
  async upload(file: UploadFile, asset: CleanupAsset) {
    const { cloud }=this.config();
    const fields=this.signed({ timestamp:String(Math.floor(Date.now()/1000)), public_id:asset.public_id, type:asset.delivery_type, overwrite:"false" });
    const body=new FormData(); Object.entries(fields).forEach(([key,value])=>body.set(key,value));
    body.set("file",new Blob([new Uint8Array(file.bytes)], { type:file.mime }), "upload");
    try {
      const response=await this.transport(`https://api.cloudinary.com/v1_1/${cloud}/${asset.resource_type}/upload`, { method:"POST",body,signal:AbortSignal.timeout(30000) });
      if (!response.ok) throw unavailable();
      const result=await response.json() as { public_id:string; secure_url:string };
      if (result.public_id!==asset.public_id || !result.secure_url.startsWith(`https://res.cloudinary.com/${cloud}/`)) throw unavailable();
      return { ...asset, url:asset.resource_type==="raw" ? "" : result.secure_url, mime_type:file.mime, size_bytes:file.bytes.length };
    } catch { throw unavailable(); }
  }
  async remove(asset: CleanupAsset) {
    const { cloud }=this.config();
    const body=new URLSearchParams(this.signed({ timestamp:String(Math.floor(Date.now()/1000)), public_id:asset.public_id, type:asset.delivery_type, invalidate:"true" }));
    const response=await this.transport(`https://api.cloudinary.com/v1_1/${cloud}/${asset.resource_type}/destroy`, {method:"POST",body,signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw unavailable();
    const result=await response.json() as { result:string }; if (!["ok","not found"].includes(result.result)) throw unavailable();
  }
  async download(asset: MediaAsset) {
    const { cloud }=this.config();
    // Short-lived provider URL stays server-side; browser receives attachment bytes.
    const query=new URLSearchParams(this.signed({ public_id:asset.public_id, type:"authenticated", timestamp:String(Math.floor(Date.now()/1000)), expires_at:String(Math.floor(Date.now()/1000)+60), attachment:"true" }));
    try {
      const response=await this.transport(`https://api.cloudinary.com/v1_1/${cloud}/raw/download?${query}`, {signal:AbortSignal.timeout(15000)});
      if (!response.ok || Number(response.headers.get("content-length"))>10485760) throw unavailable();
      const reader=response.body?.getReader(); if (!reader) throw unavailable();
      const chunks: Uint8Array[]=[]; let length=0;
      for (;;) { const {done,value}=await reader.read(); if(done) break; length+=value.length; if(length>10485760) { await reader.cancel(); throw unavailable(); } chunks.push(value); }
      return Buffer.concat(chunks);
    } catch { throw unavailable(); }
  }
}
