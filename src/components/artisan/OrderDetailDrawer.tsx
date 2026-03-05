// ── Module 9: Order Detail Drawer ────────────────────────────────────────────
import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Package,
  MapPin,
  CreditCard,
  Clock,
  CheckCircle2,
  Ban,
  Send,
  MessageSquare,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Banknote,
  Loader2,
  ChevronRight,
  Tag,
  User,
  Receipt,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import type { Order } from '@/lib/api';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const STATUS_COLORS: Record<string, string> = {
  placed:           'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed:        'bg-blue-100  text-blue-800  border-blue-200',
  processing:       'bg-purple-100 text-purple-800 border-purple-200',
  packed:           'bg-indigo-100 text-indigo-800 border-indigo-200',
  shipped:          'bg-orange-100 text-orange-800 border-orange-200',
  out_for_delivery: 'bg-cyan-100  text-cyan-800  border-cyan-200',
  delivered:        'bg-green-100 text-green-800 border-green-200',
  cancelled:        'bg-red-100   text-red-800   border-red-200',
  rejected:         'bg-red-100   text-red-900   border-red-300',
  returned:         'bg-gray-100  text-gray-700  border-gray-200',
  refunded:         'bg-pink-100  text-pink-800  border-pink-200',
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

// ── Props ──────────────────────────────────────────────────────────────────
interface OrderDetailDrawerProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  /** Trigger AcceptOrderModal in the parent. */
  onAccept: (order: Order) => void;
  /** Trigger RejectionReasonModal in the parent. */
  onReject: (order: Order) => void;
  /** Trigger ReturnRefundModal in the parent. */
  onReturnRefund: (order: Order) => void;
  /** Reload order list after any inline action (e.g. cancel). */
  onRefreshed: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────
export function OrderDetailDrawer({
  order,
  open,
  onClose,
  onAccept,
  onReject,
  onReturnRefund,
  onRefreshed,
}: OrderDetailDrawerProps) {
  const { user }  = useAuth();
  const { toast } = useToast();

  // Cancel confirmation
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling,   setCancelling]   = useState(false);
  const [showCancel,   setShowCancel]   = useState(false);

  // Compose message
  const [msgText,    setMsgText]    = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent,    setMsgSent]    = useState(false);

  // ── Inline cancel ────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!order || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.artisanDashboard.cancelOrder(order._id, cancelReason.trim());
      toast({ title: 'Order cancelled', description: `#${order.orderNumber} has been cancelled.` });
      setShowCancel(false);
      setCancelReason('');
      onRefreshed();
      onClose();
    } catch (err) {
      toast({
        title: 'Failed to cancel',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (!order || !user || !msgText.trim()) return;
    setMsgSending(true);
    try {
      await api.messages.sendInquiry({
        artisanId:     user.id ?? '',
        subject:       `Re: Order #${order.orderNumber}`,
        message:       msgText.trim(),
        orderId:       order._id,
        customerName:  order.shippingAddress?.fullName,
        customerEmail: order.shippingAddress?.email ?? order.billingAddress?.email ?? '',
      });
      setMsgSent(true);
      setMsgText('');
      toast({ title: 'Message sent', description: 'The customer will receive your message.' });
    } catch (err) {
      toast({
        title: 'Failed to send message',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setMsgSending(false);
    }
  };

  const closeAndReset = () => {
    setShowCancel(false);
    setCancelReason('');
    setMsgSent(false);
    setMsgText('');
    onClose();
  };

  if (!order) return null;

  const canAct        = order.status === 'placed';
  const canCancel     = ['placed', 'confirmed', 'processing'].includes(order.status);
  const canReturnRefund = ['delivered'].includes(order.status);
  const StatusIcon    = STATUS_ICON[order.status] ?? Package;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && closeAndReset()}>
      <SheetContent side="right" className="w-full sm:max-w-[580px] p-0 flex flex-col">

        {/* ── Drawer header ──────────────────────────────────────────────── */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b space-y-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${STATUS_COLORS[order.status] ?? 'bg-muted'}`}>
                <StatusIcon className="w-4 h-4" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">#{order.orderNumber}</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  {order.shippingAddress?.fullName} · {fmtDateTime(order.createdAt)}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-bold">{fmt(order.total)}</span>
              <Badge className={`text-xs ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {STATUS_LABEL[order.status] ?? order.status}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full rounded-none border-b h-10 bg-background justify-start px-4 gap-0">
            {[
              { id: 'details', label: 'Details',  icon: Receipt     },
              { id: 'history', label: 'History',  icon: Clock       },
              { id: 'message', label: 'Message',  icon: MessageSquare },
            ].map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-600 data-[state=active]:bg-transparent px-4 text-xs font-medium gap-1.5"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Details Tab ──────────────────────────────────────────────── */}
          <TabsContent value="details" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-5 space-y-5">

                {/* Items */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Items
                  </h3>
                  <div className="space-y-2">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                        <div className="w-10 h-10 rounded-md bg-muted overflow-hidden shrink-0">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-muted-foreground m-3" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name || 'Product'}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(item.price)} × {item.quantity}
                          </p>
                        </div>
                        <span className="text-sm font-semibold shrink-0">
                          {fmt(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-3 rounded-lg border bg-card p-3 space-y-1.5">
                    {[
                      { label: 'Subtotal',   value: fmt(order.subtotal) },
                      { label: 'Shipping',   value: order.shippingCost > 0 ? fmt(order.shippingCost) : 'Free' },
                      ...(order.tax > 0 ? [{ label: 'GST / Tax', value: fmt(order.tax) }] : []),
                      ...(order.codFee > 0 ? [{ label: 'COD Fee', value: fmt(order.codFee) }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{label}</span>
                        <span>{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold border-t pt-1.5 mt-1.5">
                      <span>Total</span>
                      <span className="text-orange-600">{fmt(order.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Shipping Address
                  </h3>
                  <div className="rounded-lg border bg-muted/20 p-3 text-sm space-y-0.5">
                    <p className="font-medium">{order.shippingAddress?.fullName}</p>
                    <p className="text-muted-foreground text-xs">
                      {[
                        order.shippingAddress?.addressLine1 ?? order.shippingAddress?.street,
                        order.shippingAddress?.addressLine2,
                        order.shippingAddress?.city,
                        order.shippingAddress?.state,
                        order.shippingAddress?.zipCode,
                      ].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-muted-foreground text-xs">{order.shippingAddress?.country}</p>
                    <p className="text-muted-foreground text-xs flex items-center gap-1 mt-1">
                      <User className="w-3 h-3" />
                      {order.shippingAddress?.phone}
                    </p>
                  </div>
                </div>

                {/* Payment */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Payment
                  </h3>
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Method</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase">
                        {order.paymentMethod}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Status</span>
                      <span className={`font-medium capitalize ${
                        order.paymentStatus === 'paid' ? 'text-green-600' :
                        order.paymentStatus === 'refunded' ? 'text-pink-600' :
                        order.paymentStatus === 'failed' ? 'text-red-600' :
                        'text-amber-600'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </div>
                    {order.shippingZone && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Shipping Zone</span>
                        <span className="capitalize">{order.shippingZone.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    {order.trackingNumber && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tracking</span>
                        <span className="font-mono text-[11px]">{order.trackingNumber}</span>
                      </div>
                    )}
                    {order.courierService && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Courier</span>
                        <span>{order.courierService}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rejection / Cancellation notes */}
                {(order.rejectionReason || order.cancellationReason) && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Notes
                    </h3>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
                      {order.rejectionReason  && <p><span className="font-medium">Rejection reason: </span>{order.rejectionReason}</p>}
                      {order.cancellationReason && <p><span className="font-medium">Cancellation reason: </span>{order.cancellationReason}</p>}
                    </div>
                  </div>
                )}

                {/* Inline cancel form */}
                {canCancel && !showCancel && (
                  <button
                    onClick={() => setShowCancel(true)}
                    className="w-full text-xs text-red-600 hover:text-red-800 border border-red-200 hover:border-red-300 rounded-lg py-2.5 transition-colors"
                  >
                    Cancel this order…
                  </button>
                )}
                {showCancel && (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-red-800">Cancel Order</p>
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Reason for cancellation (required)…"
                      rows={2}
                      className="text-sm resize-none border-red-200"
                      disabled={cancelling}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-8 text-xs"
                        disabled={cancelling || !cancelReason.trim()}
                        onClick={handleCancel}
                      >
                        {cancelling ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                        Confirm Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => { setShowCancel(false); setCancelReason(''); }}
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── History Tab ───────────────────────────────────────────────── */}
          <TabsContent value="history" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-5">
                {order.statusHistory?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">No history available.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {[...(order.statusHistory ?? [])].reverse().map((entry, idx) => {
                        const EntryIcon = STATUS_ICON[entry.status] ?? Clock;
                        return (
                          <div key={idx} className="flex gap-4">
                            <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                              idx === 0 ? 'bg-orange-100 border-orange-400' : 'bg-card border-border'
                            }`}>
                              <EntryIcon className={`w-4 h-4 ${idx === 0 ? 'text-orange-600' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] px-1.5 ${STATUS_COLORS[entry.status] ?? 'bg-gray-100 text-gray-700'}`}>
                                  {STATUS_LABEL[entry.status] ?? entry.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {fmtDateTime(entry.timestamp)}
                                </span>
                              </div>
                              {entry.note && (
                                <p className="text-xs text-muted-foreground mt-1">{entry.note}</p>
                              )}
                              {entry.updatedBy && (
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                  by {entry.updatedBy}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Message Tab ───────────────────────────────────────────────── */}
          <TabsContent value="message" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-5 space-y-4">
                {/* Context banner */}
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Message about Order #{order.orderNumber}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      To: {order.shippingAddress?.fullName}
                    </p>
                  </div>
                </div>

                {msgSent ? (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <p className="text-sm font-medium">Message sent!</p>
                    <p className="text-xs text-muted-foreground text-center">
                      The customer will receive your message in their inbox.
                    </p>
                    <Button
                      size="sm" variant="outline" className="mt-2"
                      onClick={() => setMsgSent(false)}
                    >
                      Send another
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Your message</Label>
                      <Textarea
                        value={msgText}
                        onChange={(e) => setMsgText(e.target.value)}
                        placeholder="e.g. Your order has been packed and will ship tomorrow. Tracking details will follow…"
                        rows={5}
                        className="text-sm resize-none"
                        disabled={msgSending}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        The message thread will include the order reference automatically.
                      </p>
                    </div>

                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700 gap-2"
                      disabled={msgSending || !msgText.trim()}
                      onClick={handleSendMessage}
                    >
                      {msgSending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />}
                      Send Message
                    </Button>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3 shrink-0" />
                      <span>View and continue conversations on the</span>
                      <Link
                        to="/artisan/messages"
                        className="text-orange-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        Messages page <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* ── Footer actions ─────────────────────────────────────────────── */}
        <div className="border-t px-5 py-3 flex items-center gap-2 flex-wrap bg-background">
          {canAct && (
            <>
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 gap-1.5 h-8"
                onClick={() => { onAccept(order); closeAndReset(); }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Accept Order
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 gap-1.5 h-8"
                onClick={() => { onReject(order); closeAndReset(); }}
              >
                <Ban className="w-3.5 h-3.5" /> Reject Order
              </Button>
            </>
          )}
          {canReturnRefund && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50 gap-1.5 h-8"
                onClick={() => { onReturnRefund(order); closeAndReset(); }}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Return / Refund
              </Button>
            </>
          )}
          {!canAct && !canReturnRefund && (
            <div className="flex-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {order.status === 'delivered'
                  ? 'Order delivered. No further actions needed.'
                  : order.status === 'shipped'
                  ? 'Order shipped. Awaiting delivery confirmation.'
                  : order.status === 'cancelled' || order.status === 'rejected'
                  ? 'This order has been closed.'
                  : `Status: ${STATUS_LABEL[order.status] ?? order.status}`}
              </span>
            </div>
          )}
          <Button size="sm" variant="ghost" className="h-8" onClick={closeAndReset}>
            <ChevronRight className="w-4 h-4" /> Close
          </Button>
        </div>

      </SheetContent>
    </Sheet>
  );
}
