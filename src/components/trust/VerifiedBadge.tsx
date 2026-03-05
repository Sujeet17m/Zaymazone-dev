// ── Module 11: Verified Badge ─────────────────────────────────────────────────
import React from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VerifiedBadgeProps {
  /** Whether the artisan is verified. If false, renders nothing by default. */
  verified: boolean;
  /** ISO date string or Date object when the artisan was verified */
  verifiedAt?: Date | string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Set false to suppress the hover tooltip (e.g. on small cards) */
  showTooltip?: boolean;
  /** Extra Tailwind classes applied to the icon */
  className?: string;
  /** If true, also render a text label next to the icon */
  showLabel?: boolean;
}

const SIZE_MAP: Record<NonNullable<VerifiedBadgeProps['size']>, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function VerifiedBadge({
  verified,
  verifiedAt,
  size = 'md',
  showTooltip = true,
  className = '',
  showLabel = false,
}: VerifiedBadgeProps) {
  if (!verified) return null;

  const verifiedDate = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const inner = (
    <span className="inline-flex items-center gap-1 cursor-default select-none">
      <ShieldCheck
        className={`${SIZE_MAP[size]} text-blue-500 flex-shrink-0 ${className}`}
        aria-label="Verified Artisan"
      />
      {showLabel && (
        <span className="text-xs font-medium text-blue-600">Verified</span>
      )}
    </span>
  );

  if (!showTooltip) return inner;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-center">
          <p className="font-semibold text-sm">Verified Artisan</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identity and business documents have been verified by Zaymazone.
          </p>
          {verifiedDate && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Verified on {verifiedDate}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
