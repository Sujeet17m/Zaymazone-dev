// ── Module 10: Profile Completion Progress Indicator ─────────────────────────
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProfileData {
  name:    string;
  phone:   string;
  avatar:  string;
  street:  string;
  city:    string;
  state:   string;
  zipCode: string;
  bio:     string;
}

interface FieldDef {
  key:    keyof ProfileData;
  label:  string;
  weight: number;   // contribution to total 100
  hint:   string;
}

const FIELD_DEFS: FieldDef[] = [
  { key: 'name',    label: 'Full name',          weight: 20, hint: 'Tell us your name' },
  { key: 'phone',   label: 'Phone number',        weight: 15, hint: 'Add a contact number' },
  { key: 'avatar',  label: 'Profile photo',       weight: 15, hint: 'Upload a profile picture' },
  { key: 'bio',     label: 'About me',            weight: 15, hint: 'Write a short bio' },
  { key: 'street',  label: 'Street address',      weight: 10, hint: 'Add your street address' },
  { key: 'city',    label: 'City',                weight: 10, hint: 'Add your city' },
  { key: 'state',   label: 'State / Province',    weight: 10, hint: 'Add your state' },
  { key: 'zipCode', label: 'ZIP / PIN code',      weight:  5, hint: 'Enter your postal code' },
];

function computeCompletion(data: ProfileData): {
  score:    number;   // 0–100
  done:     FieldDef[];
  missing:  FieldDef[];
} {
  let score = 0;
  const done: FieldDef[] = [];
  const missing: FieldDef[] = [];

  for (const f of FIELD_DEFS) {
    const val = (data[f.key] || '').trim();
    if (val) {
      score += f.weight;
      done.push(f);
    } else {
      missing.push(f);
    }
  }

  return { score: Math.min(score, 100), done, missing };
}

// ── Circular SVG ring ────────────────────────────────────────────────────────
function CompletionRing({ pct, size = 72 }: { pct: number; size?: number }) {
  const r      = (size - 8) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color  = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={7} />
      {/* Fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className="[transition:stroke-dashoffset_0.6s_ease]"
      />
    </svg>
  );
}

// ── Linear bar variant (used inline) ─────────────────────────────────────────
export function ProfileCompletionLinear({ data }: { data: ProfileData }) {
  const { score } = computeCompletion(data);
  const colorClass =
    score >= 80 ? '[&>*]:bg-green-500'
    : score >= 50 ? '[&>*]:bg-amber-500'
    : '[&>*]:bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Profile completion</span>
        <span className="font-medium">{score}%</span>
      </div>
      <Progress value={score} className={cn('h-1.5', colorClass)} />
    </div>
  );
}

// ── Full card used in sidebar ─────────────────────────────────────────────────
interface Props {
  data:        ProfileData;
  onEditClick?: () => void;
}

export function ProfileCompletionBar({ data, onEditClick }: Props) {
  const { score, missing } = computeCompletion(data);

  const label =
    score === 100 ? 'Complete!'
    : score >= 80 ? 'Almost there'
    : score >= 50 ? 'Getting started'
    : 'Needs attention';

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          {/* Ring */}
          <div className="relative shrink-0">
            <CompletionRing pct={score} />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {score}%
            </span>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-foreground">Profile completion</p>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs border-0',
                  score === 100 && 'bg-green-100 text-green-700',
                  score >= 80 && score < 100 && 'bg-amber-100 text-amber-700',
                  score < 80 && 'bg-red-100 text-red-700',
                )}
              >
                {label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {missing.length === 0
                ? 'All fields filled — great work!'
                : `${missing.length} field${missing.length !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
        </div>

        {/* Missing field list */}
        {missing.length > 0 && (
          <div className="mt-3 space-y-1">
            {missing.slice(0, 4).map((f) => (
              <button
                key={f.key}
                onClick={onEditClick}
                className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group rounded-md px-1 py-0.5 hover:bg-muted"
              >
                <Circle className="w-3 h-3 shrink-0 text-muted-foreground/60 group-hover:text-amber-500" />
                <span className="flex-1 text-left">{f.hint}</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
            {missing.length > 4 && (
              <p className="text-xs text-muted-foreground pl-5">+ {missing.length - 4} more…</p>
            )}
          </div>
        )}

        {/* Done items preview */}
        {score === 100 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Profile fully completed — you're all set!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
