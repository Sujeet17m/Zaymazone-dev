// ── Module 11: Trust Indicators ───────────────────────────────────────────────
import React from 'react';
import {
  Star,
  ShieldCheck,
  Package,
  TrendingUp,
  Award,
  BadgeCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Artisan } from '@/lib/api';

interface TrustIndicatorsProps {
  artisan: Artisan;
  className?: string;
}

/** Derive a composite trust score (0–100) from artisan data */
function computeTrustScore(artisan: Artisan): number {
  const verificationPts = artisan.verification.isVerified ? 30 : 0;
  const ratingPts       = Math.min(30, artisan.rating * 6);           // 5★ → 30
  const reviewPts       = Math.min(20, artisan.totalRatings * 0.4);   // 50 reviews → 20
  const salesPts        = Math.min(20, artisan.totalSales * 0.2);     // 100 sales → 20
  return Math.min(100, Math.round(verificationPts + ratingPts + reviewPts + salesPts));
}

type TrustLevel = { label: string; color: string; bg: string };

function trustLevel(score: number): TrustLevel {
  if (score >= 85) return { label: 'Platinum',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'   };
  if (score >= 70) return { label: 'Gold',       color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' };
  if (score >= 50) return { label: 'Silver',     color: 'text-gray-700',   bg: 'bg-gray-100 border-gray-200'  };
  return              { label: 'Bronze',     color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
}

// ── Sub-component: single indicator row ──────────────────────────────────────
interface TrustRowProps {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: string;
  positive: boolean;
}

function TrustRow({ icon: Icon, iconColor, label, value, positive }: TrustRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          positive ? 'bg-muted' : 'bg-muted/50'
        }`}
      >
        <Icon
          className={`w-3.5 h-3.5 ${positive ? iconColor : 'text-muted-foreground/40'}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${positive ? '' : 'text-muted-foreground'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function TrustIndicators({ artisan, className = '' }: TrustIndicatorsProps) {
  const score  = computeTrustScore(artisan);
  const level  = trustLevel(score);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          Trust &amp; Credibility
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Trust score bar ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Trust Score</span>
            <Badge
              variant="outline"
              className={`${level.color} ${level.bg} text-xs font-semibold`}
            >
              {level.label}
            </Badge>
          </div>
          <Progress value={score} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{score} / 100</p>
        </div>

        {/* ── Indicator rows ── */}
        <div className="space-y-3">
          <TrustRow
            icon={ShieldCheck}
            iconColor="text-blue-500"
            label="Identity Verified"
            value={artisan.verification.isVerified ? 'Documents verified' : 'Verification pending'}
            positive={artisan.verification.isVerified}
          />
          <TrustRow
            icon={Star}
            iconColor="text-yellow-500"
            label="Average Rating"
            value={`${artisan.rating.toFixed(1)} / 5 (${artisan.totalRatings} reviews)`}
            positive={artisan.rating >= 4}
          />
          <TrustRow
            icon={TrendingUp}
            iconColor="text-green-600"
            label="Total Sales"
            value={artisan.totalSales > 0 ? `${artisan.totalSales} orders fulfilled` : 'New seller'}
            positive={artisan.totalSales > 0}
          />
          <TrustRow
            icon={Package}
            iconColor="text-purple-600"
            label="Active Listings"
            value={`${artisan.totalProducts} product${artisan.totalProducts !== 1 ? 's' : ''}`}
            positive={artisan.totalProducts > 0}
          />
          <TrustRow
            icon={BadgeCheck}
            iconColor="text-primary"
            label="Experience"
            value={artisan.experience > 0 ? `${artisan.experience}+ years` : 'Not specified'}
            positive={artisan.experience > 0}
          />
        </div>

        {/* ── Verified purchase note ── */}
        {artisan.verification.isVerified && artisan.verification.verifiedAt && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            Verified on{' '}
            {new Date(artisan.verification.verifiedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
