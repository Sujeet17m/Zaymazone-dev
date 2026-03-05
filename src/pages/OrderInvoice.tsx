/**
 * OrderInvoice — Module 8: Bill & Invoice UI
 *
 * Renders a full invoice document for an order.
 * Integrates with the Module 3 persisted Invoice model where available,
 * with graceful fallback to raw Order data for pre-Module-3 orders.
 *
 * Features:
 *  • Real invoice numbers from the Invoice model (INV / CN / RN prefixes)
 *  • Invoice status badge: issued · void · credited
 *  • Invoice type: TAX INVOICE vs CREDIT NOTE (cancellation / rejection)
 *  • Persisted line-items breakdown from the Invoice model
 *  • Credit Note summary banner with refund + fee details
 *  • Invoice History Panel — switch between all docs for an order
 *  • VOID / CREDIT NOTE watermarks
 *  • Enhanced print CSS for clean A4 PDF output
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import type { Order, Invoice, InvoiceType } from "@/lib/api";
import { adminService } from "@/services/adminService";
import { useAuth } from "@/contexts/AuthContext";
import {
  Printer,
  Download,
  ArrowLeft,
  CheckCircle,
  Smartphone,
  Banknote,
  Package,
  Truck,
  MapPin,
  Clock,
  RotateCcw,
  IndianRupee,
  XCircle,
  Info,
  Loader2,
  Store,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  User,
  Phone,
  Mail,
  // Module 8 additions
  FileText,
  History,
  ChevronDown,
  ChevronUp,
  BadgeAlert,
  ReceiptText,
  CircleCheck,
  Ban,
  Undo2,
} from "lucide-react";

// ─── Zone Label Map ───────────────────────────────────────────────────────────

const ZONE_LABELS: Record<string, string> = {
  local: "Local",
  metro: "Metro",
  tier2: "Tier-2 City",
  rest_of_india: "Rest of India",
  remote: "Remote Area",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ORDER_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  placed: {
    label: "Order Placed",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: <Clock className="w-4 h-4" />,
  },
  confirmed: {
    label: "Confirmed",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  processing: {
    label: "Processing",
    color: "text-orange-700",
    bg: "bg-orange-50 border-orange-200",
    icon: <Package className="w-4 h-4" />,
  },
  packed: {
    label: "Packed",
    color: "text-orange-700",
    bg: "bg-orange-50 border-orange-200",
    icon: <Package className="w-4 h-4" />,
  },
  shipped: {
    label: "Shipped",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: <Truck className="w-4 h-4" />,
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
    icon: <MapPin className="w-4 h-4" />,
  },
  delivered: {
    label: "Delivered",
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    icon: <CheckCircle className="w-4 h-4" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: <XCircle className="w-4 h-4" />,
  },
  rejected: {
    label: "Rejected",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    icon: <Ban className="w-4 h-4" />,
  },
  returned: {
    label: "Returned",
    color: "text-yellow-700",
    bg: "bg-yellow-50 border-yellow-200",
    icon: <RotateCcw className="w-4 h-4" />,
  },
  refunded: {
    label: "Refunded",
    color: "text-gray-700",
    bg: "bg-gray-50 border-gray-200",
    icon: <IndianRupee className="w-4 h-4" />,
  },
};

const PAYMENT_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  paid: { label: "PAID", color: "text-green-700", bg: "bg-green-100 border-green-300" },
  pending: { label: "PENDING", color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300" },
  processing: { label: "PROCESSING", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
  failed: { label: "FAILED", color: "text-red-700", bg: "bg-red-100 border-red-300" },
  refunded:   { label: "REFUNDED",   color: "text-gray-700",   bg: "bg-gray-100 border-gray-300" },
  cancelled:  { label: "CANCELLED",  color: "text-red-700",    bg: "bg-red-100 border-red-300" },
};

// ─── Invoice Status Badge ─────────────────────────────────────────────────────

function InvoiceStatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const map: Record<string, { label: string; classes: string; icon: React.ReactNode }> = {
    issued:   { label: "ISSUED",   classes: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <CircleCheck className="w-3 h-3" /> },
    void:     { label: "VOID",     classes: "bg-red-100 text-red-800 border-red-300",             icon: <Ban className="w-3 h-3" /> },
    credited: { label: "CREDITED", classes: "bg-gray-100 text-gray-700 border-gray-300",          icon: <Undo2 className="w-3 h-3" /> },
  };
  const m = map[status] ?? map.issued;
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5 gap-1" : "text-xs px-2.5 py-1 gap-1.5";
  return (
    <span className={`inline-flex items-center font-bold tracking-widest border rounded-full ${m.classes} ${sizeClass}`}>
      {m.icon}
      {m.label}
    </span>
  );
}

// ─── Invoice Type Info ────────────────────────────────────────────────────────

type InvoiceTypeInfo = {
  heading: string;
  subheading: string;
  gradientClass: string;
};

function getInvoiceTypeInfo(type: InvoiceType | undefined, status: string): InvoiceTypeInfo {
  if (status === "void") {
    return { heading: "INVOICE", subheading: "This document has been voided", gradientClass: "from-gray-700 to-gray-600" };
  }
  switch (type) {
    case "cancellation_note":
      return { heading: "CREDIT NOTE", subheading: "Cancellation Credit Note", gradientClass: "from-red-900 to-red-700" };
    case "rejection_note":
      return { heading: "CREDIT NOTE", subheading: "Rejection Credit Note — Full Refund", gradientClass: "from-rose-900 to-rose-700" };
    default:
      return { heading: "TAX INVOICE", subheading: "Handcrafted by Indian Artisans · Made with Love", gradientClass: "from-slate-900 to-slate-700" };
  }
}

// ─── Invoice History Panel ────────────────────────────────────────────────────

function InvoiceHistoryPanel({
  invoices, activeId, onSelect,
}: {
  invoices: Invoice[];
  activeId: string | null;
  onSelect: (inv: Invoice) => void;
}) {
  const [open, setOpen] = useState(false);
  if (invoices.length <= 1) return null;
  const typeLabel: Record<string, string> = {
    sale: "Tax Invoice",
    cancellation_note: "Cancellation Note",
    rejection_note: "Rejection Note",
    refund_note: "Refund Note",
  };
  const fmt2 = (n: number) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="no-print mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
      >
        <span className="flex items-center gap-2"><History className="w-4 h-4" />Invoice History ({invoices.length} documents)</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="border border-t-0 border-amber-200 rounded-b-xl overflow-hidden bg-white divide-y">
          {invoices.map((inv) => {
            const isActive = inv._id === activeId;
            return (
              <button key={inv._id} onClick={() => { onSelect(inv); setOpen(false); }}
                className={`w-full flex items-center justify-between px-5 py-3 text-sm transition-colors text-left ${
                  isActive ? "bg-amber-50/70" : "hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ReceiptText className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-amber-600" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-semibold">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel[inv.type] ?? inv.type} · {new Date(inv.issuedAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">₹{fmt2(inv.grandTotal)}</span>
                  <InvoiceStatusBadge status={inv.status} size="sm" />
                  {isActive && <span className="text-[10px] border border-amber-400 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full font-bold">Viewing</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Invoice Line-Items Breakdown (Module 3) ──────────────────────────────────

function InvoiceLineItemsBreakdown({ invoice }: { invoice: Invoice }) {
  const isCreditNote = invoice.type === "cancellation_note" || invoice.type === "rejection_note";
  const fmt2 = (n: number) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="space-y-2.5 text-sm">
      {(invoice.lineItems ?? []).map((item, i) => {
        const isNeg   = (item.amount ?? 0) < 0;
        const isTotal = item.type === "total" || item.isBold;
        const isRefund= item.type === "refund";
        const isFee   = item.type === "cancellation_fee";
        const isFreeS = item.type === "shipping" && item.isFree;
        const amtClass = isNeg ? "text-green-700 font-semibold" :
          isFee       ? "text-red-700 font-semibold" :
          isRefund && isCreditNote ? "text-blue-700 font-semibold" : "font-medium";
        return (
          <div key={i} className={`flex justify-between items-baseline gap-4 ${isTotal ? "border-t pt-2 mt-1" : ""}`}>
            <div className="flex flex-col min-w-0">
              <span className={isTotal ? "font-bold text-base" : "text-muted-foreground"}>{item.label}</span>
              {item.description && <span className="text-xs text-muted-foreground/70 leading-none mt-0.5">{item.description}</span>}
            </div>
            <span className={`flex-shrink-0 ${isTotal ? "text-2xl font-extrabold text-primary" : amtClass}`}>
              {isFreeS ? "FREE" : `${isNeg ? "− " : ""}₹${fmt2(Math.abs(item.amount ?? 0))}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Fallback Breakdown (raw Order) ──────────────────────────────────────────

function OrderBreakdown({ order }: { order: Order }) {
  const fmt2 = (n: number) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const discount = Math.max(0, order.subtotal + order.shippingCost + (order.codFee ?? 0) + (order.tax ?? 0) - order.total);
  return (
    <div className="space-y-2.5 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Subtotal ({order.items.length} item{order.items.length !== 1 ? "s" : ""})</span>
        <span className="font-medium">₹{fmt2(order.subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground flex items-center gap-1">
          <Truck className="w-3.5 h-3.5" /> Shipping
          {order.shippingBreakdown?.isFreeShipping && <span className="text-green-600 text-xs font-semibold">(FREE)</span>}
        </span>
        <span className={order.shippingCost === 0 ? "text-green-600 font-medium" : "font-medium"}>
          {order.shippingCost === 0 ? "FREE" : `₹${fmt2(order.shippingCost)}`}
        </span>
      </div>
      {(order.codFee ?? 0) > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> COD Fee</span>
          <span className="font-medium">₹{fmt2(order.codFee)}</span>
        </div>
      )}
      {(order.tax ?? 0) > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxes &amp; Charges</span>
          <span className="font-medium">₹{fmt2(order.tax)}</span>
        </div>
      )}
      {discount > 0 && (
        <div className="flex justify-between text-green-700">
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Discount Applied</span>
          <span className="font-semibold">− ₹{fmt2(discount)}</span>
        </div>
      )}
      {order.shippingBreakdown && (
        <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
          {order.shippingBreakdown.totalWeightDisplay && (
            <div className="flex justify-between"><span>Parcel Weight</span><span>{order.shippingBreakdown.totalWeightDisplay}</span></div>
          )}
          {(order.shippingBreakdown.baseCharge ?? 0) > 0 && (
            <div className="flex justify-between"><span>Base Charge</span><span>₹{fmt2(order.shippingBreakdown.baseCharge)}</span></div>
          )}
          {(order.shippingBreakdown.weightCharge ?? 0) > 0 && (
            <div className="flex justify-between"><span>Weight Surcharge</span><span>₹{fmt2(order.shippingBreakdown.weightCharge)}</span></div>
          )}
        </div>
      )}
      <Separator className="my-1" />
      <div className="flex justify-between items-baseline pt-1">
        <span className="font-bold text-base">Grand Total</span>
        <span className="text-2xl font-extrabold text-primary">₹{fmt2(order.total)}</span>
      </div>
      {order.paymentMethod === "cod" && (
        <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-3 py-2 flex items-start gap-1.5 border border-yellow-200">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> Amount payable in cash on delivery.
        </p>
      )}
    </div>
  );
}

// ─── Credit Note Summary Banner ───────────────────────────────────────────────

function CreditNoteSummary({ invoice }: { invoice: Invoice }) {
  const fmt2 = (n: number) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isCancellation = invoice.type === "cancellation_note";
  return (
    <div className={`p-4 rounded-xl border-2 ${isCancellation ? "bg-red-50 border-red-200" : "bg-rose-50 border-rose-200"}`}>
      <div className="flex flex-wrap gap-6 justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider ${isCancellation ? "text-red-700" : "text-rose-700"}`}>
            {isCancellation ? "Cancellation Summary" : "Rejection Summary"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {isCancellation ? invoice.cancellationReason || "Order cancelled by customer" : invoice.rejectionReason || "Order rejected by seller"}
          </p>
          {invoice.notes && <p className="text-xs text-muted-foreground italic mt-1">{invoice.notes}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Refund Amount</p>
            <p className="text-2xl font-extrabold text-blue-700">₹{fmt2(invoice.refundableAmount ?? 0)}</p>
            {invoice.isCodOrder && <p className="text-xs text-yellow-700 font-medium">COD — no payment collected</p>}
          </div>
          {(invoice.cancellationFee ?? 0) > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Fee Retained</p>
              <p className="font-bold text-red-700">₹{fmt2(invoice.cancellationFee ?? 0)}</p>
              {invoice.cancellationTier && <p className="text-xs text-muted-foreground capitalize">Tier: {invoice.cancellationTier}</p>}
            </div>
          )}
          {invoice.feeWaived && (
            <span className="text-[10px] bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded-full font-bold">Fee Waived</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Payment Method Section ───────────────────────────────────────────────────

function PaymentIndicator({ method, status }: { method: Order["paymentMethod"]; status: Order["paymentStatus"] }) {
  const isCOD = method === "cod";
  const isUPI =
    method === "upi" ||
    method === "upi_prepaid" ||
    method === "zoho_upi" ||
    method === "paytm";

  const psm = PAYMENT_STATUS_META[status] ?? PAYMENT_STATUS_META.pending;

  return (
    <div className="flex flex-col gap-3">
      {/* Payment type chip */}
      {isCOD ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-yellow-300 bg-yellow-50">
          <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center flex-shrink-0">
            <Banknote className="w-5 h-5 text-yellow-700" />
          </div>
          <div>
            <p className="font-bold text-yellow-800 text-sm uppercase tracking-wide">
              Cash on Delivery (COD)
            </p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Payment collected at doorstep upon delivery
            </p>
          </div>
        </div>
      ) : isUPI ? (
        <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-violet-300 bg-violet-50">
          <div className="w-10 h-10 rounded-full bg-violet-200 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-violet-700" />
          </div>
          <div>
            <p className="font-bold text-violet-800 text-sm uppercase tracking-wide">
              UPI Prepaid
            </p>
            <p className="text-xs text-violet-700 mt-0.5">
              Paid instantly via UPI before dispatch
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-blue-300 bg-blue-50">
          <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="font-bold text-blue-800 text-sm uppercase tracking-wide">
              Online Payment
            </p>
            <p className="text-xs text-blue-700 mt-0.5 capitalize">
              {method.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      )}

      {/* Payment status badge */}
      <div
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-sm ${psm.bg} ${psm.color}`}
      >
        <div className="w-2 h-2 rounded-full bg-current opacity-75" />
        Payment Status: {psm.label}
      </div>
    </div>
  );
}

// ─── Refund & Return Status ───────────────────────────────────────────────────

function RefundReturnStatus({ order }: { order: Order }) {
  const isReturned = order.status === "returned";
  const isRefunded = order.status === "refunded" || order.paymentStatus === "refunded";
  const isCancelled = order.status === "cancelled";
  const isRejected = order.status === "rejected";

  if (!isReturned && !isRefunded && !isCancelled && !isRejected) return null;

  const refundEvents = order.statusHistory?.filter((h) =>
    ["returned", "refunded", "cancelled", "rejected"].includes(h.status)
  ) ?? [];

  return (
    <div className="print:break-inside-avoid">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <RefreshCw className="w-4 h-4" />
        Refund &amp; Return Status
      </h3>
      <div
        className={`rounded-xl border-2 p-4 space-y-3 ${
          isRefunded
            ? "border-gray-300 bg-gray-50"
            : isReturned
            ? "border-yellow-300 bg-yellow-50"
            : isRejected
            ? "border-rose-200 bg-rose-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        {/* Status row */}
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center ${
              isRefunded ? "bg-gray-200" : isReturned ? "bg-yellow-200" : isRejected ? "bg-rose-200" : "bg-red-200"
            }`}
          >
            {isRefunded ? (
              <IndianRupee className="w-4 h-4 text-gray-700" />
            ) : isReturned ? (
              <RotateCcw className="w-4 h-4 text-yellow-700" />
            ) : isRejected ? (
              <BadgeAlert className="w-4 h-4 text-rose-700" />
            ) : (
              <XCircle className="w-4 h-4 text-red-700" />
            )}
          </div>
          <div>
            <p
              className={`font-bold text-sm ${
                isRefunded ? "text-gray-800" : isReturned ? "text-yellow-800" : isRejected ? "text-rose-800" : "text-red-800"
              }`}
            >
              {isRefunded ? "Refund Processed" : isReturned ? "Return Initiated" : isRejected ? "Order Rejected by Seller" : "Order Cancelled"}
            </p>
            <p
              className={`text-xs ${
                isRefunded ? "text-gray-600" : isReturned ? "text-yellow-700" : isRejected ? "text-rose-600" : "text-red-600"
              }`}
            >
              {isRefunded
                ? "The refund has been processed to the original payment source"
                : isReturned
                ? "Return request accepted – item is being picked up"
                : isRejected
                ? "The seller was unable to fulfil this order – a full refund will be issued"
                : "This order has been cancelled"}
            </p>
          </div>
        </div>

        {/* Event timeline */}
        {refundEvents.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-black/10">
            {refundEvents.map((evt, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Clock className="w-3 h-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div>
                  <span className="font-semibold capitalize">{evt.status.replace(/_/g, " ")}</span>
                  {" · "}
                  <span className="text-muted-foreground">{formatDateTime(evt.timestamp)}</span>
                  {evt.note && (
                    <p className="text-muted-foreground mt-0.5 italic">{evt.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Order Timeline ───────────────────────────────────────────────────────────

function OrderTimeline({ history }: { history: Order["statusHistory"] }) {
  if (!history?.length) return null;
  const sorted = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="print:break-inside-avoid">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Order Timeline
      </h3>
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-[18px] top-5 bottom-5 w-0.5 bg-border" />
        <div className="space-y-4">
          {sorted.map((evt, i) => {
            const meta = ORDER_STATUS_META[evt.status] ?? ORDER_STATUS_META.placed;
            const isLast = i === sorted.length - 1;
            return (
              <div key={i} className="flex gap-3 items-start">
                <div
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 relative z-10 ${
                    isLast ? meta.bg + " " + meta.color : "bg-background border-border text-muted-foreground"
                  }`}
                >
                  {meta.icon}
                </div>
                <div className="pt-1.5">
                  <p className={`text-sm font-semibold ${isLast ? meta.color : "text-foreground"}`}>
                    {meta.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(evt.timestamp)}</p>
                  {evt.note && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">{evt.note}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Extra Info ─────────────────────────────────────────────────────────

interface AdminExtrasOrder extends Order {
  userId?: { name?: string; email?: string } | null;
}

function AdminExtras({ order }: { order: AdminExtrasOrder }) {
  const userInfo = order.userId;

  return (
    <div className="rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 p-4 space-y-3">
      <p className="text-xs font-bold text-orange-700 uppercase tracking-widest flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        Admin-Only Section — Not printed for customers
      </p>
      <Separator className="border-orange-200" />
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Internal Order ID</p>
          <p className="font-mono text-xs font-semibold">{order._id || order.id}</p>
        </div>
        {order.zohoOrderId && (
          <div>
            <p className="text-xs text-muted-foreground">Zoho Order ID</p>
            <p className="font-mono text-xs font-semibold">{order.zohoOrderId}</p>
          </div>
        )}
        {order.zohoPaymentId && (
          <div>
            <p className="text-xs text-muted-foreground">Zoho Payment ID</p>
            <p className="font-mono text-xs font-semibold">{order.zohoPaymentId}</p>
          </div>
        )}
        {order.trackingNumber && (
          <div>
            <p className="text-xs text-muted-foreground">Tracking Number</p>
            <p className="font-mono text-xs font-semibold">{order.trackingNumber}</p>
          </div>
        )}
        {order.courierService && (
          <div>
            <p className="text-xs text-muted-foreground">Courier Service</p>
            <p className="font-semibold text-xs">{order.courierService}</p>
          </div>
        )}
        {order.shippingZone && (
          <div>
            <p className="text-xs text-muted-foreground">Shipping Zone</p>
            <p className="font-semibold text-xs">
              {ZONE_LABELS[order.shippingZone] || order.shippingZone}
            </p>
          </div>
        )}
      </div>

      {/* Customer information */}
      {userInfo?.name && (
        <>
          <Separator className="border-orange-200" />
          <div>
            <p className="text-xs text-muted-foreground mb-1">Customer Account</p>
            <div className="flex flex-wrap gap-3 text-xs">
              {userInfo.name && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> {userInfo.name}
                </span>
              )}
              {userInfo.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {userInfo.email}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrderInvoice() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const isAdmin = searchParams.get("admin") === "true";

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  // ── Redirect unauthenticated customers to sign-in ────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isAdmin) {
      navigate("/sign-in");
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  // ── Fetch order ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;
    // For customer routes: wait until auth state is resolved and user is authenticated
    if (!isAdmin && (authLoading || !isAuthenticated)) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = isAdmin
          ? await adminService.getOrderById(orderId)
          : await api.getOrder(orderId);
        setOrder(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load order. Please try again.";
        setError(msg);
        toast({ title: "Error loading invoice", description: msg, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [orderId, isAdmin, toast, isAuthenticated, authLoading]);

  // ── Fetch persisted invoices (Module 3) ─────────────────────────────────────
  useEffect(() => {
    if (!orderId || !order) return;
    api.invoices.getForOrder(orderId)
      .then((res) => {
        const list = res.invoices;
        setInvoices(list);
        if (list.length > 0) {
          // Priority: credit/rejection notes > sale invoice
          const cn = list.find((i) => i.type === "cancellation_note" || i.type === "rejection_note");
          setActiveInvoice(cn ?? list[0]);
        }
      })
      .catch(() => { /* silently degrade to raw-order fallback */ });
  }, [orderId, order]);

  // ── Computed values ──────────────────────────────────────────────────────────
  const invoiceNumber = activeInvoice?.invoiceNumber ?? (order ? `INV-${order.orderNumber}` : "");
  const invoiceStatus = activeInvoice?.status ?? "issued";
  const invoiceType   = activeInvoice?.type;
  const typeInfo      = getInvoiceTypeInfo(invoiceType, invoiceStatus);
  const isCreditNote  = invoiceType === "cancellation_note" || invoiceType === "rejection_note";

  // ── Print handler ────────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // ── Loading / Error states ───────────────────────────────────────────────────
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading invoice…</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Invoice Not Found</h2>
              <p className="text-muted-foreground text-sm">{error ?? "Order not found."}</p>
              <Button onClick={() => navigate(isAdmin ? "/admin" : "/orders")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isAdmin ? "Back to Admin" : "Back to Orders"}
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const addr = order.shippingAddress;
  const billAddr = order.billingAddress ?? order.shippingAddress;
  const currentStatusMeta = ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.placed;

  return (
    <>
      {/* ── Print styles (injected as a real style block) ─────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .print-shadow { box-shadow: none !important; border: 1px solid #ddd !important; }
          @page {
            margin: 1.5cm;
            size: A4;
          }
        }
        .void-watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 8rem;
          font-weight: 900;
          color: rgba(220,38,38,0.10);
          pointer-events: none;
          user-select: none;
          letter-spacing: 0.15em;
          white-space: nowrap;
          z-index: 0;
        }
        .cn-watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 5.5rem;
          font-weight: 900;
          color: rgba(239,68,68,0.07);
          pointer-events: none;
          user-select: none;
          letter-spacing: 0.12em;
          white-space: nowrap;
          z-index: 0;
        }
      `}</style>

      <div className="min-h-screen bg-muted/30">
        {/* ── Navigation (hidden on print) ──────────────────────────────────── */}
        <div className="no-print">
          <Navigation />
        </div>

        <div className="pt-20 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 print-container">

            {/* ── Print/Back toolbar ────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-4 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(isAdmin ? "/admin" : "/orders")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isAdmin ? "Admin Panel" : "My Orders"}
              </Button>

              <div className="flex items-center gap-2">
                <InvoiceStatusBadge status={invoiceStatus} />
                {isCreditNote && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-red-100 text-red-800 border border-red-300 rounded-full tracking-wider">
                    <FileText className="w-3 h-3" />
                    CREDIT NOTE
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Download className="w-4 h-4 mr-2" />
                  Save as PDF
                </Button>
                <Button size="sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>

            {/* ── Invoice History Panel ─────────────────────────────────────── */}
            <InvoiceHistoryPanel
              invoices={invoices}
              activeId={activeInvoice?._id ?? null}
              onSelect={setActiveInvoice}
            />

            {/* ── Invoice Card ──────────────────────────────────────────────── */}
            <div
              ref={printRef}
              className="bg-white rounded-2xl shadow-lg overflow-hidden print-shadow relative"
            >
              {/* Watermarks */}
              {invoiceStatus === "void" && <div className="void-watermark">VOID</div>}
              {isCreditNote && <div className="cn-watermark">CREDIT NOTE</div>}

              {/* ══ INVOICE HEADER ═══════════════════════════════════════════ */}
              <div className={`bg-gradient-to-r ${typeInfo.gradientClass} text-white px-8 py-7 flex items-start justify-between gap-4`}>
                {/* Brand */}
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-extrabold tracking-tight">Zaymazone</span>
                  </div>
                  <p className="text-white/60 text-xs">
                    {typeInfo.subheading}
                  </p>
                </div>

                {/* Invoice metadata */}
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-tight">{typeInfo.heading}</p>
                  <p className="text-white/80 text-sm font-mono mt-1">{invoiceNumber}</p>
                  <p className="text-white/60 text-xs mt-1">
                    Issued: {formatDate(order.createdAt)}
                  </p>
                  {/* Current order status badge */}
                  <div
                    className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold border ${currentStatusMeta.bg} ${currentStatusMeta.color}`}
                  >
                    {currentStatusMeta.icon}
                    {currentStatusMeta.label}
                  </div>
                </div>
              </div>

              {/* ══ CREDIT NOTE SUMMARY (shown for CN/RN only) ════════════════ */}
              {isCreditNote && activeInvoice && (
                <div className="px-8 pt-6 pb-2">
                  <CreditNoteSummary invoice={activeInvoice} />
                </div>
              )}

              {/* ══ ADDRESSES ════════════════════════════════════════════════ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b">
                {/* Bill To */}
                <div className="px-8 py-5 border-r-0 md:border-r border-b md:border-b-0">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Bill To
                  </p>
                  <p className="font-semibold text-sm">{billAddr.fullName}</p>
                  {(billAddr.addressLine1 || billAddr.street) && (
                    <p className="text-sm text-muted-foreground">
                      {billAddr.addressLine1 || billAddr.street}
                    </p>
                  )}
                  {billAddr.addressLine2 && (
                    <p className="text-sm text-muted-foreground">{billAddr.addressLine2}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {billAddr.city}, {billAddr.state} – {billAddr.zipCode}
                  </p>
                  <p className="text-sm text-muted-foreground">{billAddr.country}</p>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {billAddr.phone}
                  </p>
                  {billAddr.email && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {billAddr.email}
                    </p>
                  )}
                </div>

                {/* Ship To */}
                <div className="px-8 py-5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                    Ship To
                  </p>
                  <p className="font-semibold text-sm">{addr.fullName}</p>
                  {(addr.addressLine1 || addr.street) && (
                    <p className="text-sm text-muted-foreground">
                      {addr.addressLine1 || addr.street}
                    </p>
                  )}
                  {addr.addressLine2 && (
                    <p className="text-sm text-muted-foreground">{addr.addressLine2}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {addr.city}, {addr.state} – {addr.zipCode}
                  </p>
                  <p className="text-sm text-muted-foreground">{addr.country}</p>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {addr.phone}
                  </p>
                  {/* Shipping info */}
                  {(order.shippingZone || order.trackingNumber) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {order.shippingZone && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium capitalize">
                          {ZONE_LABELS[order.shippingZone] ?? order.shippingZone.replace(/_/g, " ")}
                        </span>
                      )}
                      {order.trackingNumber && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-mono">
                          <Truck className="w-3 h-3 inline mr-0.5" />
                          {order.trackingNumber}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ══ ITEMS TABLE ══════════════════════════════════════════════ */}
              <div className="px-8 py-6">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Order Items
                </h3>

                {/* Table header */}
                <div className="grid grid-cols-12 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b pb-2 mb-1">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>

                {/* Items */}
                <div className="divide-y">
                  {order.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 items-center py-3">
                      {/* Product name + image */}
                      <div className="col-span-6 flex items-center gap-3">
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt={item.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-border"
                          onError={(e) =>
                            ((e.currentTarget as HTMLImageElement).src = "/placeholder.svg")
                          }
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight line-clamp-2">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            SKU: {String(item.productId ?? '').slice(-8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-center text-sm text-muted-foreground">
                        {item.quantity}
                      </div>
                      <div className="col-span-2 text-right text-sm">
                        ₹{fmt(item.price)}
                      </div>
                      <div className="col-span-2 text-right text-sm font-semibold">
                        ₹{fmt(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ══ FEE BREAKDOWN + PAYMENT ══════════════════════════════════ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t">
                {/* Payment method */}
                <div className="px-8 py-6 border-r-0 md:border-r border-b md:border-b-0 space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Payment Details
                  </h3>
                  <PaymentIndicator method={order.paymentMethod} status={order.paymentStatus} />

                  {/* Shipping info note */}
                  {order.courierFlags?.suggestedCourier && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>
                        Dispatched via{" "}
                        <span className="font-medium">{order.courierFlags.suggestedCourier}</span>
                        {order.courierFlags.bookingType && (
                          <> &middot; Booking: <span className="capitalize">{order.courierFlags.bookingType}</span></>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Fee breakdown */}
                <div className="px-8 py-6 space-y-2">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <IndianRupee className="w-4 h-4" />
                    Invoice Breakdown
                  </h3>
                  {activeInvoice
                    ? <InvoiceLineItemsBreakdown invoice={activeInvoice} />
                    : <OrderBreakdown order={order} />
                  }
                </div>
              </div>

              {/* ══ ORDER REFERENCE STRIP ════════════════════════════════════ */}
              <div className="px-8 py-4 bg-muted/40 border-t flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">Order #</span>{" "}
                  {order.orderNumber}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Invoice #</span>{" "}
                  {invoiceNumber}
                </span>
                <span>
                  <span className="font-semibold text-foreground">Date</span>{" "}
                  {formatDate(order.createdAt)}
                </span>
                {invoiceType && (
                  <span>
                    <span className="font-semibold text-foreground">Type</span>{" "}
                    {invoiceType === "cancellation_note" ? "Cancellation Note" :
                     invoiceType === "rejection_note"   ? "Rejection Note" :
                     invoiceType === "refund_note"      ? "Refund Note" : "Tax Invoice"}
                  </span>
                )}
                {order.courierService && (
                  <span>
                    <span className="font-semibold text-foreground">Courier</span>{" "}
                    {order.courierService}
                  </span>
                )}
              </div>

              {/* ══ REFUND / RETURN STATUS ════════════════════════════════════ */}
              {(["returned", "refunded", "cancelled", "rejected"].includes(order.status) ||
              order.paymentStatus === "refunded") ? (
                <div className="px-8 py-6 border-t">
                  <RefundReturnStatus order={order} />
                </div>
              ) : null}

              {/* ══ ADMIN EXTRAS (only shown when ?admin=true) ════════════════ */}
              {isAdmin && (
                <div className="px-8 py-6 border-t">
                  <AdminExtras order={order as AdminExtrasOrder} />
                </div>
              )}

              {/* ══ ORDER TIMELINE ════════════════════════════════════════════ */}
              {order.statusHistory?.length > 0 && (
                <div className="px-8 py-6 border-t">
                  <OrderTimeline history={order.statusHistory} />
                </div>
              )}

              {/* ══ INVOICE FOOTER ════════════════════════════════════════════ */}
              <div className="px-8 py-6 border-t bg-slate-50 text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Thank you for shopping with Zaymazone!
                </p>
                <p className="text-xs text-muted-foreground">
                  For queries, contact us at{" "}
                  <span className="font-medium text-foreground">support@zaymazone.com</span>
                  {" "}or visit{" "}
                  <span className="font-medium text-foreground">www.zaymazone.com/help</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  This is a computer-generated invoice and does not require a signature.
                </p>
                {activeInvoice && (
                  <p className="text-[10px] text-muted-foreground/60 pt-1">
                    {activeInvoice.invoiceNumber} · {activeInvoice.type.replace(/_/g, " ").toUpperCase()} · {new Date(activeInvoice.issuedAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                )}
              </div>
            </div>
            {/* ── End Invoice Card ─────────────────────────────────────────── */}

            {/* ── Bottom Print button (no-print) ───────────────────────────── */}
            <div className="flex flex-wrap justify-center mt-8 gap-3 no-print">
              <InvoiceStatusBadge status={invoiceStatus} />
              {isCreditNote && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 bg-red-100 text-red-800 border border-red-300 rounded-full tracking-wider">
                  <FileText className="w-3 h-3" /> CREDIT NOTE
                </span>
              )}
              <Button variant="outline" onClick={handlePrint}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print Invoice
              </Button>
            </div>

            {/* ── Navigation links ─────────────────────────────────────────── */}
            <div className="flex justify-center mt-6 gap-6 text-sm text-muted-foreground no-print">
              <Link to="/orders" className="hover:text-foreground transition-colors">
                ← Back to Orders
              </Link>
              <Link to="/help" className="hover:text-foreground transition-colors">
                Help &amp; Support
              </Link>
              <Link to="/" className="hover:text-foreground transition-colors">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>

        {/* ── Footer (hidden on print) ──────────────────────────────────────── */}
        <div className="no-print">
          <Footer />
        </div>
      </div>
    </>
  );
}
