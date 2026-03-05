import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Sparkles,
  CheckCircle2,
  Award,
} from 'lucide-react';
import type { ArtisanOrderCounts, ArtisanRevenueSummary, ArtisanPerformanceMetrics } from '@/lib/api';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

function GrowthChip({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) {
    return (
      <Badge variant="outline" className="text-xs px-1.5 gap-0.5">
        <Minus className="w-3 h-3" /> Flat
      </Badge>
    );
  }
  if (value > 0) {
    return (
      <Badge className="text-xs px-1.5 gap-0.5 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        <TrendingUp className="w-3 h-3" /> {pct(value)}
      </Badge>
    );
  }
  return (
    <Badge className="text-xs px-1.5 gap-0.5 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
      <TrendingDown className="w-3 h-3" /> {pct(value)}
    </Badge>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
interface DashboardStatsRowProps {
  orderCounts: ArtisanOrderCounts | null;
  revenue: ArtisanRevenueSummary | null;
  performance: ArtisanPerformanceMetrics | null;
  loading?: boolean;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function StatSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-6">
        <div className="h-3 bg-muted rounded w-24 mb-3" />
        <div className="h-7 bg-muted rounded w-16 mb-2" />
        <div className="h-3 bg-muted rounded w-20" />
      </CardContent>
    </Card>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function DashboardStatsRow({ orderCounts, revenue, performance, loading }: DashboardStatsRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Orders',
      value: orderCounts?.total ?? 0,
      subLabel: `${orderCounts?.newToday ?? 0} new today`,
      icon: ShoppingCart,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Pending Action',
      value: orderCounts?.pending ?? 0,
      subLabel: `${orderCounts?.byStatus?.placed ?? 0} need review`,
      icon: Clock,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      highlight: (orderCounts?.byStatus?.placed ?? 0) > 0,
    },
    {
      label: 'Delivered',
      value: orderCounts?.delivered ?? 0,
      subLabel: `${orderCounts?.cancelled ?? 0} cancelled`,
      icon: CheckCircle2,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-50',
    },
    {
      label: 'Revenue (Period)',
      value: fmt(revenue?.current ?? 0),
      subLabel: null,
      chip: revenue ? <GrowthChip value={revenue.growthPct} /> : undefined,
      icon: IndianRupee,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
    },
    {
      label: 'All-Time Revenue',
      value: fmt(revenue?.allTime ?? 0),
      subLabel: `${fmt(revenue?.pending ?? 0)} pending`,
      icon: Sparkles,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-50',
    },
    {
      label: 'Fulfillment Rate',
      value: `${(performance?.fulfillmentRate ?? 0).toFixed(1)}%`,
      subLabel: `Avg rating ${(performance?.avgRating ?? 0).toFixed(1)} ★`,
      icon: Award,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card
            key={stat.label}
            className={stat.highlight ? 'border-amber-300 bg-amber-50/40 shadow-sm' : ''}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground leading-tight">{stat.label}</p>
                <div className={`p-1.5 rounded-md ${stat.iconBg}`}>
                  <Icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              <div className="mt-1 flex items-center gap-1.5">
                {stat.chip}
                {stat.subLabel && (
                  <p className="text-xs text-muted-foreground">{stat.subLabel}</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
