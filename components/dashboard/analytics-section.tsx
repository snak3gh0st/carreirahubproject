"use client"

import { useEffect, useState } from "react"
import { RevenueChart } from "./revenue-chart"
import { InvoiceStatusChart } from "./invoice-status-chart"
import { ConversionFunnel } from "./conversion-funnel"

interface AnalyticsData {
  revenue: Array<{ date: string; revenue: number }>
  invoiceStatus: Array<{ name: string; value: number }>
  conversionFunnel: Array<{ stage: string; count: number; percentage?: number }>
}

export function AnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        const response = await fetch("/api/analytics/dashboard")
        if (!response.ok) {
          throw new Error("Failed to fetch analytics")
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border p-6 bg-gray-50 animate-pulse"
          >
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-red-800">
          {error || "Falha ao carregar dados de análise"}
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Análises</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <RevenueChart data={data.revenue} />
        <InvoiceStatusChart data={data.invoiceStatus} />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <ConversionFunnel data={data.conversionFunnel} />
      </div>
    </div>
  )
}
