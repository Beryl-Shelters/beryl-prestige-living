import type { AdminCompletedPurchaseInput } from "./purchases-model.js";
import type { AdminPurchasesRepository } from "./purchases-repository.js";

export class AdminPurchasesService {
  constructor(private readonly repository:AdminPurchasesRepository){}
  validate(adminId:string,referralCode:string,customerId:string,propertyCode:string,closedAt:string){return this.repository.validate(adminId,referralCode,customerId,propertyCode,closedAt);}
  record(adminId:string,input:AdminCompletedPurchaseInput){return this.repository.record(adminId,input);}
}
