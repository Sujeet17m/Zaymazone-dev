// ── Module 9: Bulk Order Actions Bar ─────────────────────────────────────────
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Ban, X, Loader2, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import type { Order } from '@/lib/api';

// ── Props ─────────────────────────────────────────────────────────────────────
interface BulkOrderActionsProps {
  selectedOrders: Order[];
  /** Clear selection after action. */
  onClear: () => void;
  /** Called after a batch accept/reject completes so the parent can reload. */
  onActioned: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────
export function BulkOrderActions({ selectedOrders, onClear, onActioned }: BulkOrderActionsProps) {
  const { toast } = useToast();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const placedOrders = selectedOrders.filter((o) => o.status === 'placed');
  const busy = accepting || rejecting;

  const handleBulkAccept = async () => {
    if (placedOrders.length === 0 || busy) return;
    setAccepting(true);

    const results = await Promise.allSettled(
      placedOrders.map((o) => api.artisanDashboard.acceptOrder(o._id))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed    = results.filter((r) => r.status === 'rejected').length;

    setAccepting(false);
    toast({
      title: `Accepted ${succeeded} order${succeeded !== 1 ? 's' : ''}`,
      description: failed > 0
        ? `${failed} could not be accepted — retry them individually.`
        : 'All selected placed orders have been confirmed.',
    });
    onClear();
    onActioned();
  };

  const handleBulkReject = async () => {
    if (placedOrders.length === 0 || busy) return;
    setRejecting(true);

    const results = await Promise.allSettled(
      placedOrders.map((o) =>
        api.artisanDashboard.rejectOrder(o._id, 'Bulk rejected by artisan')
      )
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed    = results.filter((r) => r.status === 'rejected').length;

    setRejecting(false);
    toast({
      title: `Rejected ${succeeded} order${succeeded !== 1 ? 's' : ''}`,
      description: failed > 0 ? `${failed} could not be rejected — retry them individually.` : undefined,
      variant: 'destructive',
    });
    onClear();
    onActioned();
  };

  if (selectedOrders.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
      {/* Count badge */}
      <Badge className="bg-blue-600 text-white shrink-0">
        {selectedOrders.length} selected
      </Badge>

      {/* Context text */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300">
        {placedOrders.length > 0 ? (
          <>
            <Info className="w-3 h-3 shrink-0" />
            <span>{placedOrders.length} can be actioned</span>
          </>
        ) : (
          <>
            <Info className="w-3 h-3 shrink-0" />
            <span>No selected orders are actionable (must be in 'Placed' status)</span>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {placedOrders.length > 0 && (
          <>
            <Button
              size="sm"
              className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
              disabled={busy}
              onClick={handleBulkAccept}
            >
              {accepting
                ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Accept {placedOrders.length}
            </Button>

            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-3 text-xs"
              disabled={busy}
              onClick={handleBulkReject}
            >
              {rejecting
                ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                : <Ban className="w-3 h-3 mr-1" />}
              Reject {placedOrders.length}
            </Button>
          </>
        )}

        {/* Clear selection */}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-blue-700"
          title="Clear selection"
          onClick={onClear}
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
