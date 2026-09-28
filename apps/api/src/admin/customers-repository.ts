import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AuthConfig } from "../auth/config.js";
import { AuthError, unavailable } from "../auth/errors.js";
import type {
  AdminCustomerDetail,
  AdminCustomerDirectoryPage,
  AdminCustomerDirectoryQuery,
} from "./customers-model.js";

export interface AdminCustomersRepository {
  directory(query: AdminCustomerDirectoryQuery): Promise<AdminCustomerDirectoryPage>;
  detail(customerId: string): Promise<AdminCustomerDetail>;
}

function customerReadError(error: { code?: string } | null): void {
  if (!error) return;
  if (error.code === "P0002") {
    throw new AuthError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  }
  if (error.code === "23514") {
    throw new AuthError(400, "INVALID_CUSTOMER_QUERY", "Check the customer query.");
  }
  throw unavailable();
}

export class SupabaseAdminCustomersRepository implements AdminCustomersRepository {
  private readonly db: SupabaseClient;

  constructor(config: AuthConfig, transport: typeof fetch = fetch) {
    this.db = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) =>
          transport(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }),
      },
    });
  }

  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(name, args);
    customerReadError(error);
    return data as T;
  }

  directory(query: AdminCustomerDirectoryQuery) {
    return this.rpc<AdminCustomerDirectoryPage>("list_admin_customers", {
      p_query: query.search,
      p_account_type: query.accountType,
      p_profile_type: query.profileType,
      p_sort: query.sort,
      p_page: query.page,
      p_page_size: query.pageSize,
    });
  }

  detail(customerId: string) {
    return this.rpc<AdminCustomerDetail>("read_admin_customer", { p_customer: customerId });
  }
}
