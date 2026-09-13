import type { AuthConfig } from "../auth/config.js";
import { referralCommissionBasisPoints, referralPageSize, type CreatedReferral, type ReferralPage } from "./model.js";
import type { ReferralsRepository } from "./repository.js";

export class ReferralsService {
  constructor(private readonly config:AuthConfig,private readonly repository:ReferralsRepository){}
  async list(owner:string,page:number):Promise<ReferralPage>{return {program:{commissionRateBasisPoints:referralCommissionBasisPoints},...await this.repository.list(owner,page,referralPageSize)};}
  async create(owner:string,type:"PROPERTY"|"SELLER",listingId:string|null):Promise<CreatedReferral>{
    const row=await this.repository.create(owner,type,listingId);
    const path=type==="PROPERTY"?`/properties/${encodeURIComponent(row.propertyCode!)}`:"/register";
    return {...row,referralUrl:`${this.config.webOrigin}${path}?ref=${encodeURIComponent(row.id)}`};
  }
}
