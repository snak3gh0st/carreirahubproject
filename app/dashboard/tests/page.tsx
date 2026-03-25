import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen, Users, Award, Clock } from "lucide-react";

type BadgeVariant = "success" | "warning" | "error" | "info" | "default";

function getLevelBadgeVariant(displayLevel: string): BadgeVariant {
  const level = displayLevel.toLowerCase();
  if (level.includes("beginner")) return "error";
  if (level.includes("intermediate")) return "warning";
  if (level.includes("advanced")) return "info";
  if (level.includes("fluent")) return "success";
  return "default";
}

function formatTimeSpent(seconds: number | null): string {
  if (!seconds) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * English Test Results Page
 *
 * Displays all placement test results with customer info, level, scores, and timing.
 */
export default async function TestsPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const search = searchParams.search || "";

  // Exclude pending tests (totalScore: -1 sentinel) — only show completed results
  const whereClause: any = { totalScore: { not: -1 } };
  if (search) {
    whereClause.customer = {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const tests = await prisma.placementTest.findMany({
    where: whereClause,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Statistics
  const totalTests = tests.length;
  const uniqueCustomers = new Set(tests.map((t) => t.customerId)).size;

  const avgScore =
    totalTests > 0
      ? Math.round(tests.reduce((sum, t) => sum + t.totalScore, 0) / totalTests)
      : 0;

  const maxPossibleScore =
    totalTests > 0
      ? Math.round(
          tests.reduce((sum, t) => sum + (t.questionCount || 25), 0) / totalTests
        )
      : 0;

  const avgTimeSpent =
    totalTests > 0
      ? Math.round(
          tests
            .filter((t) => t.timeSpentSeconds)
            .reduce((sum, t) => sum + (t.timeSpentSeconds || 0), 0) /
            tests.filter((t) => t.timeSpentSeconds).length || 0
        )
      : 0;

  // Level distribution
  const levelCounts: Record<string, number> = {};
  tests.forEach((t) => {
    levelCounts[t.displayLevel] = (levelCounts[t.displayLevel] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-gray-900">
            English Test Results
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Placement test results for all customers
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Total Tests"
            value={totalTests.toString()}
            icon={<BookOpen className="w-5 h-5" />}
          />
          <StatCard
            label="Unique Students"
            value={uniqueCustomers.toString()}
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            label="Avg Score"
            value={maxPossibleScore > 0 ? `${avgScore}/${maxPossibleScore}` : "-"}
            icon={<Award className="w-5 h-5" />}
          />
          <StatCard
            label="Avg Time"
            value={formatTimeSpent(avgTimeSpent)}
            icon={<Clock className="w-5 h-5" />}
          />
        </div>

        {/* Level Distribution */}
        {totalTests > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-display font-medium text-gray-500 uppercase tracking-wide mb-4">
              Level Distribution
            </h2>
            <div className="flex flex-wrap gap-4">
              {Object.entries(levelCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([level, count]) => (
                  <div key={level} className="flex items-center gap-2">
                    <Badge variant={getLevelBadgeVariant(level)}>{level}</Badge>
                    <span className="text-sm font-display font-semibold text-gray-900">
                      {count}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({Math.round((count / totalTests) * 100)}%)
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <form method="GET" className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Search by customer name or email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>
        </div>

        {/* Test Results Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    CEFR
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Score
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Time Spent
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState
                        icon={<BookOpen className="w-16 h-16" />}
                        title="No test results found"
                        description={
                          search
                            ? "No results match your search. Try a different term."
                            : "Test results will appear here once customers complete the placement test."
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  tests.map((test) => (
                    <tr
                      key={test.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <Link
                            href={`/dashboard/customers/${test.customer.id}`}
                            className="text-sm font-display font-medium text-primary-600 hover:text-primary-700"
                          >
                            {test.customer.name}
                          </Link>
                          <span className="text-xs text-gray-500">
                            {test.customer.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getLevelBadgeVariant(test.displayLevel)}>
                          {test.displayLevel}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-display font-semibold text-gray-900">
                          {test.cefrLevel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-display font-semibold text-gray-900 tabular-nums">
                          {test.totalScore}/{test.questionCount || 25}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-display text-gray-700 tabular-nums">
                          {Math.round(test.percentage)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 tabular-nums">
                        {format(new Date(test.createdAt), "MMM dd, yyyy")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 tabular-nums">
                        {formatTimeSpent(test.timeSpentSeconds)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
