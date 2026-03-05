import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { adminService } from "@/services/adminService";
import {
  Search,
  FileText,
  Printer,
  ExternalLink,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  MapPin,
  Loader2,
  Banknote,
  Smartphone,
  ShieldCheck,
  IndianRupee,
  RefreshCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface AdminOrder {
  _id: string;
  orderNumber: string;
  userId?: { name: string; email: string } | null;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  codFee?: number;
  tax?: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  shippingAddress: {
    fullName: string;
    city: string;
    state: string;
    phone: string;
  };
  createdAt: string;
  trackingNumber?: string;
  courierService?: string;
  shippingZone?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  placed: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  processing: "bg-orange-100 text-orange-800 border-orange-200",
  packed: "bg-orange-100 text-orange-800 border-orange-200",
  shipped: "bg-blue-100 text-blue-800 border-blue-200",
  out_for_delivery: "bg-purple-100 text-purple-800 border-purple-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  returned: "bg-yellow-100 text-yellow-800 border-yellow-200",
  refunded: "bg-gray-100 text-gray-800 border-gray-200",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};

const ORDER_STATUSES = [
  "all",
  "placed",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function PaymentIcon({ method }: { method: string }) {
  const isCOD = method === "cod";
  const isUPI =
    method === "upi" || method === "upi_prepaid" || method === "zoho_upi" || method === "paytm";

  if (isCOD)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
        <Banknote className="w-3 h-3" /> COD
      </span>
    );
  if (isUPI)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
        <Smartphone className="w-3 h-3" /> UPI Prepaid
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
      <ShieldCheck className="w-3 h-3" /> Online
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "placed":
      return <Clock className="w-3.5 h-3.5" />;
    case "confirmed":
      return <CheckCircle className="w-3.5 h-3.5" />;
    case "processing":
    case "packed":
      return <Package className="w-3.5 h-3.5" />;
    case "shipped":
      return <Truck className="w-3.5 h-3.5" />;
    case "out_for_delivery":
      return <MapPin className="w-3.5 h-3.5" />;
    case "delivered":
      return <CheckCircle className="w-3.5 h-3.5" />;
    case "cancelled":
      return <XCircle className="w-3.5 h-3.5" />;
    case "returned":
      return <RotateCcw className="w-3.5 h-3.5" />;
    case "refunded":
      return <IndianRupee className="w-3.5 h-3.5" />;
    default:
      return <Clock className="w-3.5 h-3.5" />;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminInvoiceView() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    page: 1,
    limit: 15,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // ── Fetch orders (admin) ──────────────────────────────────────────────────
  const fetchOrders = useCallback(
    async (p = 1) => {
      setIsLoading(true);
      setHasSearched(true);
      try {
        const params: { page: number; limit: number; search?: string; status?: string } = {
          page: p,
          limit: 15,
        };
        if (search.trim()) params.search = search.trim();
        if (statusFilter !== "all") params.status = statusFilter;

        const data = await adminService.getOrders(params);
        setOrders(data.orders ?? []);
        setPagination({
          total: data.pagination?.total ?? data.total ?? 0,
          pages: data.pagination?.pages ?? data.totalPages ?? 1,
          page: p,
          limit: 15,
        });
      } catch (err: unknown) {
        toast({
          title: "Error loading orders",
          description: err instanceof Error ? err.message : "Please try again",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [search, statusFilter, toast]
  );

  const handleSearch = () => {
    setPage(1);
    fetchOrders(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const openInvoice = (orderId: string) => {
    navigate(`/order/${orderId}/invoice?admin=true`);
  };

  const printInvoice = (orderId: string) => {
    // Open in new tab so the print dialog opens in context
    window.open(`/order/${orderId}/invoice?admin=true`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Order Invoices
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Search for orders and generate printable invoices with full admin details.
        </p>
      </div>

      {/* Search bar */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Search Orders</CardTitle>
          <CardDescription>
            Search by order number, customer name or email, then click "View Invoice" to open the
            print-ready invoice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Order number, customer name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All Statuses" : s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleSearch} disabled={isLoading} className="shrink-0">
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Search
            </Button>
          </div>

          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Invoices opened from here include an <strong>Admin Section</strong> (internal order
              ID, courier data, customer email) that is clearly marked and will appear in the
              printed copy for reconciliation purposes.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : hasSearched && orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="w-12 h-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">No orders found</h3>
            <p className="text-muted-foreground text-sm text-center">
              Try a different search term or remove the status filter.
            </p>
          </CardContent>
        </Card>
      ) : orders.length > 0 ? (
        <>
          {/* Result count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total} order{pagination.total !== 1 ? "s" : ""}
            </p>
            <RefreshCw
              className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => fetchOrders(pagination.page)}
            />
          </div>

          {/* Orders list */}
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={order._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-bold text-sm">#{order.orderNumber}</span>
                        <Badge
                          className={`text-xs border capitalize ${
                            STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          <StatusIcon status={order.status} />
                          <span className="ml-1">{order.status.replace(/_/g, " ")}</span>
                        </Badge>
                        <Badge
                          className={`text-xs capitalize ${
                            PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {order.paymentStatus}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-semibold text-foreground block">Customer</span>
                          {order.userId?.name ?? order.shippingAddress.fullName}
                          {order.userId?.email && (
                            <span className="block text-xs opacity-70">{order.userId.email}</span>
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">Date</span>
                          {formatDate(order.createdAt)}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">Items</span>
                          {order.items.length} item
                          {order.items.length !== 1 ? "s" : ""}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">Total</span>
                          <span className="font-bold text-foreground">
                            ₹{order.total.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Items preview */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {order.items.slice(0, 3).map((item, i) => (
                          <span
                            key={i}
                            className="text-xs bg-muted px-2 py-0.5 rounded-full truncate max-w-[150px]"
                            title={item.name}
                          >
                            {item.name}
                          </span>
                        ))}
                        {order.items.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{order.items.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                      <PaymentIcon method={order.paymentMethod} />

                      <Separator className="sm:block hidden" />

                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => openInvoice(order._id)}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        View Invoice
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs"
                        onClick={() => printInvoice(order._id)}
                      >
                        <Printer className="w-3.5 h-3.5 mr-1.5" />
                        Print
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const p = Math.max(1, pagination.page - 1);
                  setPage(p);
                  fetchOrders(p);
                }}
                disabled={pagination.page <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const p = Math.min(pagination.pages, pagination.page + 1);
                  setPage(p);
                  fetchOrders(p);
                }}
                disabled={pagination.page >= pagination.pages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      ) : !hasSearched ? (
        /* Initial empty state — prompt to search */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Ready to generate invoices</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Search for any order to generate a print-ready invoice. Invoices include full
              billing/shipping details, itemised pricing, payment method indicator, and refund/return
              status.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left w-full max-w-xl">
              {[
                {
                  icon: <Printer className="w-4 h-4 text-blue-500" />,
                  title: "Print-Optimised",
                  desc: "Clean A4 layout with nav/footer hidden on print",
                },
                {
                  icon: <ShieldCheck className="w-4 h-4 text-violet-500" />,
                  title: "Admin Details",
                  desc: "Internal IDs, courier info, customer email included",
                },
                {
                  icon: <RefreshCw className="w-4 h-4 text-orange-500" />,
                  title: "Refund Status",
                  desc: "Clearly shows return/refund/cancellation events",
                },
              ].map((feat, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border"
                >
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0 border">
                    {feat.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{feat.title}</p>
                    <p className="text-xs text-muted-foreground">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
