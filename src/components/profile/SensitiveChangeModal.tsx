// ── Module 10: Sensitive-Field Approval Modal ─────────────────────────────────
// Shows when the user changes a sensitive field (phone) before saving.
// Email changes are blocked entirely in the UI — only phone is "sensitive-but-allowed".
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Phone, CheckCircle2, AlertTriangle } from 'lucide-react';

export type SensitiveField = 'phone';

interface ChangeSummary {
  field:    SensitiveField;
  oldValue: string;
  newValue: string;
}

interface Props {
  open:     boolean;
  changes:  ChangeSummary[];
  onConfirm: () => void;
  onCancel:  () => void;
  saving?:   boolean;
}

const FIELD_META: Record<SensitiveField, { label: string; icon: React.ReactNode; risk: string }> = {
  phone: {
    label: 'Phone number',
    icon:  <Phone className="w-4 h-4" />,
    risk:  'Changing your phone number updates your contact details. You may receive a verification SMS.',
  },
};

export function SensitiveChangeModal({ open, changes, onConfirm, onCancel, saving }: Props) {
  if (changes.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Confirm sensitive changes
          </DialogTitle>
          <DialogDescription className="text-sm">
            The following fields require extra confirmation before being saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {changes.map(({ field, oldValue, newValue }) => {
            const meta = FIELD_META[field];
            return (
              <div key={field} className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                  {meta.icon}
                  {meta.label}
                  <Badge variant="outline" className="ml-auto text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                    Changed
                  </Badge>
                </div>

                {/* Old → New diff */}
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-10 shrink-0">From:</span>
                    <span className={`font-mono px-1.5 py-0.5 rounded bg-muted ${!oldValue ? 'italic text-muted-foreground' : ''}`}>
                      {oldValue || 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-10 shrink-0">To:</span>
                    <span className="font-mono px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300">
                      {newValue}
                    </span>
                  </div>
                </div>

                {/* Risk note */}
                <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {meta.risk}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info notice */}
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-600" />
          <span>
            Your other profile changes (name, address, bio) will be saved at the same time.
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={saving}
            className="min-w-24"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : 'Confirm & Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Inline "pending change" badge shown next to the phone field ───────────────
interface PendingBadgeProps {
  field: SensitiveField;
}

export function PendingChangeBadge({ field }: PendingBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="text-xs border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 gap-1"
    >
      <ShieldAlert className="w-3 h-3" />
      {field === 'phone' ? 'Will prompt confirmation' : 'Sensitive'}
    </Badge>
  );
}
