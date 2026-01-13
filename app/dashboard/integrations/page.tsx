import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Integrations Hub
 * Central page for all integration-related functionality
 */
export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Check permissions (ADMIN and FINANCE only)
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-gray-600 mt-2">
          Manage connections with QuickBooks and Pipedrive
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Integration Settings */}
        <Link href="/dashboard/settings/integrations">
          <div className="bg-white rounded-lg shadow hover:shadow-md transition p-6 cursor-pointer border-2 border-transparent hover:border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">Settings</h3>
            <p className="text-sm text-gray-600">
              Configure QuickBooks and Pipedrive connections, manage OAuth tokens, and set up webhooks
            </p>
            <div className="mt-4 text-blue-600 text-sm font-medium">
              Configure →
            </div>
          </div>
        </Link>

        {/* Bulk Import */}
        <Link href="/dashboard/integrations/bulk-import">
          <div className="bg-white rounded-lg shadow hover:shadow-md transition p-6 cursor-pointer border-2 border-transparent hover:border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">Bulk Import</h3>
            <p className="text-sm text-gray-600">
              Import all existing customers, deals, and invoices from QuickBooks or Pipedrive
            </p>
            <div className="mt-4 text-green-600 text-sm font-medium">
              Start Import →
            </div>
          </div>
        </Link>

        {/* Sync Status */}
        <Link href="/dashboard/integrations/sync-status">
          <div className="bg-white rounded-lg shadow hover:shadow-md transition p-6 cursor-pointer border-2 border-transparent hover:border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2">Sync Status</h3>
            <p className="text-sm text-gray-600">
              Monitor real-time synchronization health, view recent sync logs, and track errors
            </p>
            <div className="mt-4 text-purple-600 text-sm font-medium">
              View Status →
            </div>
          </div>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/api/quickbooks/auth/connect"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition block"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">QuickBooks OAuth</h4>
                <p className="text-sm text-gray-600">Connect or reconnect QuickBooks</p>
              </div>
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </a>

          <Link
            href="/dashboard/integrations/bulk-import"
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Start New Import</h4>
                <p className="text-sm text-gray-600">Import data from external sources</p>
              </div>
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
