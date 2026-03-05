// ── Module 8: Artisan Dashboard Overhaul (UI) ───────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  ShoppingCart,
  Users,
  Star,
  Plus,
  MessageSquare,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Clock,
  Eye,
  ExternalLink,
  ChevronRight,
  Home,
  Bell,
  LayoutDashboard,
  Volume2,
  VolumeX,
  Zap,
  ShieldCheck,
  Menu,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { Order, Product, ArtisanDashboardBundle } from '@/lib/api';
import { DashboardStatsRow } from '@/components/artisan/DashboardStatsRow';
import { ArtisanAnalyticsCharts } from '@/components/artisan/ArtisanAnalyticsCharts';
import { AcceptOrderModal } from '@/components/artisan/AcceptOrderModal';
import { RejectionReasonModal } from '@/components/artisan/RejectionReasonModal';
import { ArtisanSidebar, type ArtisanSection } from '@/components/artisan/ArtisanSidebar';
import { ArtisanNotificationsCenter } from '@/components/artisan/ArtisanNotificationsCenter';
import { QuickActionsPanel } from '@/components/artisan/QuickActionsPanel';
import { OrdersManagementPage } from '@/components/artisan/OrdersManagementPage';
import { useOrderAlerts } from '@/hooks/useOrderAlerts';
import { ArtisanMobileBottomNav } from '@/components/artisan/ArtisanMobileBottomNav';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const STATUS_COLORS: Record<string, string> = {
  placed:           'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed:        'bg-blue-100 text-blue-800 border-blue-200',
  processing:       'bg-purple-100 text-purple-800 border-purple-200',
  packed:           'bg-indigo-100 text-indigo-800 border-indigo-200',
  shipped:          'bg-orange-100 text-orange-800 border-orange-200',
  out_for_delivery: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  delivered:        'bg-green-100 text-green-800 border-green-200',
  cancelled:        'bg-red-100 text-red-800 border-red-200',
  rejected:         'bg-red-100 text-red-900 border-red-300',
  returned:         'bg-gray-100 text-gray-700 border-gray-200',
  refunded:         'bg-pink-100 text-pink-800 border-pink-200',
};

const STATUS_LABEL: Record<string, string> = {
  placed:           'Placed',
  confirmed:        'Confirmed',
  processing:       'Processing',
  packed:           'Packed',
  shipped:          'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
  rejected:         'Rejected',
  returned:         'Returned',
  refunded:         'Refunded',
};

const SECTION_LABELS: Record<ArtisanSection, string> = {
  overview:  'Overview',
  orders:    'Orders',
  products:  'Products',
  analytics: 'Analytics',
  customers: 'Customers',
  reviews:   'Reviews',
  messages:  'Messages',
};

