// ── Module 8: Quick Actions Panel ────────────────────────────────────────────
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  ShoppingCart,
  BarChart3,
  Users,
  MessageSquare,
  UserCircle,
  Package,
  RefreshCw,
  FileText,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ── Action definition ─────────────────────────────────────────────────────────
interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  href: string;
  primary?: boolean;
  iconColor: string;
  iconBg: string;
}

const ACTIONS: QuickAction[] = [
  {
    label: 'Add Product',
    description: 'List a new item',
    icon: Plus,
    href: '/artisan/products/new',
    primary: true,
    iconColor: 'text-white',
    iconBg: 'bg-orange-600',
  },
  {
    label: 'Process Orders',
    description: 'Accept / reject',
    icon: ShoppingCart,
    href: '/artisan/orders',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  {
    label: 'Analytics',
    description: 'Sales insights',
    icon: BarChart3,
    href: '/artisan/analytics',
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
  },
  {
    label: 'Customers',
    description: 'Buyer details',
    icon: Users,
    href: '/artisan/customers',
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
  },
  {
    label: 'Messages',
    description: 'Inquiries',
    icon: MessageSquare,
    href: '/artisan/messages',
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50',
  },
  {
    label: 'My Products',
    description: 'Manage listings',
    icon: Package,
    href: '/artisan/products',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
  },
  {
    label: 'Reviews',
    description: 'Customer feedback',
    icon: FileText,
    href: '/artisan/reviews',
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-50',
  },
  {
    label: 'Profile',
    description: 'Shop settings',
    icon: UserCircle,
    href: '/artisan/profile',
    iconColor: 'text-gray-600',
    iconBg: 'bg-gray-100',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function QuickActionsPanel() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-500" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Primary action – full width */}
        <Link to={ACTIONS[0].href} className="block mb-3">
          <Button className="w-full bg-orange-600 hover:bg-orange-700 gap-2 h-10">
            <Plus className="w-4 h-4" />
            Add New Product
          </Button>
        </Link>

        {/* Secondary actions – 2-col grid */}
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.slice(1).map(({ label, description, icon: Icon, href, iconColor, iconBg }) => (
            <Link key={label} to={href}>
              <button className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left group">
                <div className={`w-7 h-7 rounded-md ${iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                  <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground leading-tight truncate">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight truncate">{description}</p>
                </div>
              </button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
