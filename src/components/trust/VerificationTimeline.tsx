// ── Module 11: Verification Timeline ─────────────────────────────────────────
import React from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  User,
  Building,
  Award,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface VerificationTimelineProps {
  approvalStatus: ApprovalStatus;
  /** ISO date string for account creation — shown as "Member since …" */
  createdAt?: string;
  className?: string;
}

// ── Step definitions per status ───────────────────────────────────────────────
type StepStatus = 'complete' | 'active' | 'pending' | 'rejected';

interface Step {
  id: number;
  icon: React.ElementType;
  title: string;
  description: string;
  status: StepStatus;
}

function buildSteps(approvalStatus: ApprovalStatus): Step[] {
  if (approvalStatus === 'approved') {
    return [
      {
        id: 1, icon: FileText, title: 'Application Submitted',
        description: 'Your registration and supporting documents were received.',
        status: 'complete',
      },
      {
        id: 2, icon: FileText, title: 'Documents Reviewed',
        description: 'Our compliance team reviewed your submitted documents.',
        status: 'complete',
      },
      {
        id: 3, icon: User, title: 'Identity Verified',
        description: 'Your identity documents have been confirmed.',
        status: 'complete',
      },
      {
        id: 4, icon: Building, title: 'Business Verified',
        description: 'Your business or seller registration has been validated.',
        status: 'complete',
      },
      {
        id: 5, icon: Award, title: 'Platform Certified',
        description: 'You are a fully verified Zaymazone artisan.',
        status: 'complete',
      },
    ];
  }

  if (approvalStatus === 'rejected') {
    return [
      {
        id: 1, icon: FileText, title: 'Application Submitted',
        description: 'Your registration and supporting documents were received.',
        status: 'complete',
      },
      {
        id: 2, icon: XCircle, title: 'Review Unsuccessful',
        description: 'Your application did not pass our verification requirements.',
        status: 'rejected',
      },
      {
        id: 3, icon: User, title: 'Identity Verification',
        description: 'Could not be completed due to the review outcome.',
        status: 'pending',
      },
      {
        id: 4, icon: Building, title: 'Business Verification',
        description: 'Pending resolution of the review outcome.',
        status: 'pending',
      },
      {
        id: 5, icon: Award, title: 'Platform Certification',
        description: 'Complete the above steps to receive your badge.',
        status: 'pending',
      },
    ];
  }

  // pending
  return [
    {
      id: 1, icon: FileText, title: 'Application Submitted',
      description: 'Your registration and supporting documents were received.',
      status: 'complete',
    },
    {
      id: 2, icon: Clock, title: 'Documents Under Review',
      description: 'Our team is currently reviewing your submitted documents.',
      status: 'active',
    },
    {
      id: 3, icon: User, title: 'Identity Verification',
      description: 'Will begin once document review is complete.',
      status: 'pending',
    },
    {
      id: 4, icon: Building, title: 'Business Verification',
      description: 'Confirms your business registration details.',
      status: 'pending',
    },
    {
      id: 5, icon: Award, title: 'Platform Certification',
      description: 'Final step — you will receive the verified badge after this.',
      status: 'pending',
    },
  ];
}

// ── Visual style map per step status ─────────────────────────────────────────
const STYLES: Record<StepStatus, {
  dot:  string;
  line: string;
  text: string;
}> = {
  complete: {
    dot:  'bg-green-500 border-green-500',
    line: 'bg-green-300',
    text: 'text-foreground',
  },
  active: {
    dot:  'bg-blue-500 border-blue-500 animate-pulse',
    line: 'bg-muted',
    text: 'text-blue-700 dark:text-blue-300 font-semibold',
  },
  pending: {
    dot:  'bg-background border-muted-foreground/30',
    line: 'bg-muted',
    text: 'text-muted-foreground/60',
  },
  rejected: {
    dot:  'bg-red-500 border-red-500',
    line: 'bg-muted',
    text: 'text-red-700 dark:text-red-400 font-semibold',
  },
};

const STATUS_BADGE: Record<ApprovalStatus, { label: string; className: string }> = {
  approved: {
    label: 'Verified',
    className: 'bg-green-100 text-green-800 border-green-300',
  },
  rejected: {
    label: 'Review Failed',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
  pending: {
    label: 'Under Review',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export function VerificationTimeline({
  approvalStatus,
  createdAt,
  className = '',
}: VerificationTimelineProps) {
  const steps  = buildSteps(approvalStatus);
  const badge  = STATUS_BADGE[approvalStatus];

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Verification Status
            </CardTitle>
            {createdAt && (
              <CardDescription className="mt-0.5 text-xs">
                Member since{' '}
                {new Date(createdAt).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                })}
              </CardDescription>
            )}
          </div>
          <Badge variant="outline" className={badge.className}>
            {badge.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-0">
        {/* ── Timeline ── */}
        <div>
          {steps.map((step, idx) => {
            const styles = STYLES[step.status];
            const isLast = idx === steps.length - 1;

            return (
              <div key={step.id} className="flex gap-3">
                {/* Column: dot + connector line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 ${styles.dot}`}
                  >
                    {step.status === 'complete' ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : step.status === 'rejected' ? (
                      <XCircle className="w-4 h-4 text-white" />
                    ) : (
                      <step.icon
                        className={`w-4 h-4 ${
                          step.status === 'active'
                            ? 'text-white'
                            : 'text-muted-foreground/40'
                        }`}
                      />
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 my-1 min-h-[1.5rem] ${styles.line}`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className={`pb-4 flex-1 ${isLast ? 'pb-0' : ''}`}>
                  <p className={`text-sm leading-tight ${styles.text}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Status-specific info banners ── */}
        {approvalStatus === 'rejected' && (
          <div className="mt-5 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              What to do next?
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1 leading-relaxed">
              Contact our support team to understand the specific reasons and
              resubmit your application with the required documents.
            </p>
          </div>
        )}

        {approvalStatus === 'pending' && (
          <div className="mt-5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Currently under review
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
              Reviews typically take 2–5 business days. We'll notify you once
              your verification is complete.
            </p>
          </div>
        )}

        {approvalStatus === 'approved' && (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Fully Verified ✓
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1 leading-relaxed">
              Your verified badge is displayed on your public profile and all
              product listings.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
