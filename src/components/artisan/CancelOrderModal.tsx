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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { Order } from '@/lib/api';

// ── Predefined cancellation reasons ──────────────────────────────────────────
const CANCELLATION_REASONS = [
  {
    value: 'out_of_stock',
    label: 'Out of Stock',
    description: 'Product is no longer available',
    hint: 'The product is currently out of stock and I am unable to fulfill this order.',
  },
  {
    value: 'unable_to_fulfill',
    label: 'Unable to Fulfill',
    description: 'Cannot complete the order as specified',
    hint: 'I am unable to fulfill this order due to production or operational constraints.',
  },
  {
    value: 'quality_issue',
    label: 'Quality Issue',
    description: 'Product does not meet quality standards',
    hint: 'The product has a defect or quality issue and cannot be dispatched.',
  },
  {
    value: 'shipping_not_available',
    label: 'Shipping Not Available',
    description: 'Unable to ship to this location',
    hint: 'I am unable to arrange shipping to the customer\'s delivery address.',
  },
  {
    value: 'customer_request',
    label: 'Customer Request',
    description: 'Customer asked to cancel',
    hint: 'The customer contacted me directly to request cancellation of this order.',
  },
  {
    value: 'duplicate_order',
    label: 'Duplicate Order',
    description: 'Order placed more than once by customer',
    hint: 'This appears to be a duplicate of another order already being processed.',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Please describe below',
    hint: '',
  },
] as const;

// ── Props ────────────────────────────────────────────────────────────────────
interface CancelOrderModalProps {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  onCancelled: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export function CancelOrderModal({
  open,
  order,
  onClose,
  onCancelled,
}: CancelOrderModalProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedReason = CANCELLATION_REASONS.find((r) => r.value === reason);

  const handleReasonChange = (val: string) => {
    setReason(val);
    const cat = CANCELLATION_REASONS.find((r) => r.value === val);
    if (cat?.hint) {
      setNote(cat.hint);
    } else if (val !== 'other') {
      setNote('');
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setNote('');
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedNote = note.trim();
    if (!reason) {
      toast({
        title: 'Select a reason',
        description: 'Please choose a cancellation reason.',
        variant: 'destructive',
      });
      return;
    }
    if (trimmedNote.length < 10) {
      toast({
        title: 'Note too short',
        description: 'Please provide a note of at least 10 characters.',
        variant: 'destructive',
      });
      return;
    }
    if (!order) return;

    setSubmitting(true);
    try {
      await api.artisanDashboard.cancelOrder(order._id, reason, trimmedNote);
      toast({
        title: 'Order cancelled',
        description: `Order ${order.orderNumber} has been cancelled. The customer will be notified.`,
      });
      setReason('');
      setNote('');
      onCancelled();
      onClose();
    } catch (err: unknown) {
      toast({
        title: 'Failed to cancel order',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-red-100">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-red-700">Cancel Order</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                {order ? (
                  <>
                    <span className="font-medium">#{order.orderNumber}</span>
                    {' '}· {order.shippingAddress?.fullName}
                  </>
                ) : (
                  'Provide a reason for cancelling this order.'
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Warning banner */}
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Cancelling this order will notify the customer and trigger a refund if payment was
              already collected. This action <strong>cannot be undone</strong>.
            </span>
          </div>

          {/* Reason selector */}
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">
              Cancellation Reason <span className="text-red-500">*</span>
            </Label>
            <Select value={reason} onValueChange={handleReasonChange}>
              <SelectTrigger id="cancel-reason" className="w-full">
                <SelectValue placeholder="Choose a reason…" />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASONS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div>
                      <span className="font-medium">{cat.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{cat.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional note */}
          <div className="space-y-1.5">
            <Label htmlFor="cancel-note">
              Additional Note{' '}
              <span className="text-muted-foreground text-xs">(min 10 characters)</span>
            </Label>
            <Textarea
              id="cancel-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                selectedReason?.value === 'other'
                  ? 'Describe the reason for cancellation…'
                  : 'Add any additional details for the customer…'
              }
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Keep Order
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || !reason || note.trim().length < 10}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling…
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
