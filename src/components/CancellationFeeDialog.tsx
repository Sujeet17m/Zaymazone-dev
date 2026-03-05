/**
 * CancellationFeeDialog — Module 10: Order Cancellation & Fee UX
 *
 * Multi-step animated cancellation dialog with:
 *  • Step 1: Warning overview + tier badge + live grace countdown
 *  • Step 2: Visual refund calculator (fee > 0 only)
 *  • Step 3: Reason selector + confirm
 *  • Success state: animated confirmation + refund timeline
 */

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  Loader2,
  XCircle,
  Info,
  Clock,
  Timer,
  Shield,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { api, type CancellationFeePreview } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CancellationFeeDialogProps {
  orderId:     string;
  orderNumber: string;
  open:        boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the backend confirms the cancellation */
  onConfirmed: () => void;
}

// ── Constants & config ────────────────────────────────────────────────────────

const GRACE_WINDOW_MINUTES = 30;

const COMMON_REASONS = [
  'Changed my mind',
  'Found a better price elsewhere',
  'Ordered by mistake',
  'Delivery time is too long',
  'Item no longer needed',
  'Other',
];

const TIER_CONFIG: Record<CancellationFeePreview['tier'], {
  label: string;
  badgeClass: string;
  bannerClass: string;
}> = {
  grace:      { label: 'Grace Period',  badgeClass: 'bg-green-100 text-green-700 border-green-200',   bannerClass: 'bg-green-50 border-green-200'  },
  placed:     { label: 'Free Cancel',   badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',     bannerClass: 'bg-blue-50 border-blue-200'    },
  confirmed:  { label: 'Confirmed',     badgeClass: 'bg-orange-100 text-orange-700 border-orange-200', bannerClass: 'bg-orange-50 border-orange-200' },
  processing: { label: 'Processing',   badgeClass: 'bg-red-100 text-red-700 border-red-200',         bannerClass: 'bg-red-50 border-red-200'      },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatCountdown(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Framer Motion slide variants for step transitions
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ?  48 : -48, opacity: 0 }),
  center:              () => ({ x: 0,                  opacity: 1 }),
  exit:   (dir: number) => ({ x: dir < 0 ?  48 : -48, opacity: 0 }),
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CancellationFeeDialog({
  orderId,
  orderNumber,
  open,
  onOpenChange,
  onConfirmed,
}: CancellationFeeDialogProps) {
  // Which step is visible: 1 = overview, 2 = breakdown, 3 = reason/confirm
  const [step,         setStep]         = useState<1 | 2 | 3>(1);
  const [direction,    setDirection]    = useState(1);           // +1 = forward, -1 = back

  const [preview,      setPreview]      = useState<CancellationFeePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Reason picker
  const [reason,       setReason]       = useState('');
  const [customReason, setCustomReason] = useState('');

  // Submission
  const [confirming,   setConfirming]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  // Post-cancel success state (replaces dialog body)
  const [success,      setSuccess]      = useState<{ refundAmount: number; isCod: boolean } | null>(null);

  // Live grace-window countdown (seconds remaining)
  const [countdown,    setCountdown]    = useState<number | null>(null);
  // Ref for the countdown bar — CSS custom property set without inline style
  const countdownBarRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (countdownBarRef.current && countdown !== null) {
      countdownBarRef.current.style.setProperty(
        '--countdown-pct',
        `${(countdown / (GRACE_WINDOW_MINUTES * 60)) * 100}%`
      );
    }
  }, [countdown]);

  // ── Reset & fetch on open ───────────────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const data = await api.getCancellationPreview(orderId);
      setPreview(data);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load cancellation details');
    } finally {
      setLoadingPreview(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!open) { setCountdown(null); return; }
    // Reset everything on each open
    setStep(1);
    setDirection(1);
    setPreview(null);
    setPreviewError(null);
    setReason('');
    setCustomReason('');
    setError(null);
    setSuccess(null);
    setCountdown(null);
    fetchPreview();
  }, [open, orderId, fetchPreview]);

  // ── Grace countdown timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!preview?.isWithinGrace) return;
    const remaining = Math.max(0, Math.round(
      (GRACE_WINDOW_MINUTES - preview.minutesSincePlaced) * 60
    ));
    setCountdown(remaining);
    if (remaining <= 0) return;

    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [preview]);

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const goTo = (next: 1 | 2 | 3) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const backFromStep3 = () => goTo(preview?.cancellationFee === 0 ? 1 : 2);

  // ── Confirm cancellation ────────────────────────────────────────────────────
  const handleConfirm = async () => {
    const finalReason = reason === 'Other' ? customReason.trim() : reason;
    setError(null);
    setConfirming(true);
    try {
      await api.cancelOrder(orderId, finalReason || undefined);
      setSuccess({
        refundAmount: preview?.refundableAmount ?? 0,
        isCod:        preview?.isCod ?? false,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setConfirming(false);
    }
  };

  // ── Step progress indicator ─────────────────────────────────────────────────
  const isFreeFlow = preview?.cancellationFee === 0;  // skip step 2 when no fee
  const totalSteps = isFreeFlow ? 2 : 3;
  const visualStep = isFreeFlow
    ? (step === 1 ? 1 : 2)
    : step;

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Calculating cancellation terms…</p>
    </div>
  );

  const renderFetchError = () => (
    <div className="py-6 space-y-4">
      <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        {previewError}
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        <Button onClick={fetchPreview}>Retry</Button>
      </div>
    </div>
  );

  // ── Success screen ──────────────────────────────────────────────────────────
  const renderSuccess = () => (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1,    opacity: 1 }}
      className="flex flex-col items-center text-center py-6 gap-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.08 }}
        className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center"
      >
        <CheckCircle2 className="w-8 h-8 text-green-600" />
      </motion.div>

      <div>
        <h3 className="text-lg font-semibold text-foreground">Order Cancelled</h3>
        <p className="text-sm text-muted-foreground mt-1">Order #{orderNumber} has been cancelled.</p>
      </div>

      {success && !success.isCod && success.refundAmount > 0 && (
        <div className="w-full bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700 font-medium mb-1">Refund Initiated</p>
          <p className="text-2xl font-bold text-green-800">{fmt(success.refundAmount)}</p>
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1 justify-center">
            <Clock className="w-3.5 h-3.5" />
            Expected in 5–7 business days
          </p>
        </div>
      )}

      {success?.isCod && (
        <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          Cash on Delivery — no payment was collected so no refund is needed.
        </div>
      )}

      <Button className="w-full mt-1" onClick={() => { onOpenChange(false); onConfirmed(); }}>
        Done
      </Button>
    </motion.div>
  );

  // ── Step 1: Overview ────────────────────────────────────────────────────────
  const renderStep1 = () => {
    if (!preview) return null;
    const tc     = TIER_CONFIG[preview.tier] ?? TIER_CONFIG.placed;
    const isFree = preview.cancellationFee === 0;

    return (
      <div className="space-y-4">
        {/* Tier banner */}
        <div className={`rounded-lg border p-4 ${tc.bannerClass}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {preview.isWithinGrace
                ? <Timer  className="w-5 h-5 text-green-600" />
                : isFree
                  ? <Shield className="w-5 h-5 text-blue-600" />
                  : <AlertTriangle className="w-5 h-5 text-orange-500" />
              }
              <span className="font-semibold text-sm">{preview.ruleLabel}</span>
            </div>
            <Badge className={tc.badgeClass}>{tc.label}</Badge>
          </div>

          {/* Live countdown bar */}
          {preview.isWithinGrace && countdown !== null && countdown > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-green-200 rounded-full h-1.5">
                <div
                  ref={countdownBarRef}
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-1000 bar-countdown-dynamic"
                />
              </div>
              <span className="text-xs font-mono text-green-700 tabular-nums shrink-0">
                {formatCountdown(countdown)} left
              </span>
            </div>
          )}
        </div>

        {/* Amount summary card */}
        <div className="bg-muted/40 rounded-lg p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Order</span>
            <span className="font-medium">#{orderNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Order Total</span>
            <span className="font-medium">{fmt(preview.totalPaid)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Cancellation Fee</span>
            <span className={`font-semibold ${preview.cancellationFee > 0 ? 'text-destructive' : 'text-green-600'}`}>
              {preview.cancellationFee > 0 ? `−${fmt(preview.cancellationFee)}` : 'Free'}
            </span>
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>You'll Receive</span>
            {preview.isCod
              ? <span className="text-muted-foreground text-xs font-normal">No refund (COD)</span>
              : <span className="text-base">{fmt(preview.refundableAmount)}</span>
            }
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Keep Order
          </Button>
          {isFree ? (
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => goTo(3)}
            >
              Cancel for Free
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button variant="destructive" className="flex-1" onClick={() => goTo(2)}>
              See Breakdown
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  // ── Step 2: Fee breakdown (shown only when fee > 0) ─────────────────────────
  const renderStep2 = () => {
    if (!preview) return null;
    const feeLabel = preview.tier === 'confirmed'
      ? `min ₹25 / max ₹250`
      : `min ₹50 / max ₹500`;

    return (
      <div className="space-y-4">
        <button
          onClick={() => goTo(1)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Summary
        </button>

        {/* Visual refund calculator */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Refund Calculation</p>

          {/* Paid */}
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
            <IndianRupee className="w-4 h-4 text-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Amount Paid</p>
              <p className="font-bold text-lg">{fmt(preview.totalPaid)}</p>
            </div>
          </div>

          <div className="text-center text-lg font-bold text-muted-foreground leading-none">−</div>

          {/* Fee */}
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <div>
              <p className="text-xs text-red-600">
                Cancellation Fee ({(preview.feePercent * 100).toFixed(0)}%
                {preview.cancellationFee !== preview.grossFee && (
                  <span className="ml-1 text-red-400 text-[10px]">{feeLabel}</span>
                )})
              </p>
              <p className="font-bold text-lg text-red-700">{fmt(preview.cancellationFee)}</p>
            </div>
          </div>

          <div className="text-center text-lg font-bold text-muted-foreground leading-none">=</div>

          {/* Refund */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1,    opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <div>
              <p className="text-xs text-green-700 font-medium">You'll Receive</p>
              <p className="font-bold text-xl text-green-700">
                {preview.isCod ? 'No Refund (COD)' : fmt(preview.refundableAmount)}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Policy note */}
        <div className="flex gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {preview.isCod
            ? 'This is a Cash on Delivery order. Since no payment was collected, no refund will be issued.'
            : 'Refund will be credited to your original payment method within 5–7 business days.'}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Keep Order
          </Button>
          <Button variant="destructive" className="flex-1" onClick={() => goTo(3)}>
            Proceed to Cancel
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  // ── Step 3: Reason + confirm ────────────────────────────────────────────────
  const renderStep3 = () => {
    if (!preview) return null;
    const canConfirm = !!reason && (reason !== 'Other' || customReason.trim().length >= 5);

    return (
      <div className="space-y-4">
        <button
          onClick={backFromStep3}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        {/* Final refund summary strip */}
        <div className="rounded-lg bg-muted/40 border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Refund on Cancellation</p>
            <p className="text-lg font-bold">
              {preview.isCod ? 'No Refund (COD)' : fmt(preview.refundableAmount)}
            </p>
          </div>
          {preview.cancellationFee > 0
            ? <Badge className="bg-red-100 text-red-800">{fmt(preview.cancellationFee)} fee</Badge>
            : <Badge className="bg-green-100 text-green-800">Free</Badge>
          }
        </div>

        {/* Quick-pick reasons */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Why are you cancelling?</p>
          <div className="grid grid-cols-2 gap-2">
            {COMMON_REASONS.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                  reason === r
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-muted bg-muted/30 text-muted-foreground hover:border-muted-foreground/40'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {reason === 'Other' && (
            <Textarea
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              placeholder="Please describe your reason (minimum 5 characters)…"
              className="mt-2 text-sm resize-none"
              rows={3}
              maxLength={300}
            />
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Keep Order
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleConfirm}
            disabled={confirming || !canConfirm}
          >
            {confirming
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</>
              : 'Confirm Cancellation'
            }
          </Button>
        </div>
      </div>
    );
  };

  // ── Dialog shell ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {success
              ? <><CheckCircle2 className="w-5 h-5 text-green-600" /> Cancellation Confirmed</>
              : <><XCircle className="w-5 h-5 text-destructive" /> Cancel Order #{orderNumber}</>
            }
          </DialogTitle>
          <DialogDescription className="sr-only">
            {success
              ? 'Your order has been successfully cancelled.'
              : 'Review the cancellation fee and confirm your cancellation.'}
          </DialogDescription>

          {/* Step progress dots — hidden during loading/error/success */}
          {!success && !loadingPreview && !previewError && preview && (
            <div className="flex items-center gap-1 mt-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    s === visualStep
                      ? 'bg-primary flex-[2]'
                      : s < visualStep
                        ? 'bg-primary/40 flex-1'
                        : 'bg-muted flex-1'
                  }`}
                />
              ))}
            </div>
          )}
        </DialogHeader>

        {/* ── Content area ── */}
        {success ? (
          renderSuccess()
        ) : loadingPreview ? (
          renderLoading()
        ) : previewError ? (
          renderFetchError()
        ) : preview ? (
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
