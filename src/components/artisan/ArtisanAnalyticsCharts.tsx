import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, BarChart3, PieChart as PieIcon } from 'lucide-react';
import type {
  ArtisanRevenueTrendPoint,
  ArtisanRevenueSummary,
  ArtisanPerformanceMetrics,
  ArtisanOrderCounts,
} from '@/lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const shortDate = (d: string) => {
  if (!d) return '';
  // d is either YYYY-MM-DD or YYYY-MM
  const parts = d.split('-');
  if (parts.length === 2) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(parts[1], 10) - 1]} '${parts[0].slice(2)}`;
  }
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// ── Recharts tooltip prop shape ─────────────────────────────────────────────
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
}

// ── Revenue Tooltip ───────────────────────────────────────────────────────────
function RevTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white shadow-sm px-3 py-2 text-sm">
      <p className="font-medium mb-1">{shortDate(label ?? '')}</p>
      <p className="text-purple-700 font-semibold">{fmt(payload[0]?.value ?? 0)}</p>
      {payload[1] && (
        <p className="text-muted-foreground">{payload[1].value} orders</p>
      )}
    </div>
  );
}

// Status donut colours
const STATUS_COLORS: Record<string, string> = {
  placed:           '#f59e0b',
  confirmed:        '#3b82f6',
  processing:       '#8b5cf6',
  packed:           '#6366f1',
  shipped:          '#f97316',
  out_for_delivery: '#06b6d4',
  delivered:        '#22c55e',
  cancelled:        '#ef4444',
  returned:         '#6b7280',
  refunded:         '#ec4899',
  rejected:         '#dc2626',
};

const STATUS_LABELS: Record<string, string> = {
  placed:           'Placed',
  confirmed:        'Confirmed',
  processing:       'Processing',
  packed:           'Packed',
  shipped:          'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
  returned:         'Returned',
  refunded:         'Refunded',
  rejected:         'Rejected',
};

// ── Donut tooltip ─────────────────────────────────────────────────────────────
function DonutTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-lg border bg-white shadow-sm px-3 py-2 text-sm">
      <p className="font-medium">{STATUS_LABELS[name ?? ''] ?? (name ?? '')}</p>
      <p className="text-muted-foreground">{value} orders</p>
    </div>
  );
}

// ── Bar tooltip ───────────────────────────────────────────────────────────────
function ProductTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white shadow-sm px-3 py-2 text-sm max-w-[200px]">
      <p className="font-medium line-clamp-2 mb-1">{label}</p>
      <p className="text-orange-700 font-semibold">{fmt(payload[0]?.value ?? 0)}</p>
      {payload[1] && <p className="text-muted-foreground">{payload[1].value} sold</p>}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ArtisanAnalyticsChartsProps {
  trend: ArtisanRevenueTrendPoint[];
  revenue: ArtisanRevenueSummary | null;
  performance: ArtisanPerformanceMetrics | null;
  orderCounts: ArtisanOrderCounts | null;
  period: '7days' | '30days' | '90days' | '1year';
  onPeriodChange: (p: '7days' | '30days' | '90days' | '1year') => void;
  loading?: boolean;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ChartSkeleton({ heightClass = 'h-[220px]' }: { heightClass?: string }) {
  return (
    <div className={`bg-muted/40 rounded-lg animate-pulse ${heightClass}`} />
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ArtisanAnalyticsCharts({
  trend,
  revenue,
  performance,
  orderCounts,
  period,
  onPeriodChange,
  loading,
}: ArtisanAnalyticsChartsProps) {
  // Build status donut data
  const statusData = orderCounts
    ? Object.entries(orderCounts.byStatus ?? {})
        .filter(([, v]) => (v as number) > 0)
        .map(([k, v]) => ({ name: k, value: v as number }))
    : [];

  // Build top products bar data (truncate name at 18 chars)
  const topProductsData = (performance?.topProducts ?? [])
    .slice(0, 7)
    .map((p) => ({
      name: p.productName.length > 20 ? p.productName.slice(0, 18) + '…' : p.productName,
      revenue: p.totalRevenue,
      sold: p.totalSold,
    }));

  const PERIODS: Array<{ value: '7days' | '30days' | '90days' | '1year'; label: string }> = [
    { value: '7days',  label: '7D' },
    { value: '30days', label: '30D' },
    { value: '90days', label: '90D' },
    { value: '1year',  label: '1Y'  },
  ];

  return (
    <div className="space-y-6">
      {/* ── Revenue Trend ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <div>
                <CardTitle className="text-base">Revenue Trend</CardTitle>
                <CardDescription className="text-xs">
                  {revenue
                    ? `Current: ${fmt(revenue.current)}  ·  Prev: ${fmt(revenue.previous)}  ·  Growth: ${revenue.growthPct > 0 ? '+' : ''}${revenue.growthPct.toFixed(1)}%`
                    : 'Revenue over time'}
                </CardDescription>
              </div>
            </div>
            {/* Period switcher */}
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <Button
                  key={p.value}
                  variant={period === p.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => onPeriodChange(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <ChartSkeleton />
          ) : trend.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              No revenue data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="text-border" stroke="currentColor" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={shortDate}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  tickLine={false}
                  axisLine={false}
                  width={46}
                />
                <Tooltip content={<RevTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#revGradient)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#8b5cf6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Bottom row: status donut + top products ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order status donut */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-blue-600" />
              <div>
                <CardTitle className="text-base">Order Status Distribution</CardTitle>
                <CardDescription className="text-xs">
                  {orderCounts?.total ?? 0} total orders
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton heightClass="h-[200px]" />
            ) : statusData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                No order data yet
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={STATUS_COLORS[entry.name] ?? '#94a3b8'}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-wrap lg:flex-col gap-1.5 min-w-[120px]">
                  {statusData.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs">
                      <svg width="10" height="10" className="shrink-0" aria-hidden="true">
                        <circle cx="5" cy="5" r="5" fill={STATUS_COLORS[s.name] ?? '#94a3b8'} />
                      </svg>
                      <span className="text-muted-foreground">{STATUS_LABELS[s.name] ?? s.name}</span>
                      <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-auto">{s.value}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top products horizontal bar */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-600" />
              <div>
                <CardTitle className="text-base">Top Products</CardTitle>
                <CardDescription className="text-xs">By revenue earned</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ChartSkeleton heightClass="h-[200px]" />
            ) : topProductsData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                No sales data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={topProductsData}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" opacity={0.2} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip content={<ProductTooltip />} />
                  <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Performance KPI row ───────────────────────────────────────────── */}
      {performance && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Performance Metrics</CardTitle>
            <CardDescription className="text-xs">All-time calculated KPIs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {[
                { label: 'Fulfillment', value: `${performance.fulfillmentRate.toFixed(1)}%`, color: 'text-green-700' },
                { label: 'Cancellation', value: `${performance.cancellationRate.toFixed(1)}%`, color: 'text-red-600' },
                { label: 'Rejection', value: `${performance.rejectionRate.toFixed(1)}%`, color: 'text-red-500' },
                { label: 'Return Rate', value: `${performance.returnRate.toFixed(1)}%`, color: 'text-amber-600' },
                { label: 'Avg Order Value', value: fmt(performance.avgOrderValue), color: 'text-purple-700' },
                { label: 'Avg Handling', value: `${performance.avgHandlingHours.toFixed(1)}h`, color: 'text-blue-700' },
              ].map((kpi) => (
                <div key={kpi.label} className="text-center p-3 rounded-lg bg-muted/40">
                  <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