// ── KPI summary card ──────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  color = 'text-foreground',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 rounded-lg border bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
const ArtisanDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Module 8 state ──────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<ArtisanSection>('overview');
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [bundle, setBundle]               = useState<ArtisanDashboardBundle | null>(null);
  const [products, setProducts]           = useState<Product[]>([]);
  const [period, setPeriod]               = useState<'7days' | '30days' | '90days' | '1year'>('30days');
  const [acceptOrder, setAcceptOrder]     = useState<Order | null>(null);
  const [rejectOrder, setRejectOrder]     = useState<Order | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [soundEnabled, setSoundEnabled]   = useState(true);
  // ── Module 11: verification status ──────────────────────────────────────────
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);  // ── Module 14: mobile sidebar drawer state ─────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadDashboard = useCallback(
    async (silent = false, p = period) => {
      if (!silent) setLoading(true);
      else         setRefreshing(true);
      try {
        const [bundleData, productsData] = await Promise.all([
          api.artisanDashboard.getBundle(p),
          api.getArtisanProducts(),
        ]);
        setBundle(bundleData);
        setProducts(productsData.products);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('Dashboard load error:', err);
        if (!silent) {
          toast({
            title: 'Error',
            description: 'Failed to load dashboard data. Please refresh.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast, period],
  );

  useEffect(() => {
    if (user) {
      loadDashboard();
      const timer = setInterval(() => loadDashboard(true), 30_000);
      return () => clearInterval(timer);
    }
  }, [user, loadDashboard]);

  // ── Module 11: load verification status once ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    apiRequest<{ approvalStatus: 'pending' | 'approved' | 'rejected' }>(
      '/api/artisans/profile',
      { method: 'GET', auth: true },
    )
      .then((p) => setApprovalStatus(p.approvalStatus))
      .catch(() => { /* silently ignore — non-critical */ });
  }, [user]);

  const handlePeriodChange = (p: '7days' | '30days' | '90days' | '1year') => {
    setPeriod(p);
    loadDashboard(true, p);
  };

  const handleOrderActioned = () => loadDashboard(true);

  // ── Derived data ─────────────────────────────────────────────────────────────
  const recentOrders  = bundle?.recentOrders ?? [];
  const pendingOrders = recentOrders.filter((o) => o.status === 'placed');
  const lowStock      = bundle?.lowStockProducts ?? [];

  // ── Module 9: global new-order alerts ────────────────────────────────────────
  const { alertActive, newOrderIds, clearAlert } = useOrderAlerts(recentOrders, soundEnabled);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <aside className="hidden lg:flex flex-col w-64 bg-card border-r min-h-screen animate-pulse shrink-0">
          <div className="p-5 border-b"><div className="h-9 bg-muted rounded-lg" /></div>
          <div className="p-4 border-b"><div className="h-8 bg-muted rounded-full w-3/4" /></div>
          <div className="p-3 space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-9 bg-muted rounded-md" />
            ))}
          </div>
        </aside>
        <main className="flex-1 p-8 space-y-6">
          <div className="h-10 bg-muted rounded-lg w-64 animate-pulse" />
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 h-72 bg-muted rounded-lg animate-pulse" />
            <div className="h-72 bg-muted rounded-lg animate-pulse" />
          </div>
        </main>
      </div>
    );
  }

  // ── Section: Overview ─────────────────────────────────────────────────────
  const OverviewSection = () => (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Artisan Panel</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Overview</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'},{' '}
            {user?.name?.split(' ')[0] || 'Artisan'} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Last synced {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            {' · '}Period: {period === '7days' ? '7 Days' : period === '30days' ? '30 Days' : period === '90days' ? '90 Days' : '1 Year'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex border rounded-lg overflow-hidden text-xs">
            {(['7days', '30days', '90days', '1year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  period === p ? 'bg-orange-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {p === '7days' ? '7D' : p === '30days' ? '30D' : p === '90days' ? '90D' : '1Y'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => loadDashboard()} disabled={refreshing} className="h-8">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/artisan/products">
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 h-8">
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Pending orders alert */}
      {pendingOrders.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {pendingOrders.length} order{pendingOrders.length > 1 ? 's' : ''} awaiting your action
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Accept or reject before they expire — unactioned orders may auto-cancel.
            </p>
          </div>
          <Button
            size="sm" variant="outline"
            className="border-amber-400 text-amber-800 hover:bg-amber-100 h-7 shrink-0"
            onClick={() => setActiveSection('orders')}
          >
            Review <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}

      {/* Stats row */}
      <DashboardStatsRow
        orderCounts={bundle?.orderCounts ?? null}
        revenue={bundle?.revenue ?? null}
        performance={bundle?.performance ?? null}
        loading={refreshing}
      />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts (left 2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="Period Revenue"
              value={fmt(bundle?.revenue?.current ?? 0)}
              sub={bundle?.revenue?.growthPct != null
                ? `${bundle.revenue.growthPct > 0 ? '+' : ''}${bundle.revenue.growthPct.toFixed(1)}% vs prev`
                : undefined}
              color={(bundle?.revenue?.growthPct ?? 0) > 0 ? 'text-green-600' : (bundle?.revenue?.growthPct ?? 0) < 0 ? 'text-red-600' : 'text-foreground'}
            />
            <KpiCard label="Avg Order Value" value={fmt(bundle?.revenue?.avgOrderValue ?? 0)} sub="per order" />
            <KpiCard
              label="Total Orders"
              value={String(bundle?.orderCounts?.total ?? 0)}
              sub={`${bundle?.orderCounts?.delivered ?? 0} delivered`}
            />
            <KpiCard
              label="Fulfillment Rate"
              value={`${(bundle?.performance?.fulfillmentRate ?? 0).toFixed(1)}%`}
              sub={`★ ${(bundle?.performance?.avgRating ?? 0).toFixed(1)} avg`}
            />
          </div>
          {/* Revenue trend chart */}
          <ArtisanAnalyticsCharts
            trend={bundle?.trend ?? []}
            revenue={bundle?.revenue ?? null}
            performance={bundle?.performance ?? null}
            orderCounts={bundle?.orderCounts ?? null}
            period={period}
            onPeriodChange={handlePeriodChange}
            loading={refreshing}
          />
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <ArtisanNotificationsCenter
            pendingOrders={pendingOrders}
            lowStockProducts={lowStock}
            onViewOrders={() => setActiveSection('orders')}
            onViewProducts={() => setActiveSection('products')}
          />
          <QuickActionsPanel />
        </div>
      </div>

      {/* Recent orders preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                Recent Orders
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Latest {Math.min(recentOrders.length, 5)} orders · Accept or reject placed orders
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setActiveSection('orders')}>
              View All <ExternalLink className="w-3 h-3 ml-1.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {recentOrders.length === 0 ? (
            <div className="text-center py-10">
              <ShoppingCart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            recentOrders.slice(0, 5).map((order) => {
              const canAct = order.status === 'placed';
              return (
                <div
                  key={order._id}
                  className={`flex flex-wrap items-start gap-3 p-3 rounded-lg border transition-colors ${
                    canAct ? 'border-amber-200 bg-amber-50/40' : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${canAct ? 'bg-amber-100' : 'bg-muted/60'}`}>
                    {canAct ? <Clock className="w-4 h-4 text-amber-600" />
                      : order.status === 'delivered' ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : order.status === 'rejected' || order.status === 'cancelled' ? <Ban className="w-4 h-4 text-red-500" />
                      : <Package className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="font-semibold text-sm">#{order.orderNumber}</span>
                      <Badge className={`text-[10px] px-1.5 ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                      {canAct && <Badge className="text-[10px] px-1.5 bg-amber-500 text-white">Needs Action</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {order.items?.map((i: any) => `${i.name || i.productId?.name || 'Item'} ×${i.quantity}`).join(', ')}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {order.shippingAddress?.fullName} · {fmtDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-semibold text-sm">{fmt(order.total)}</span>
                    {canAct ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-6 px-2.5 text-[11px] bg-green-600 hover:bg-green-700" onClick={() => setAcceptOrder(order)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" />Accept
                        </Button>
                        <Button size="sm" variant="destructive" className="h-6 px-2.5 text-[11px]" onClick={() => setRejectOrder(order)}>
                          <Ban className="w-3 h-3 mr-1" />Reject
                        </Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setActiveSection('orders')}>
                        <Eye className="w-3 h-3 mr-1" />View
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── Section: Orders (Module 9: full management interface) ──────────────────
  // NOTE: Do NOT wrap in a local const component — that creates a new type each render
  // which causes React to unmount/remount OrdersManagementPage on every parent re-render,
  // triggering isLoading=true (skeleton) every 30 s when ArtisanDashboard background-polls.

  // ── Section: Products ─────────────────────────────────────────────────────
  const ProductsSection = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Artisan Panel <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Products</span>
          </div>
          <h2 className="text-2xl font-bold">Products</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.length} listing{products.length !== 1 ? 's' : ''} · {lowStock.length} low stock
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/artisan/products"><Button variant="outline" size="sm">Manage <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></Button></Link>
          <Link to="/artisan/products"><Button size="sm" className="bg-orange-600 hover:bg-orange-700"><Plus className="w-3.5 h-3.5 mr-1.5" />Add</Button></Link>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{lowStock.length} product{lowStock.length > 1 ? 's' : ''} need restocking</p>
            <p className="text-xs text-red-700 mt-0.5">Low or out-of-stock items won't appear in search results.</p>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No products yet</p>
            <Link to="/artisan/products">
              <Button className="bg-orange-600 hover:bg-orange-700"><Plus className="w-4 h-4 mr-2" />Add Your First Product</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product) => {
            const isLow = lowStock.some((l) => l._id === product.id);
            return (
              <Link key={product.id} to="/artisan/products">
                <Card className={`overflow-hidden hover:shadow-md transition-all cursor-pointer group ${isLow ? 'ring-1 ring-amber-400' : ''}`}>
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Badge variant="secondary" className="text-xs">Out of Stock</Badge>
                      </div>
                    )}
                    {isLow && product.inStock && (
                      <Badge className="absolute top-2 left-2 text-[10px] bg-amber-500 text-white px-1.5">Low Stock</Badge>
                    )}
                  </div>
                  <CardContent className="p-2.5">
                    <p className="text-xs font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(product.price)}</p>
                    {product.inStock && (
                      <p className={`text-[10px] mt-0.5 ${isLow ? 'text-amber-600 font-medium' : 'text-green-600'}`}>
                        {product.stockCount} in stock
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Section: Analytics ────────────────────────────────────────────────────
  const AnalyticsSection = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Artisan Panel <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Analytics</span>
          </div>
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Sales performance and order trends</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden text-xs">
            {(['7days', '30days', '90days', '1year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  period === p ? 'bg-orange-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {p === '7days' ? '7D' : p === '30days' ? '30D' : p === '90days' ? '90D' : '1Y'}
              </button>
            ))}
          </div>
          <Link to="/artisan/analytics">
            <Button size="sm" variant="outline">Full Page <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Period Revenue"
          value={fmt(bundle?.revenue?.current ?? 0)}
          sub={bundle?.revenue?.growthPct != null
            ? `${bundle.revenue.growthPct > 0 ? '+' : ''}${bundle.revenue.growthPct.toFixed(1)}% vs prev`
            : undefined}
          color={(bundle?.revenue?.growthPct ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <KpiCard label="All-Time Revenue" value={fmt(bundle?.revenue?.allTime ?? 0)} sub="total earned" />
        <KpiCard
          label="Fulfillment Rate"
          value={`${(bundle?.performance?.fulfillmentRate ?? 0).toFixed(1)}%`}
          sub={`${bundle?.orderCounts?.delivered ?? 0} delivered`}
        />
        <KpiCard
          label="Avg Rating"
          value={`★ ${(bundle?.performance?.avgRating ?? 0).toFixed(1)}`}
          sub={`${bundle?.performance?.totalReviews ?? 0} reviews`}
          color="text-amber-600"
        />
      </div>

      <ArtisanAnalyticsCharts
        trend={bundle?.trend ?? []}
        revenue={bundle?.revenue ?? null}
        performance={bundle?.performance ?? null}
        orderCounts={bundle?.orderCounts ?? null}
        period={period}
        onPeriodChange={handlePeriodChange}
        loading={refreshing}
      />
    </div>
  );

  // ── Section: External page stub ───────────────────────────────────────────
  const ExternalSection = ({
    section,
    href,
    icon: Icon,
    description,
  }: {
    section: ArtisanSection;
    href: string;
    icon: React.ElementType;
    description: string;
  }) => (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <LayoutDashboard className="w-3.5 h-3.5" />
          Artisan Panel <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium">{SECTION_LABELS[section]}</span>
        </div>
        <h2 className="text-2xl font-bold">{SECTION_LABELS[section]}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Card className="max-w-md">
        <CardContent className="py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <Icon className="w-7 h-7 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{SECTION_LABELS[section]}</h3>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{description}</p>
          <Link to={href}>
            <Button className="bg-orange-600 hover:bg-orange-700 gap-2">
              Open {SECTION_LABELS[section]} <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Module 14: skip-navigation link for keyboard users */}
      <a href="#artisan-main-content" className="skip-link">Skip to main content</a>
      <div className="min-h-screen bg-background flex">

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <ArtisanSidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        pendingOrders={pendingOrders.length}
        lowStockCount={lowStock.length}
        totalProducts={products.length}
        totalReviews={bundle?.performance?.totalReviews ?? 0}
      />

      {/* ── Main pane ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-auto">

        {/* Top bar */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">{SECTION_LABELS[activeSection]}</h2>
            {/* New-order alert badge */}
            {alertActive && (
              <button
                onClick={() => { clearAlert(); setActiveSection('orders'); }}
                className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-100 border border-orange-300 rounded-full px-2.5 py-0.5 hover:bg-orange-200 transition-colors animate-pulse"
              >
                <Zap className="w-3 h-3" />
                {newOrderIds.length} new!
              </button>
            )}
            {!alertActive && pendingOrders.length > 0 && activeSection !== 'orders' && (
              <button
                onClick={() => setActiveSection('orders')}
                className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2.5 py-0.5 hover:bg-amber-200 transition-colors"
              >
                <Bell className="w-3 h-3" />
                {pendingOrders.length} pending
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Module 11: Verification status pill */}
            {approvalStatus && (
              <span
                title={
                  approvalStatus === 'approved'
                    ? 'Your account is verified'
                    : approvalStatus === 'pending'
                    ? 'Your verification is under review'
                    : 'Verification failed — contact support'
                }
                className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 font-medium border select-none ${
                  approvalStatus === 'approved'
                    ? 'text-green-700 bg-green-50 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700'
                    : approvalStatus === 'pending'
                    ? 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700'
                    : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                }`}
              >
                <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                {approvalStatus === 'approved'
                  ? 'Verified'
                  : approvalStatus === 'pending'
                  ? 'Pending'
                  : 'Review Failed'}
              </span>
            )}
            {/* Sound toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              title={soundEnabled ? 'Mute order alerts' : 'Enable order alerts'}
              aria-label={soundEnabled ? 'Mute order alerts' : 'Enable order alerts'}
              aria-pressed={soundEnabled}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {soundEnabled
                ? <Volume2 className="w-3.5 h-3.5" />
                : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            {refreshing && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="w-3 h-3 animate-spin" />Syncing…
              </span>
            )}
            <Link to="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Home className="w-3.5 h-3.5" />Back to Site
            </Link>
          </div>
        </header>

        {/* Section content */}
        <main
          id="artisan-main-content"
          className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6"
          tabIndex={-1}
          aria-label={SECTION_LABELS[activeSection]}
        >
          {activeSection === 'overview'  && <OverviewSection />}
          {activeSection === 'orders'    && <OrdersManagementPage />}
          {activeSection === 'products'  && <ProductsSection />}
          {activeSection === 'analytics' && <AnalyticsSection />}
          {activeSection === 'customers' && (
            <ExternalSection
              section="customers" href="/artisan/customers" icon={Users}
              description="View your customer base, purchase history, and buyer engagement metrics."
            />
          )}
          {activeSection === 'reviews' && (
            <ExternalSection
              section="reviews" href="/artisan/reviews" icon={Star}
              description="Read customer reviews, respond to feedback, and monitor your average rating."
            />
          )}
          {activeSection === 'messages' && (
            <ExternalSection
              section="messages" href="/artisan/messages" icon={MessageSquare}
              description="Respond to customer inquiries, discuss custom orders, and manage conversations."
            />
          )}
        </main>

        {/* Footer strip — hidden on mobile (replaced by bottom nav) */}
        <footer className="hidden lg:flex border-t border-border px-6 py-3 items-center justify-between text-[11px] text-muted-foreground">
          <span>Zaymazone Artisan Panel · Module 14</span>
          <span>
            Auto-refreshes every 30s · Last synced{' '}
            {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </footer>

        {/* Module 14: Mobile bottom navigation */}
        <ArtisanMobileBottomNav
          activeSection={activeSection}
          onNavigate={(s) => setActiveSection(s)}
          onMenuOpen={() => setSidebarOpen(true)}
          pendingOrders={pendingOrders.length}
          lowStockCount={lowStock.length}
        />
        </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <AcceptOrderModal
        open={acceptOrder !== null}
        order={acceptOrder}
        onClose={() => setAcceptOrder(null)}
        onAccepted={handleOrderActioned}
      />
      <RejectionReasonModal
        open={rejectOrder !== null}
        order={rejectOrder}
        onClose={() => setRejectOrder(null)}
        onRejected={handleOrderActioned}
      />
      </div>
    </>
  );
};

export default ArtisanDashboard;