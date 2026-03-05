/**
 * InvoiceViewer.tsx — Module 8: Bill & Invoice UI
 * Direct invoice access by ID: /invoice/:invoiceId
 * Renders from the persisted Invoice document (Module 3).
 */
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Download, Printer, Loader2, AlertCircle, Store, Phone, Mail, Package, IndianRupee, ShieldCheck, FileText, CircleCheck, Ban, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { Invoice, InvoiceType } from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

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

// ─── Gradient / heading by invoice type ──────────────────────────────────────

function getTypeInfo(type: InvoiceType | undefined, status: string) {
  if (status === "void") return { heading: "INVOICE", sub: "This document has been voided", grad: "from-gray-700 to-gray-600" };
  switch (type) {
    case "cancellation_note": return { heading: "CREDIT NOTE", sub: "Cancellation Credit Note", grad: "from-red-900 to-red-700" };
    case "rejection_note":    return { heading: "CREDIT NOTE", sub: "Rejection Credit Note — Full Refund", grad: "from-rose-900 to-rose-700" };
    default:                  return { heading: "TAX INVOICE", sub: "Handcrafted by Indian Artisans · Made with Love", grad: "from-slate-900 to-slate-700" };
  }
}

// ─── Line Items Breakdown ─────────────────────────────────────────────────────

