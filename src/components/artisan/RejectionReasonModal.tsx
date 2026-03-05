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
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Ban, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { Order } from '@/lib/api';

// ── Predefined rejection categories ──────────────────────────────────────────
const REJECTION_CATEGORIES = [
  {
    value: 'out_of_stock',
    label: 'Out of Stock',
    description: 'Item is no longer available',
    hint: 'The product ordered is currently out of stock and cannot be fulfilled.',
  },
  {
    value: 'shipping_address_issue',
    label: 'Shipping Address Issue',
    description: 'Cannot deliver to the provided address',
    hint: 'Unable to deliver to the specified address due to location or access restrictions.',
  },
  {
    value: 'price_discrepancy',
    label: 'Price Discrepancy',
    description: 'Incorrect pricing at time of order',
    hint: 'The order was placed at an incorrect price due to a listing error.',
  },
  {
    value: 'damaged_item',
    label: 'Item Damaged / Quality Issue',
    description: 'Product cannot be shipped in current condition',
    hint: 'The item has a quality defect or was damaged and cannot be dispatched.',
  },
  {
    value: 'buyer_fraud',
    label: 'Suspected Fraud',
    description: 'Unusual or suspicious order pattern',
    hint: 'This order has been flagged for suspicious activity or policy violation.',
  },
  {
    value: 'craft_error',
    label: 'Crafting / Production Error',
    description: 'Unable to produce this order as specified',
    hint: 'A production or crafting issue prevents fulfillment of this specific order.',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Please describe below',
    hint: '',
  },
] as const;

// ── Props ────────────────────────────────────────────────────────────────────
interface RejectionReasonModalProps {
  open: boolean;
  order: Order | null;
  onClose: () => void;
  onRejected: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────
export function RejectionReasonModal({
  open,
  order,
  onClose,
  onRejected,
}: RejectionReasonModalProps) {
  const { toast } = useToast();
  const [category, setCategory] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedCategory = REJECTION_CATEGORIES.find((c) => c.value === category);

  // Auto-fill hint when a category is chosen
  const handleCategoryChange = (val: string) => {
    setCategory(val);
    const cat = REJECTION_CATEGORIES.find((c) => c.value === val);
    if (cat?.hint) {
      setReason(cat.hint);
    } else if (val !== 'other') {
      setReason('');
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setCategory('');
    setReason('');
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!category) {
      toast({ title: 'Select a category', description: 'Please choose a rejection reason category.', variant: 'destructive' });
      return;
    }
    if (trimmed.length < 10) {
      toast({ title: 'Reason too short', description: 'Provide a reason of at least 10 characters.', variant: 'destructive' });
      return;
    }
    if (!order) return;

    setSubmitting(true);
    try {
      await api.artisanDashboard.rejectOrder(order._id, trimmed, category);
      toast({
        title: 'Order rejected',
        description: `Order ${order.orderNumber} rejected. The customer has been notified.`,
      });
      setCategory('');
      setReason('');
      onRejected();
      onClose();
    } catch (err: unknown) {
      toast({
        title: 'Failed to reject order',
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
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-red-700">Reject Order</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                {order ? (
                  <>
                    <span className="font-medium">#{order.orderNumber}</span>
                    {' '}· {order.shippingAddress?.fullName}
                  </>
                ) : (
                  'Provide a reason for rejecting this order.'
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
              This action is <strong>permanent</strong>. The order will be cancelled, the customer
              notified, and payment automatically refunded if applicable.
            </span>
          </div>

          {/* Category selector */}
          <div className="space-y-1.5">
            <Label htmlFor="rejection-category">
              Rejection Category <span className="text-red-500">*</span>
            </Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger id="rejection-category" className="w-full">
                <SelectValue placeholder="Choose a category…" />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div>
                      <span className="font-medium">{cat.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{cat.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory && selectedCategory.value !== 'other' && (
              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                {selectedCategory.label}
              </Badge>
            )}
          </div>

          {/* Reason textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="rejection-reason">
              Detailed Reason <span className="text-red-500">*</span>
              <span className="ml-1 text-xs font-normal text-muted-foreground">(min 10 chars)</span>
            </Label>
            <Textarea
              id="rejection-reason"
              placeholder="Describe the specific reason for rejection (this will be shared with the customer)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={600}
              className="resize-none"
            />
            <div className={`text-right text-xs ${reason.length > 550 ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {reason.length}/600
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitting || !category || reason.trim().length < 10}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rejecting…
              </>
            ) : (
              <>
                <Ban className="w-4 h-4 mr-2" />
                Reject Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
