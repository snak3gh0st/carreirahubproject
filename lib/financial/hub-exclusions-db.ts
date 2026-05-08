import { prisma } from "@/lib/db";
import { isFinancialHubExcludedCustomer } from "@/lib/financial/hub-exclusions";

let excludedCustomerIdsPromise: Promise<string[]> | null = null;

export function getFinancialHubExcludedCustomerIds(): Promise<string[]> {
  if (!excludedCustomerIdsPromise) {
    excludedCustomerIdsPromise = prisma.customer
      .findMany({
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
      .then((customers) => customers
        .filter(isFinancialHubExcludedCustomer)
        .map((customer) => customer.id))
      .catch((error) => {
        excludedCustomerIdsPromise = null;
        throw error;
      });
  }

  return excludedCustomerIdsPromise;
}