function LineItemsBreakdown({ invoice }: { invoice: Invoice }) {
  const isCN = invoice.type === "cancellation_note" || invoice.type === "rejection_note";
  const fmt2 = (n: number) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="space-y-2.5 text-sm">
      {(invoice.lineItems ?? []).map((item, i) => {
        const isNeg   = (item.amount ?? 0) < 0;
        const isTotal = item.type === "total" || item.isBold;
        const isFee   = item.type === "cancellation_fee";
        const isRefund= item.type === "refund";
        const isFreeS = item.type === "shipping" && item.isFree;
        const amtClass = isNeg ? "text-green-700 font-semibold" :
          isFee         ? "text-red-700 font-semibold" :
          isRefund && isCN ? "text-blue-700 font-semibold" : "font-medium";
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

// ─── Credit Note Summary ──────────────────────────────────────────────────────

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvoiceViewer() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/sign-in");
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!invoiceId || authLoading || !isAuthenticated) return;
    setIsLoading(true);
    api.invoices.getOne(invoiceId)
      .then((res) => setInvoice(res.invoice))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load invoice.";
        setError(msg);
        toast({ title: "Error loading invoice", description: msg, variant: "destructive" });
      })
      .finally(() => setIsLoading(false));
  }, [invoiceId, authLoading, isAuthenticated, toast]);

  const handlePrint = () => window.print();

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

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-20 flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Invoice Not Found</h2>
              <p className="text-muted-foreground text-sm">{error ?? "Invoice not found."}</p>
              <Button onClick={() => navigate("/orders")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const typeInfo = getTypeInfo(invoice.type, invoice.status);
  const isCreditNote = invoice.type === "cancellation_note" || invoice.type === "rejection_note";
  const buyer = invoice.buyerSnapshot;
  const fmt2 = (n: number) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-container { max-width: 100% !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
          .print-shadow { box-shadow: none !important; border: 1px solid #ddd !important; }
          @page { margin: 1.5cm; size: A4; }
        }
        .void-watermark {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 8rem; font-weight: 900;
          color: rgba(220,38,38,0.10); pointer-events: none;
          user-select: none; letter-spacing: 0.15em;
          white-space: nowrap; z-index: 0;
        }
        .cn-watermark {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 5.5rem; font-weight: 900;
          color: rgba(239,68,68,0.07); pointer-events: none;
          user-select: none; letter-spacing: 0.12em;
          white-space: nowrap; z-index: 0;
        }
      `}</style>

      <div className="min-h-screen bg-muted/30">
        <div className="no-print"><Navigation /></div>

        <div className="pt-20 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 print-container">

            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 no-print">
              <Button variant="outline" size="sm" onClick={() => navigate("/orders")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                My Orders
              </Button>
              <div className="flex items-center gap-2">
                <InvoiceStatusBadge status={invoice.status} />
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

            {/* ── Invoice Card ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden print-shadow relative">
              {invoice.status === "void" && <div className="void-watermark">VOID</div>}
              {isCreditNote && <div className="cn-watermark">CREDIT NOTE</div>}

              {/* Header */}
              <div className={`bg-gradient-to-r ${typeInfo.grad} text-white px-8 py-7 flex items-start justify-between gap-4`}>
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
                      <Store className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-extrabold tracking-tight">Zaymazone</span>
                  </div>
                  <p className="text-white/60 text-xs">{typeInfo.sub}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-tight">{typeInfo.heading}</p>
                  <p className="text-white/80 text-sm font-mono mt-1">{invoice.invoiceNumber}</p>
                  <p className="text-white/60 text-xs mt-1">Issued: {formatDate(invoice.issuedAt)}</p>
                  <div className="mt-2 flex justify-end">
                    <InvoiceStatusBadge status={invoice.status} size="sm" />
                  </div>
                </div>
              </div>

              {/* Credit note summary banner */}
              {isCreditNote && (
                <div className="px-8 pt-6 pb-2">
                  <CreditNoteSummary invoice={invoice} />
                </div>
              )}

              {/* Buyer details */}
              <div className="px-8 py-5 border-b">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Bill To</p>
                <p className="font-semibold text-sm">{buyer.fullName}</p>
                {buyer.addressLine1 && <p className="text-sm text-muted-foreground">{buyer.addressLine1}</p>}
                <p className="text-sm text-muted-foreground">{buyer.city}, {buyer.state} – {buyer.zipCode}</p>
                <p className="text-sm text-muted-foreground">{buyer.country}</p>
                {buyer.phone && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {buyer.phone}
                  </p>
                )}
                {buyer.email && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> {buyer.email}
                  </p>
                )}
              </div>

              {/* Items */}
              <div className="px-8 py-6">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Order Items
                </h3>
                <div className="grid grid-cols-12 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b pb-2 mb-1">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                <div className="divide-y">
                  {(invoice.itemSnapshots ?? []).map((item, i) => (
                    <div key={i} className="grid grid-cols-12 items-center py-3">
                      <div className="col-span-6 flex items-center gap-3">
                        <img
                          src={(item as { image?: string }).image || "/placeholder.svg"}
                          alt={item.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-border"
                          onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/placeholder.svg")}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight line-clamp-2">{item.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                            SKU: {String(item.productId ?? "").slice(-8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-center text-sm text-muted-foreground">{item.quantity}</div>
                      <div className="col-span-2 text-right text-sm">₹{fmt2(item.unitPrice)}</div>
                      <div className="col-span-2 text-right text-sm font-semibold">₹{fmt2(item.unitPrice * item.quantity)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Breakdown */}
              <div className="px-8 py-6 border-t grid grid-cols-1 md:grid-cols-2 gap-0">
                <div className="md:border-r border-b md:border-b-0 pb-4 md:pb-0 pr-0 md:pr-6 space-y-3">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Invoice Details
                  </h3>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Order #</span>
                      <span className="font-mono font-medium text-foreground">{invoice.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invoice #</span>
                      <span className="font-mono font-medium text-foreground">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Issued</span>
                      <span className="font-medium text-foreground">{formatDate(invoice.issuedAt)}</span>
                    </div>
                    {invoice.shippingZoneLabel && (
                      <div className="flex justify-between">
                        <span>Shipping Zone</span>
                        <span className="font-medium text-foreground capitalize">{invoice.shippingZoneLabel}</span>
                      </div>
                    )}
                    {invoice.estimatedDeliveryDays && (
                      <div className="flex justify-between">
                        <span>Est. Delivery</span>
                        <span className="font-medium text-foreground">{invoice.estimatedDeliveryDays} days</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pl-0 md:pl-6 pt-4 md:pt-0 space-y-2">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <IndianRupee className="w-4 h-4" />
                    Invoice Breakdown
                  </h3>
                  <LineItemsBreakdown invoice={invoice} />
                </div>
              </div>

              {/* Reference strip */}
              <div className="px-8 py-4 bg-muted/40 border-t flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-muted-foreground">
                <span><span className="font-semibold text-foreground">Order #</span> {invoice.orderNumber}</span>
                <span><span className="font-semibold text-foreground">Invoice #</span> {invoice.invoiceNumber}</span>
                <span><span className="font-semibold text-foreground">Date</span> {formatDate(invoice.issuedAt)}</span>
                <span>
                  <span className="font-semibold text-foreground">Type</span>{" "}
                  {invoice.type === "cancellation_note" ? "Cancellation Note" :
                   invoice.type === "rejection_note"   ? "Rejection Note" :
                   invoice.type === "refund_note"      ? "Refund Note" : "Tax Invoice"}
                </span>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t bg-slate-50 text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">Thank you for shopping with Zaymazone!</p>
                <p className="text-xs text-muted-foreground">
                  For queries, contact us at <span className="font-medium text-foreground">support@zaymazone.com</span>
                  {" "}or visit <span className="font-medium text-foreground">www.zaymazone.com/help</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  This is a computer-generated invoice and does not require a signature.
                </p>
                <p className="text-[10px] text-muted-foreground/60 pt-1">
                  {invoice.invoiceNumber} · {invoice.type.replace(/_/g, " ").toUpperCase()} · {formatDate(invoice.issuedAt)}
                </p>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex flex-wrap justify-center mt-8 gap-3 no-print">
              <InvoiceStatusBadge status={invoice.status} />
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

            <div className="flex justify-center mt-6 gap-6 text-sm text-muted-foreground no-print">
              <Link to="/orders" className="hover:text-foreground transition-colors">← Back to Orders</Link>
              <Link to="/help" className="hover:text-foreground transition-colors">Help &amp; Support</Link>
              <Link to="/" className="hover:text-foreground transition-colors">Continue Shopping</Link>
            </div>
          </div>
        </div>

        <div className="no-print"><Footer /></div>
      </div>
    </>
  );
}
