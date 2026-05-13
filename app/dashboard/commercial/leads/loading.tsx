import { LeadTableSkeleton } from "@/components/dashboard/lead-table-skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Leads & Pipeline</h1>
      {/* Skeleton pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white p-4 rounded-lg shadow">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-12"></div>
          </div>
        ))}
      </div>
      <LeadTableSkeleton />
    </div>
  );
}
