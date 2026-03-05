// ── Module 9: Full Order Management Interface ─────────────────────────────────
import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button }            from '@/components/ui/button';
import { Badge }             from '@/components/ui/badge';
import { Input }             from '@/components/ui/input';
import { ScrollArea }        from '@/components/ui/scroll-area';
import {
  Package,
  ShoppingCart,
  RefreshCw,
  Search,
  CheckCircle2,
  Ban,
  Clock,
  Eye,
  RotateCcw,
  Banknote,
  LayoutDashboard,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Truck,
  Filter,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { Order } from '@/lib/api';
import { useOrderAlerts } from '@/hooks/useOrderAlerts';
import { BulkOrderActions }  from '@/components/artisan/BulkOrderActions';
import { AcceptOrderModal }   from '@/components/artisan/AcceptOrderModal';
import { RejectionReasonModal } from '@/components/artisan/RejectionReasonModal';
import { ReturnRefundModal }  from '@/components/artisan/ReturnRefundModal';
import { OrderDetailDrawer }  from '@/components/artisan/OrderDetailDrawer';

// ── Helpers ────────────────────────────────────────────────────────────────
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
  confirmed:        'bg-blue-100   text-blue-800   border-blue-200',
  processing:       'bg-purple-100 text-purple-800 border-purple-200',
  packed:           'bg-indigo-100 text-indigo-800 border-indigo-200',
  shipped:          'bg-orange-100 text-orange-800 border-orange-200',
  out_for_delivery: 'bg-cyan-100   text-cyan-800   border-cyan-200',
  delivered:        'bg-green-100  text-green-800  border-green-200',
  cancelled:        'bg-red-100    text-red-800    border-red-200',
  rejected:         'bg-red-100    text-red-900    border-red-300',
  returned:         'bg-gray-100   text-gray-700   border-gray-200',
  refunded:         'bg-pink-100   text-pink-800   border-pink-200',
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

const STATUS_ICON: Record<string, React.ElementType> = {
  placed:           Clock,
  confirmed:        CheckCircle2,
  processing:       Package,
  packed:           Package,
  shipped:          Truck,
  out_for_delivery: Truck,
  delivered:        CheckCircle2,
  cancelled:        Ban,
  rejected:         Ban,
  returned:         RotateCcw,
  refunded:         Banknote,
};

const FILTER_GROUPS = [
  { id: 'all',       label: 'All' },
  { id: 'placed',    label: 'Pending',   statusKey: 'placed'    },
  { id: 'active',    label: 'Active'                            },  // confirmed+processing+packed+shipped
  { id: 'delivered', label: 'Delivered', statusKey: 'delivered' },
  { id: 'returns',   label: 'Returns'                           },  // returned+refunded
  { id: 'closed',    label: 'Closed'                            },  // cancelled+rejected
] as const;

type FilterId = typeof FILTER_GROUPS[number]['id'];

const ITEMS_PER_PAGE = 15;

// ── Props ──────────────────────────────────────────────────────────────────
interface OrdersManagementPageProps {
  /** Optional: navigate to another dashboard section (for breadcrumbs/CTA). */
  onNavigateTo?: (section: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export function OrdersManagementPage({ onNavigateTo }: OrdersManagementPageProps) {
  const { toast } = useToast();

  // ── Data state ─────────────────────────────────────────────────────────
  const [orders,        setOrders]       = useState<Order[]>([]);
  const [isLoading,     setIsLoading]    = useState(true);
  const [isRefreshing,  setIsRefreshing] = useState(false);

  // ── UI state ───────────────────────────────────────────────────────────
  const [filter,        setFilter]       = useState<FilterId>('all');
  const [search,        setSearch]       = useState('');
  const [page,          setPage]         = useState(1);
  const [soundEnabled,  setSoundEnabled] = useState(true);

  // ── Selection state ───────────────────────────────────────────────────
  const [selectedIds,   setSelectedIds]  = useState<Set<string>>(new Set());

  // ── Modal state ────────────────────────────────────────────────────────
  const [acceptOrder,       setAcceptOrder]       = useState<Order | null>(null);
  const [rejectOrder,       setRejectOrder]       = useState<Order | null>(null);
  const [returnRefundOrder, setReturnRefundOrder] = useState<Order | null>(null);
  const [detailOrder,       setDetailOrder]       = useState<Order | null>(null);

  // ── Alerts ─────────────────────────────────────────────────────────────
  const { alertActive, newOrderIds, clearAlert } = useOrderAlerts(orders, soundEnabled);

  // ── Load orders ────────────────────────────────────────────────────────
  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else         setIsRefreshing(true);
    try {
      const data = await api.artisanDashboard.getOrders({ limit: 200 });
      setOrders(data.orders ?? []);
    } catch (err) {
      if (!silent) {
        toast({
          title: 'Failed to load orders',
          description: err instanceof Error ? err.message : 'Please refresh.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOrders();
    const timer = setInterval(() => loadOrders(true), 30_000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  // ── Filtered + searched orders ─────────────────────────────────────────
  const filtered = orders.filter((o) => {
    const matchesFilter =
      filter === 'all'       ? true :
      filter === 'placed'    ? o.status === 'placed' :
      filter === 'active'    ? ['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery'].includes(o.status) :
      filter === 'delivered' ? o.status === 'delivered' :
      filter === 'returns'   ? ['returned', 'refunded'].includes(o.status) :
      filter === 'closed'    ? ['cancelled', 'rejected'].includes(o.status) :
      true;

    if (!matchesFilter) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.orderNumber?.toLowerCase().includes(q) ||
      o.shippingAddress?.fullName?.toLowerCase().includes(q) ||
      o.items?.some((i) => i.name?.toLowerCase().includes(q))
    );
  });

  const totalPages     = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const pagedOrders    = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const pendingOrders  = orders.filter((o) => o.status === 'placed');

  // ── Counts for filter badges ───────────────────────────────────────────
  const countOf = (f: FilterId) =>
    f === 'all'       ? orders.length :
    f === 'placed'    ? orders.filter((o) => o.status === 'placed').length :
    f === 'active'    ? orders.filter((o) => ['confirmed','processing','packed','shipped','out_for_delivery'].includes(o.status)).length :
    f === 'delivered' ? orders.filter((o) => o.status === 'delivered').length :
    f === 'returns'   ? orders.filter((o) => ['returned','refunded'].includes(o.status)).length :
    f === 'closed'    ? orders.filter((o) => ['cancelled','rejected'].includes(o.status)).length :
    0;

  // ── Selection helpers ──────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelectAll = () => {
    if (selectedIds.size === pagedOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedOrders.map((o) => o._id)));
    }
  };

  const selectedOrders = pagedOrders.filter((o) => selectedIds.has(o._id));

  const handleActioned = () => {
    setSelectedIds(new Set());
    loadOrders(true);
  };

  // Reset page when filter/search changes
  const applyFilter = (f: FilterId) => {
    setFilter(f);
    setPage(1);
    setSelectedIds(new Set());
  };

  const applySearch = (q: string) => {
    setSearch(q);
    setPage(1);
    setSelectedIds(new Set());
  };

  // ── Skeleton ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-muted rounded-lg animate-pulse" />
        <div className="h-10 bg-muted rounded-xl animate-pulse" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Artisan Panel
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Orders</span>
          </div>
          <h2 className="text-2xl font-bold">Order Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {orders.length} total · {pendingOrders.length} awaiting action
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Mute new-order alerts' : 'Enable new-order alerts'}
            className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Sound on' : 'Sound off'}</span>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadOrders(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Link to="/artisan/orders">
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
              Full View <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Alert banner (new orders) ─────────────────────────────────────── */}
      {alertActive && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-orange-300 bg-orange-50 shadow-sm">
          <Zap className="w-5 h-5 text-orange-600 shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-900">
              {newOrderIds.length} new order{newOrderIds.length !== 1 ? 's' : ''} just arrived!
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              Review and accept or reject before they expire.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="border-orange-400 text-orange-700 hover:bg-orange-100 h-7 text-xs"
              onClick={() => { clearAlert(); applyFilter('placed'); }}
            >
              View Pending
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-orange-600"
              onClick={clearAlert}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* ── Pending action alert ──────────────────────────────────────────── */}
      {!alertActive && pendingOrders.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''} awaiting your action
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Unactioned placed orders may auto-cancel after 24 hours.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 text-amber-800 hover:bg-amber-100 h-7 text-xs shrink-0"
            onClick={() => applyFilter('placed')}
          >
            Review <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}

      {/* ── Filter tabs + search ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter chips */}
        <div className="flex items-center gap-1 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {FILTER_GROUPS.map((f) => {
            const count = countOf(f.id);
            return (
              <button
                key={f.id}
                onClick={() => applyFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  filter === f.id
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-card text-muted-foreground border-border hover:border-orange-300 hover:text-foreground'
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0 rounded-full font-bold ${
                    filter === f.id ? 'bg-white/20' : 'bg-muted'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => applySearch(e.target.value)}
            placeholder="Search orders, customers…"
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* ── Bulk actions bar ──────────────────────────────────────────────── */}
      <BulkOrderActions
        selectedOrders={selectedOrders}
        onClear={() => setSelectedIds(new Set())}
        onActioned={handleActioned}
      />

      {/* ── Order list ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-1">No orders found</p>
            <p className="text-xs text-muted-foreground">
              {search ? 'Try a different search term.' : 'Change filter to see other orders.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Header row (select-all + column labels) */}
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground border-b">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 rounded shrink-0"
              checked={pagedOrders.length > 0 && selectedIds.size === pagedOrders.length}
              onChange={toggleSelectAll}
              title="Select all on this page"
            />
            <span className="flex-1">Order</span>
            <span className="hidden sm:block w-32 text-center">Status</span>
            <span className="hidden md:block w-24 text-right">Total</span>
            <span className="w-36 text-right">Actions</span>
          </div>

          <div className="space-y-1.5">
            {pagedOrders.map((order) => {
              const canAct    = order.status === 'placed';
              const canReturn = order.status === 'delivered';
              const isNew     = newOrderIds.includes(order._id);
              const selected  = selectedIds.has(order._id);
              const StatusIcon = STATUS_ICON[order.status] ?? Package;

              return (
                <Card
                  key={order._id}
                  className={`transition-all ${
                    isNew     ? 'border-orange-400 shadow-orange-100 shadow-sm' :
                    canAct    ? 'border-amber-300 bg-amber-50/30' :
                    selected  ? 'border-blue-300 bg-blue-50/20' :
                    'border-border hover:border-border/70'
                  }`}
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(order._id)}
                        className="w-3.5 h-3.5 rounded shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select order"
                        title="Select order"
                      />

                      {/* Status icon */}
                      <div className={`p-2 rounded-lg shrink-0 ${
                        isNew     ? 'bg-orange-100' :
                        canAct    ? 'bg-amber-100' :
                        order.status === 'delivered' ? 'bg-green-100' :
                        order.status === 'rejected' || order.status === 'cancelled' ? 'bg-red-100' :
                        'bg-muted/50'
                      }`}>
                        <StatusIcon className={`w-4 h-4 ${
                          isNew     ? 'text-orange-600' :
                          canAct    ? 'text-amber-600' :
                          order.status === 'delivered' ? 'text-green-600' :
                          order.status === 'rejected' || order.status === 'cancelled' ? 'text-red-500' :
                          'text-muted-foreground'
                        }`} />
                      </div>

                      {/* Order info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className="font-semibold text-sm">#{order.orderNumber}</span>
                          {isNew && (
                            <Badge className="text-[10px] px-1.5 bg-orange-500 text-white animate-pulse">
                              New!
                            </Badge>
                          )}
                          {canAct && !isNew && (
                            <Badge className="text-[10px] px-1.5 bg-amber-500 text-white">
                              Needs Action
                            </Badge>
                          )}
                          {/* Status badge (visible on mobile) */}
                          <Badge className={`sm:hidden text-[10px] px-1.5 ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                            {STATUS_LABEL[order.status] ?? order.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {order.shippingAddress?.fullName}
                          {' · '}
                          {order.items?.slice(0, 2).map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                          {(order.items?.length ?? 0) > 2 &&
                            ` +${(order.items?.length ?? 0) - 2} more`}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {fmtDate(order.createdAt)}
                          {order.paymentMethod && (
                            <> · <span className="uppercase text-[10px]">{order.paymentMethod}</span></>
                          )}
                        </p>
                      </div>

                      {/* Status badge (desktop) */}
                      <div className="hidden sm:flex w-32 justify-center">
                        <Badge className={`text-[10px] px-1.5 ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </Badge>
                      </div>

                      {/* Total (desktop) */}
                      <span className="hidden md:block w-24 text-right text-sm font-semibold">
                        {fmt(order.total)}
                      </span>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 w-36 justify-end">
                        {/* View details (always) */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px]"
                          onClick={() => setDetailOrder(order)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Details
                        </Button>

                        {/* Accept/Reject for placed orders */}
                        {canAct && (
                          <>
                            <Button
                              size="sm"
                              className="h-7 w-7 p-0 bg-green-600 hover:bg-green-700"
                              title="Accept this order"
                              onClick={() => setAcceptOrder(order)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 w-7 p-0"
                              title="Reject this order"
                              onClick={() => setRejectOrder(order)}
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}

                        {/* Return/refund for delivered orders */}
                        {canReturn && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0 border-orange-300 text-orange-600 hover:bg-orange-50"
                            title="Process return or refund"
                            onClick={() => setReturnRefundOrder(order)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Pagination ────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>
                {Math.min((page - 1) * ITEMS_PER_PAGE + 1, filtered.length)}–
                {Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm" variant="outline" className="h-7 w-7 p-0"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <Button
                      key={pageNum}
                      size="sm"
                      variant={page === pageNum ? 'default' : 'outline'}
                      className={`h-7 w-7 p-0 text-xs ${page === pageNum ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  size="sm" variant="outline" className="h-7 w-7 p-0"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AcceptOrderModal
        open={acceptOrder !== null}
        order={acceptOrder}
        onClose={() => setAcceptOrder(null)}
        onAccepted={handleActioned}
      />

      <RejectionReasonModal
        open={rejectOrder !== null}
        order={rejectOrder}
        onClose={() => setRejectOrder(null)}
        onRejected={handleActioned}
      />

      <ReturnRefundModal
        open={returnRefundOrder !== null}
        order={returnRefundOrder}
        onClose={() => setReturnRefundOrder(null)}
        onCompleted={handleActioned}
      />

      <OrderDetailDrawer
        open={detailOrder !== null}
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        onAccept={(o)        => { setDetailOrder(null); setAcceptOrder(o);       }}
        onReject={(o)        => { setDetailOrder(null); setRejectOrder(o);       }}
        onReturnRefund={(o)  => { setDetailOrder(null); setReturnRefundOrder(o); }}
        onRefreshed={handleActioned}
      />
    </div>
  );
}
