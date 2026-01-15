import { CustomerTableSkeleton } from "@/components/dashboard/customer-table-skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Customers</h1>
      <CustomerTableSkeleton />
    </div>
  );
}
