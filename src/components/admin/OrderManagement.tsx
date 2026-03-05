import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search,
  Eye,
  RefreshCw,
  Filter,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Banknote,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Edit,
  AlertTriangle,
  Hash,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const _apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/api$/, '');
const API_BASE_URL = `${_apiOrigin}/api`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  image?: string;
  artisanId?: { name: string; location?: string } | null;
}

interface ShippingAddress {
  fullName: string;
  phone: string;
  city: string;
  state: string;
  zipCode: string;
  addressLine1: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  userId?: { name: string; email: string; phone?: string; role?: string } | null;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  codFee?: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  shippingAddress: ShippingAddress;
  createdAt: string;
  estimatedDelivery?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "delivered": return "bg-green-100 text-green-800 border-green-200";
    case "shipped":
    case "out_for_delivery": return "bg-blue-100 text-blue-800 border-blue-200";
    case "processing":
    case "packed":
    case "confirmed": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "placed": return "bg-purple-100 text-purple-800 border-purple-200";
    case "cancelled":
    case "returned":
    case "refunded": return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "delivered": return <CheckCircle className="w-3 h-3" />;
    case "shipped":
    case "out_for_delivery": return <Truck className="w-3 h-3" />;
    case "processing":
    case "packed":
    case "confirmed": return <Package className="w-3 h-3" />;
    case "placed": return <Clock className="w-3 h-3" />;
    case "cancelled": return <XCircle className="w-3 h-3" />;
    default: return null;
  }
};

const getPaymentIcon = (method: string) => {
  if (method === "cod") return <Banknote className="w-3 h-3" />;
  return <CreditCard className="w-3 h-3" />;
};

const getPaymentLabel = (method: string) => {
  const labels: Record<string, string> = {
    cod: "Cash on Delivery",
    upi: "UPI",
    upi_prepaid: "UPI Prepaid",
    razorpay: "Razorpay",
    paytm: "Paytm",
    paytm_upi: "Paytm UPI",
    paytm_card: "Paytm Card",
    paytm_netbanking: "Paytm Net Banking",
    paytm_wallet: "Paytm Wallet",
    zoho_card: "Card",
    zoho_upi: "UPI",
    zoho_netbanking: "Net Banking",
    zoho_wallet: "Wallet",
  };
  return labels[method] || method.toUpperCase();
};

