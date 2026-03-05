// ── Module 9: Return & Refund Workflow Modal ──────────────────────────────────
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label }  from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Banknote, Loader2, Package, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { Order } from '@/lib/api';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

// ── Types ──────────────────────────────────────────────────────────────────────
type WorkflowMode = 'return' | 'refund';

// ── Props ──────────────────────────────────────────────────────────────────────
interface ReturnRefundModalProps {
  open: boolean;
  order: Order | null;
  /** Pre-select a mode on open (default: 'return'). */
  initialMode?: WorkflowMode;
  onClose: () => void;
  onCompleted: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function ReturnRefundModal({
  open,
  order,
  initialMode = 'return',
  onClose,
  onCompleted,
}: ReturnRefundModalProps) {
  const { toast }                   = useToast();
  const [mode,       setMode]       = useState<WorkflowMode>(initialMode);
  const [reason,     setReason]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset on close
  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setMode(initialMode);
    onClose();
  };

  const handleSubmit = async () => {
    if (!order || !reason.trim()) return;
    setSubmitting(true);
    try {
      const targetStatus = mode === 'return' ? 'returned' : 'refunded';
      // Use the cancel/status endpoint with the appropriate target status
      await api.artisanDashboard.cancelOrder(
        order._id,
        reason.trim(),
        `Marked as ${targetStatus} by artisan`,
      );
      toast({
        title: mode === 'return' ? 'Order marked as returned' : 'Refund initiated',
        description: `Order #${order.orderNumber} has been updated to ${targetStatus}.`,
      });
      setReason('');
      onCompleted();
      onClose();
    } catch (err) {
      toast({
        title: 'Failed to update order',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${mode === 'return' ? 'bg-orange-100' : 'bg-purple-100'}`}>
              {mode === 'return'
                ? <RotateCcw className="w-5 h-5 text-orange-600" />
                : <Banknote  className="w-5 h-5 text-purple-600" />}
            </div>
            <div>
              <DialogTitle>
                {mode === 'return' ? 'Process Return' : 'Process Refund'}
              </DialogTitle>
              {order && (
                <DialogDescription className="mt-0.5 text-sm">
                  Order <span className="font-medium">#{order.orderNumber}</span>
                  {' · '}{order.shippingAddress?.fullName}
                  {' · '}<span className="font-medium text-orange-600">{fmt(order.total)}</span>
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {order && (
          <div className="space-y-4 py-1">
            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2">
              {(['return', 'refund'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    mode === m
                      ? m === 'return'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {m === 'return'
                    ? <RotateCcw className="w-5 h-5" />
                    : <Banknote  className="w-5 h-5" />}
                  <span className="text-sm font-semibold">
                    {m === 'return' ? 'Mark Returned' : 'Process Refund'}
                  </span>
                  <span className="text-[10px] opacity-70 font-normal text-center leading-snug">
                    {m === 'return'
                      ? 'Item physically returned by customer'
                      : 'Refund amount via original payment channel'}
                  </span>
                </button>
              ))}
            </div>

            {/* Order summary */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {order.items?.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium text-right">{order.shippingAddress?.fullName}</span>
                <span className="text-muted-foreground">Order Total</span>
                <span className="font-semibold text-orange-600 text-right">{fmt(order.total)}</span>
                <span className="text-muted-foreground">Payment</span>
                <div className="flex justify-end">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase">
                    {order.paymentMethod}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Refund notice for COD orders */}
            {mode === 'refund' && order.paymentMethod === 'cod' && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  COD orders cannot be refunded through this system.
                  Please coordinate directly with the customer.
                </span>
              </div>
            )}
            {mode === 'refund' && order.paymentMethod !== 'cod' && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
                <Banknote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Refunds for prepaid orders are processed via the original payment channel.
                  Settlement may take 3–7 business days.
                </span>
              </div>
            )}

            {/* Reason field */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  mode === 'return'
                    ? "e.g. Customer received damaged item, wrong item shipped…"
                    : "e.g. Item out of stock after order was placed, customer requested refund…"
                }
                rows={3}
                className="text-sm resize-none"
                disabled={submitting}
              />
              {!reason.trim() && (
                <p className="text-[11px] text-muted-foreground">Required before proceeding.</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className={`flex-1 sm:flex-none ${
              mode === 'return'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
              : mode === 'return' ? 'Mark as Returned' : 'Initiate Refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
