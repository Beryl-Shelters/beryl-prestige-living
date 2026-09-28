import type { AdminCustomerDirectoryQuery } from "./customers-model.js";
import type { AdminCustomersRepository } from "./customers-repository.js";

export class AdminCustomersService {
  constructor(private readonly repository: AdminCustomersRepository) {}

  directory(query: AdminCustomerDirectoryQuery) {
    return this.repository.directory(query);
  }

  detail(customerId: string) {
    return this.repository.detail(customerId);
  }
}
