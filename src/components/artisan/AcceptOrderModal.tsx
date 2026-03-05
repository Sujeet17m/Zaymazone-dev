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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Loader2, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { Order } from '@/lib/api';

// ── Props ────────────────────────────────────────────────────────────────────
interface AcceptOrderModalProps {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  onAccepted: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export function AcceptOrderModal({ open, order, onClose, onAccepted }: AcceptOrderModalProps) {
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setNote('');
    onClose();
  };

  const handleAccept = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      await api.artisanDashboard.acceptOrder(order._id, note.trim() || undefined);
      toast({
        title: 'Order accepted',
        description: `Order ${order.orderNumber} confirmed. The customer has been notified.`,
      });
      setNote('');
      onAccepted();
      onClose();
    } catch (err: unknown) {
      toast({
        title: 'Failed to accept order',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  const itemSummary = order?.items
    ?.map((item) => `${item.name || 'Item'} × ${item.quantity}`)
    .join(', ');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-100">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <DialogTitle className="text-green-700">Accept Order</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                {order ? (
                  <>
                    <span className="font-medium">#{order.orderNumber}</span>
                    {' '}· {order.shippingAddress?.fullName}
                  </>
                ) : (
                  'Confirm acceptance of this order.'
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Order summary */}
          {order && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <Package className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-muted-foreground line-clamp-2">{itemSummary}</p>
                </div>
              </div>
              <div className="flex justify-between text-sm font-medium border-t pt-2 mt-2">
                <span className="text-muted-foreground">Your earnings</span>
                <span className="text-green-700">{formatCurrency(order.total || 0)}</span>
              </div>
            </div>
          )}

          {/* Optional note */}
          <div className="space-y-1.5">
            <Label htmlFor="accept-note">
              Note to Customer
              <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="accept-note"
              placeholder="E.g. Your order is confirmed and will be dispatched within 2 business days…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={300}
              className="resize-none"
            />
            <p className="text-right text-xs text-muted-foreground">{note.length}/300</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={handleAccept}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Accept Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
