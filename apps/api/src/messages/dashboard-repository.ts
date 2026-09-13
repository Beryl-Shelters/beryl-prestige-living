import { EmptyDashboardRepository, type RecentListing } from "../dashboard/repository.js";
import type { TicketsRepository } from "./repository.js";

export class MessagesDashboardRepository extends EmptyDashboardRepository {
  constructor(private readonly tickets:TicketsRepository,private readonly listings:(owner:string)=>Promise<RecentListing[]>){super();}
  override messages(customerId?:string){return customerId?this.tickets.overview(customerId):Promise.resolve({unread:0,recent:[]});}
  override recentListings(customerId?:string){return customerId?this.listings(customerId):Promise.resolve([]);}
}
