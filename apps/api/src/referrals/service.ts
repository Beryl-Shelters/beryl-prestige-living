import type { AuthConfig } from "../auth/config.js";
import { referralCommissionBasisPoints, referralPageSize, type CreatedReferral, type ReferralPage } from "./model.js";
import type { ReferralsRepository } from "./repository.js";

export class ReferralsService {
  constructor(private readonly config:AuthConfig,private readonly repository:ReferralsRepository){}
  async list(owner:string,page:number):Promise<ReferralPage>{
    const ledger=await this.repository.list(owner,page,referralPageSize);
    const totalEarned=Number(ledger.summary.totalEarnings??0),totalPaid=Number(ledger.summary.paid??0);
    return {
      program:{commissionRateBasisPoints:referralCommissionBasisPoints},
      summary:{totalEarned,totalPaid,unpaidBalance:Math.max(totalEarned-totalPaid,0),referrals:ledger.summary.referrals,propertiesSold:ledger.summary.propertiesSold},
      items:ledger.items,page:ledger.page,pageSize:ledger.pageSize,total:ledger.total,totalPages:ledger.totalPages,
    };
  }
  async create(owner:string,type:"PROPERTY"|"SELLER",listingId:string|null):Promise<CreatedReferral>{
    const row=await this.repository.create(owner,type,listingId);
    const path=type==="PROPERTY"?`/buy?code=${encodeURIComponent(row.propertyCode!)}&ref=${encodeURIComponent(row.id)}`:`/register?ref=${encodeURIComponent(row.id)}`;
    return {...row,referralUrl:`${this.config.webOrigin}${path}`};
  }
  async createPublicProperty(referrer:string,propertyCode:string):Promise<CreatedReferral>{
    const row=await this.repository.createPublicProperty(referrer,propertyCode);
    return {...row,referralUrl:`${this.config.webOrigin}/buy?code=${encodeURIComponent(row.propertyCode!)}&ref=${encodeURIComponent(row.id)}`};
  }
}
