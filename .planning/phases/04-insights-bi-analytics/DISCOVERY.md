# Phase 4: Insights (BI & Analytics) - Discovery

**Discovery Date:** 2026-01-15
**Research Depth:** Standard (Level 2)

## Research Question

What charting library and caching strategy should we use for a Finance BI dashboard in Next.js 14 App Router with QuickBooks/DocuSign data?

## Charting Library Comparison

### Recharts (Recommended)
**Pros:**
- Simple, declarative API - perfect for standard business charts
- Native React components with clean SVG rendering
- Excellent for moderate datasets (Finance dashboards typically <10k data points)
- Active maintenance and good TypeScript support
- "Batteries included" - works out of the box

**Cons:**
- Less performant with very large datasets (>10k points)
- Less flexible - makes design decisions for you
- Limited 3D and advanced visualization options

**Use Case:** Best for Finance dashboards with standard charts (line, bar, pie)

### Chart.js (react-chartjs-2)
**Pros:**
- Lightweight and good performance for most use cases
- Canvas-based rendering (faster than SVG for animations)
- Excellent documentation and beginner-friendly
- Large community and plugin ecosystem

**Cons:**
- React wrapper adds overhead
- Performance issues with very large datasets or complex charts
- Canvas rendering less accessible than SVG

**Use Case:** Good balance for medium-complexity dashboards

### Apache ECharts
**Pros:**
- Best performance for large datasets (supports WebGL)
- Most comprehensive feature set (3D, maps, geographic viz)
- Highly optimized for rendering thousands of data points
- Supports lazy loading and progressive rendering

**Cons:**
- Steeper learning curve
- Overkill for simple Finance dashboards
- Larger bundle size
- More complex API

**Use Case:** Large-scale BI with 100k+ data points or advanced visualizations

## Decision: Recharts

**Rationale:**
- Finance dashboard requires standard charts (line, bar, pie, area)
- Dataset size: ~5000 invoices, ~500 customers (moderate scale)
- Team velocity: Recharts' simplicity enables faster development
- Maintenance: Well-established, actively maintained library
- TypeScript: Excellent type safety for Finance data
- Quick depth setting: Recharts is fastest to implement

**Trade-off:** If dataset grows >10k invoices, may need to revisit (paginate or switch to ECharts)

## Caching Strategy for Next.js 14 Dashboards

### Best Practices (2026)

**For Finance Dashboards (Authenticated, Personalized):**
1. **Disable server caching** using `export const dynamic = 'force-dynamic'`
   - Prevents user data leakage between sessions
   - Dashboard data is user-specific and time-sensitive

2. **Client-side caching with React Query/TanStack Query**
   - Safe for personalized data
   - staleTime: 5 minutes for invoice/customer data
   - Automatic background revalidation

3. **Streaming with Suspense for real-time KPIs**
   - Load static layout immediately
   - Stream dynamic KPI data as it becomes available
   - Improved perceived performance

4. **Tag-based revalidation** (not path-based)
   - Use revalidateTag over revalidatePath (more precise, less expensive)
   - Example: revalidateTag('invoices') when QB webhook updates invoice

### Multi-Layer Approach

| Data Type | Strategy | Rationale |
|-----------|----------|-----------|
| KPIs (revenue, overdue) | Streaming SSR | Real-time accuracy critical |
| Invoice list | Dynamic SSR + client cache | Fresh data, but safe to cache client-side |
| Charts (trends) | Dynamic SSR + SWR | Tolerate 5min staleness |
| Static layout | Static generation | Never changes |

### Implementation Pattern

```typescript
// Dashboard page: Force dynamic rendering
export const dynamic = 'force-dynamic';

// Use React Query for client caching
const { data: invoices } = useQuery({
  queryKey: ['invoices', filters],
  queryFn: fetchInvoices,
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: true
});
```

## Data Aggregation Strategy

**For Finance BI:**
- **Pre-aggregate in database** (SQL views or materialized views)
  - Invoice status distribution → SQL view
  - Customer payment metrics → SQL view
  - Revenue trends → SQL aggregation query

- **Cache aggregations in Redis** (optional, if performance degrades)
  - KPI counters (total revenue, overdue count) → Redis with 5min TTL
  - Daily revenue trend → Redis with 1hr TTL

**Current approach:** Query aggregations from PostgreSQL directly
- Dataset size doesn't warrant Redis caching yet
- Neon Postgres handles aggregations efficiently at current scale

## Performance Targets

**Dashboard Load Time:**
- Initial paint: <1s (static layout)
- Full interactive: <2s (all charts loaded)
- KPI updates: <500ms (streaming)

**Chart Rendering:**
- Simple charts (pie, bar): <100ms
- Complex charts (multi-series line): <300ms
- Page pagination: <200ms

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chart Library | Recharts | Simple API, sufficient for Finance charts |
| Server Caching | Disabled (force-dynamic) | Prevent user data leakage |
| Client Caching | React Query (5min staleTime) | Safe for personalized data |
| Data Aggregation | SQL views | Sufficient at current scale |
| Real-time Updates | Streaming with Suspense | Improved perceived performance |
| Bundle Strategy | Lazy load charts | Reduce initial bundle size |

## Dependencies

**New packages to install:**
```json
{
  "recharts": "^2.15.0",
  "@tanstack/react-query": "^5.59.0",
  "date-fns": "^4.1.0"
}
```

## Sources

- [Best React Chart Libraries 2025 - LogRocket](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [JavaScript Charting Libraries 2026 - Embeddable](https://embeddable.com/blog/javascript-charting-libraries)
- [Next.js Caching Guide](https://nextjs.org/docs/app/guides/caching)
- [Multi-Layer Caching in Next.js App Router - DEV](https://dev.to/maurya-sachin/building-a-multi-layer-caching-strategy-in-nextjs-app-router-from-static-to-real-time-4che)
- [Advanced Caching Strategies Next.js 2025 - Medium](https://medium.com/@itsamanyadav/advanced-caching-strategies-in-next-js-2025-edition-6805939cf163)
