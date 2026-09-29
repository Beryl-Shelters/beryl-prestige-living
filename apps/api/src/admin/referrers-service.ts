import { AuthError } from "../auth/errors.js";
import type { MediaStorage } from "../listings/media.js";
import type { MediaAsset } from "../listings/model.js";
import type { CleanupAsset } from "../listings/repository.js";
import type { UploadFile } from "../listings/uploads.js";
import type { AdminReferrerQuery } from "./referrers-model.js";
import type { AdminReferrersRepository } from "./referrers-repository.js";

export class AdminReferrersService {
  constructor(
    private readonly repository: AdminReferrersRepository,
    private readonly storage: MediaStorage,
  ) {}
  directory(query: AdminReferrerQuery) {
    return this.repository.directory(query);
  }
  detail(id: string, page: number, pageSize: number) {
    return this.repository.detail(id, page, pageSize);
  }
  preview(admin: string, commission: string) {
    return this.repository.preview(admin, commission);
  }
  receipt(admin: string, payment: string) {
    return this.repository.receipt(admin, payment);
  }
  beginWithdrawal(admin:string,withdrawal:string){return this.repository.beginWithdrawal(admin,withdrawal);}
  rejectWithdrawal(admin:string,withdrawal:string,reason:string){return this.repository.rejectWithdrawal(admin,withdrawal,reason);}
  withdrawalPreview(admin:string,withdrawal:string){return this.repository.withdrawalPreview(admin,withdrawal);}
  async payWithdrawal(requestId:string,admin:string,withdrawal:string,file:UploadFile){
    const prior=await this.repository.withdrawalByRequest(admin,requestId);
    if(prior){if(prior.withdrawalId===withdrawal)return prior;throw new AuthError(409,"PAYMENT_REQUEST_CONFLICT","This payment request was already used.");}
    await this.repository.withdrawalPreview(admin,withdrawal);
    const extension=file.mime==="application/pdf"?"pdf":file.mime==="image/png"?"png":"jpg",target:CleanupAsset={public_id:`beryl-v2/referral-payouts/withdrawals/${withdrawal}/${requestId}.${extension}`,resource_type:"raw",delivery_type:"authenticated"};
    let uploaded:MediaAsset;
    try{uploaded=await this.storage.upload(file,target);}catch(error){try{const candidate:MediaAsset={...target,url:"",mime_type:file.mime,size_bytes:file.bytes.length},stored=Buffer.from(await this.storage.download(candidate));if(!stored.equals(file.bytes))throw error;uploaded=candidate;}catch{throw error;}}
    try{return await this.repository.recordWithdrawal(requestId,admin,withdrawal,uploaded);}catch(error){const committed=await this.repository.withdrawalByRequest(admin,requestId).catch(()=>null);if(committed)return committed;await this.storage.remove(target).catch(()=>{});throw error;}
  }
  async pay(
    requestId: string,
    admin: string,
    commission: string,
    file: UploadFile,
  ) {
    const prior = await this.repository.byRequest(admin, requestId);
    if (prior) {
      if (prior.commissionId === commission) return prior;
      throw new AuthError(
        409,
        "PAYMENT_REQUEST_CONFLICT",
        "This payment request was already used.",
      );
    }
    await this.repository.preview(admin, commission);
    const extension =
        file.mime === "application/pdf"
          ? "pdf"
          : file.mime === "image/png"
            ? "png"
            : "jpg",
      target: CleanupAsset = {
        public_id: `beryl-v2/referral-payouts/${commission}/${requestId}.${extension}`,
        resource_type: "raw",
        delivery_type: "authenticated",
      };
    let uploaded: MediaAsset;
    try {
      uploaded = await this.storage.upload(file, target);
    } catch (error) {
      try {
        const candidate: MediaAsset = {
            ...target,
            url: "",
            mime_type: file.mime,
            size_bytes: file.bytes.length,
          },
          stored = Buffer.from(await this.storage.download(candidate));
        if (!stored.equals(file.bytes)) throw error;
        uploaded = candidate;
      } catch {
        throw error;
      }
    }
    try {
      return await this.repository.record(
        requestId,
        admin,
        commission,
        uploaded,
      );
    } catch (error) {
      const committed = await this.repository
        .byRequest(admin, requestId)
        .catch(() => null);
      if (committed) return committed;
      await this.storage.remove(target).catch(() => {});
      throw error;
    }
  }
}