const formatCurrency = (amount: number) =>
  `₹${(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ─── Component ────────────────────────────────────────────────────────────────

export function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusUpdateOpen, setStatusUpdateOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [inlineUpdating, setInlineUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const getAuthHeaders = () => {
    const token = localStorage.getItem("admin_token");
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  };

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const response = await fetch(`${API_BASE_URL}/admin/orders?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      let fetchedOrders: Order[] = data.orders || [];

      // Client-side filter by payment method (backend doesn't support it yet)
      if (paymentFilter !== "all") {
        fetchedOrders = fetchedOrders.filter(
          (o) => o.paymentMethod === paymentFilter
        );
      }

      setOrders(fetchedOrders);
      setTotalPages(data.pagination?.pages || 1);
      setTotalOrders(data.pagination?.total || fetchedOrders.length);
    } catch (error: any) {
      toast({
        title: "Failed to load orders",
        description: error.message,
        variant: "destructive",
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, paymentFilter, searchTerm]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadOrders();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const callStatusUpdate = async (orderId: string, status: string, note?: string, tracking?: string) => {
    const response = await fetch(`${API_BASE_URL}/admin/orders/${orderId}/status`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, ...(note && { note }), ...(tracking && { trackingNumber: tracking }) }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to update status");
    }
    return response.json();
  };

  // Full dialog update (with optional note + tracking)
  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;
    try {
      setUpdatingStatus(true);
      await callStatusUpdate(selectedOrder._id, newStatus, statusNote, trackingNumber);
      toast({ title: "Order status updated", description: `Order ${selectedOrder.orderNumber} → ${newStatus.replace(/_/g, " ")}` });
      setStatusUpdateOpen(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Inline quick-update from the row dropdown
  const handleInlineStatusChange = async (order: Order, status: string) => {
    if (status === order.status) return;
    try {
      setInlineUpdating(order._id);
      await callStatusUpdate(order._id, status);
      toast({ title: "Status updated", description: `${order.orderNumber} → ${status.replace(/_/g, " ")}` });
      loadOrders();
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setInlineUpdating(null);
    }
  };

  const openStatusUpdate = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusNote("");
    setTrackingNumber("");
    setStatusUpdateOpen(true);
  };

  const openDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailOpen(true);
  };

  const isCod = (order: Order) => order.paymentMethod === "cod";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Order Management</CardTitle>
            <CardDescription>
              {totalOrders} total orders · Track and manage all customer orders
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadOrders} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>

        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number or customer…"
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <Banknote className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="cod">COD Only</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="upi_prepaid">UPI Prepaid</SelectItem>
                <SelectItem value="razorpay">Razorpay</SelectItem>
                <SelectItem value="paytm">Paytm</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Orders List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Loading orders…</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="w-14 h-14 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No Orders Found</h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "all" || paymentFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Orders will appear here once customers place them"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className={`border rounded-xl p-4 transition-colors hover:bg-muted/30 ${isCod(order) ? "border-l-4 border-l-orange-400" : ""
                    }`}
                >
                  {/* Header row */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="font-semibold text-sm font-mono">{order.orderNumber}</span>

                    {/* Order Status */}
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 text-xs capitalize ${getStatusColor(order.status)}`}
                    >
                      {getStatusIcon(order.status)}
                      {order.status.replace(/_/g, " ")}
                    </Badge>

                    {/* Payment Method */}
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 text-xs ${isCod(order)
                          ? "bg-orange-50 text-orange-700 border-orange-300 font-semibold"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                    >
                      {getPaymentIcon(order.paymentMethod)}
                      {getPaymentLabel(order.paymentMethod)}
                    </Badge>

                    {/* Payment Status */}
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${order.paymentStatus === "paid"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : order.paymentStatus === "failed"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                    >
                      {order.paymentStatus}
                    </Badge>

                    {/* COD Risk flag */}
                    {isCod(order) && order.status === "placed" && (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Awaiting COD
                      </Badge>
                    )}
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Customer</p>
                      {order.userId?.role === 'admin' ? (
                        // Order placed by admin account — show shipping recipient as the customer
                        <>
                          <p className="font-medium">{order.shippingAddress?.fullName || '—'}</p>
                          {order.shippingAddress?.phone && (
                            <p className="text-muted-foreground text-xs">{order.shippingAddress.phone}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-medium">{order.userId?.name || order.shippingAddress?.fullName || '—'}</p>
                          <p className="text-muted-foreground text-xs">{order.userId?.email || '—'}</p>
                          {order.shippingAddress?.fullName && order.shippingAddress.fullName !== order.userId?.name && (
                            <p className="text-muted-foreground text-xs mt-0.5">Ships to: {order.shippingAddress.fullName}</p>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Items</p>
                      <p className="font-medium">{order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}</p>
                      <p className="text-muted-foreground text-xs">{order.shippingAddress?.city}, {order.shippingAddress?.state}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Order Date</p>
                      <p className="font-medium">{formatDate(order.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Total</p>
                      <p className="font-bold text-base">{formatCurrency(order.total)}</p>
                      {isCod(order) && order.codFee ? (
                        <p className="text-xs text-orange-600">incl. ₹{order.codFee} COD fee</p>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button variant="outline" size="sm" onClick={() => openDetail(order)}>
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      View
                    </Button>

                    {/* Inline status dropdown */}
                    <div className="flex items-center gap-1.5">
                      {inlineUpdating === order._id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : null}
                      <Select
                        value={order.status}
                        onValueChange={(v) => handleInlineStatusChange(order, v)}
                        disabled={inlineUpdating === order._id}
                      >
                        <SelectTrigger className="h-8 text-xs w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">
                              {s.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => openStatusUpdate(order)}>
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Add Note
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Order Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order {selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>Full order details</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 text-sm">
              {/* Status row */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={`capitalize ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status.replace(/_/g, " ")}
                </Badge>
                <Badge
                  variant="outline"
                  className={isCod(selectedOrder) ? "bg-orange-50 text-orange-700 border-orange-300" : "bg-blue-50 text-blue-700"}
                >
                  {getPaymentLabel(selectedOrder.paymentMethod)}
                </Badge>
                <Badge variant="outline" className="capitalize">{selectedOrder.paymentStatus}</Badge>
              </div>

              {/* Customer */}
              <div className="rounded-lg border p-3 space-y-0.5">
                <p className="font-semibold mb-2">Customer</p>
                {selectedOrder.userId?.role === 'admin' ? (
                  // Placed via admin account — show shipping recipient as the customer
                  <>
                    <p className="font-medium">{selectedOrder.shippingAddress?.fullName || '—'}</p>
                    {selectedOrder.shippingAddress?.phone && (
                      <p className="text-muted-foreground text-xs">📞 {selectedOrder.shippingAddress.phone}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">(placed via admin account)</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">{selectedOrder.userId?.name || selectedOrder.shippingAddress?.fullName || '—'}</p>
                    <p className="text-muted-foreground text-xs">{selectedOrder.userId?.email || '—'}</p>
                    {selectedOrder.userId?.phone && (
                      <p className="text-muted-foreground text-xs">📞 {selectedOrder.userId.phone}</p>
                    )}
                    {selectedOrder.shippingAddress?.fullName &&
                      selectedOrder.shippingAddress.fullName !== selectedOrder.userId?.name && (
                      <p className="text-xs mt-1 pt-1 border-t">
                        <span className="text-muted-foreground">Ships to: </span>
                        {selectedOrder.shippingAddress.fullName}
                        {selectedOrder.shippingAddress.phone ? ` · 📞 ${selectedOrder.shippingAddress.phone}` : ''}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Shipping address */}
              <div className="rounded-lg border p-3">
                <p className="font-semibold mb-1">Shipping Address</p>
                <p>{selectedOrder.shippingAddress?.fullName}</p>
                <p>{selectedOrder.shippingAddress?.addressLine1}</p>
                <p>{selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} – {selectedOrder.shippingAddress?.zipCode}</p>
                <p>📞 {selectedOrder.shippingAddress?.phone}</p>
              </div>

              {/* Items */}
              <div className="rounded-lg border p-3">
                <p className="font-semibold mb-2">Items ({selectedOrder.items?.length})</p>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-2">
                      <div>
                        <span>{item.name} × {item.quantity}</span>
                        {item.artisanId?.name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            🧑‍🎨 Artisan: <span className="font-medium text-foreground">{item.artisanId.name}</span>
                          </p>
                        )}
                      </div>
                      <span className="font-medium shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price breakdown */}
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-semibold mb-2">Price Breakdown</p>
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(selectedOrder.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{formatCurrency(selectedOrder.shippingCost)}</span></div>
                {selectedOrder.codFee ? (
                  <div className="flex justify-between text-orange-600"><span>COD Fee</span><span>{formatCurrency(selectedOrder.codFee)}</span></div>
                ) : null}
                <div className="flex justify-between font-bold border-t pt-1 mt-1">
                  <span>Total</span><span>{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>

              <p className="text-muted-foreground text-xs">Placed: {formatDate(selectedOrder.createdAt)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
            <Button onClick={() => { setDetailOpen(false); openStatusUpdate(selectedOrder!); }}>
              <Edit className="w-4 h-4 mr-2" />
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Status Update Dialog ── */}
      <Dialog open={statusUpdateOpen} onOpenChange={setStatusUpdateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>Order {selectedOrder?.orderNumber} · current: <span className="capitalize font-medium">{selectedOrder?.status.replace(/_/g, " ")}</span></DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                Tracking Number <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. DTDC1234567890"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Internal Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="e.g. Dispatched via BlueDart, expected delivery in 3 days"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusUpdateOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={updatingStatus || !newStatus || newStatus === selectedOrder?.status}>
              {updatingStatus && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}