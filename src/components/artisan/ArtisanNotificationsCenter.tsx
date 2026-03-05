// ── Module 8: Artisan Notifications Center ───────────────────────────────────
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Clock,
  Package,
  AlertTriangle,
  CheckCircle2,
  ShoppingCart,
  TrendingDown,
  Info,
  X,
  BellOff,
} from 'lucide-react';
import type { Order } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface LowStockItem {
  _id: string;
  name: string;
  stock: number;
  price: number;
  images?: string[];
}

interface SystemNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
  read?: boolean;
}

export interface ArtisanNotificationsCenterProps {
  pendingOrders: Order[];
  lowStockProducts: LowStockItem[];
  /** Called when user clicks "View Orders" inside the center */
  onViewOrders?: () => void;
  /** Called when user clicks "View Products" inside the center */
  onViewProducts?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const fmtTime = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ── Static system notifications (augmented by real data where possible) ───────
const STATIC_SYSTEM: SystemNotification[] = [
  {
    id: 'sys-1',
    type: 'info',
    title: 'Dashboard Updated',
    message: 'Your dashboard now includes real-time analytics and live order tracking.',
    time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sys-2',
    type: 'success',
    title: 'Profile Verified',
    message: 'Your artisan profile has been verified. Customers can now see your badge.',
    time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sys-3',
    type: 'info',
    title: 'New Feature: UPI Payments',
    message: 'You can now accept UPI prepaid orders. Ensure your UPI ID is set in your profile.',
    time: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ── Notification type chip helper ─────────────────────────────────────────────
function TypeIcon({ type }: { type: 'info' | 'success' | 'warning' | 'error' }) {
  const map = {
    info:    { icon: Info,          cls: 'text-blue-600 bg-blue-50'  },
    success: { icon: CheckCircle2,  cls: 'text-green-600 bg-green-50' },
    warning: { icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' },
    error:   { icon: AlertTriangle, cls: 'text-red-600 bg-red-50'    },
  };
  const { icon: Icon, cls } = map[type];
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ArtisanNotificationsCenter({
  pendingOrders,
  lowStockProducts,
  onViewOrders,
  onViewProducts,
}: ArtisanNotificationsCenterProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('orders');

  const dismiss = (id: string) =>
    setDismissedIds((prev) => new Set([...prev, id]));

  const dismissAll = () => {
    const allIds = [
      ...pendingOrders.map((o) => o._id),
      ...lowStockProducts.map((p) => p._id),
      ...STATIC_SYSTEM.map((n) => n.id),
    ];
    setDismissedIds(new Set(allIds));
  };

  const visiblePending   = pendingOrders.filter((o) => !dismissedIds.has(o._id));
  const visibleLowStock  = lowStockProducts.filter((p) => !dismissedIds.has(p._id));
  const visibleSystem    = STATIC_SYSTEM.filter((n) => !dismissedIds.has(n.id));
  const totalUnread      = visiblePending.length + visibleLowStock.length + visibleSystem.length;

  return (
    <Card className="shadow-sm flex flex-col">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-orange-500" />
            Notifications
            {totalUnread > 0 && (
              <Badge className="bg-orange-600 text-white text-[10px] px-1.5 h-4 flex items-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </CardTitle>
          {totalUnread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={dismissAll}
            >
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-3 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-8 mx-2 mb-2" style={{ width: 'calc(100% - 16px)' }}>
            <TabsTrigger value="orders" className="flex-1 text-xs h-7 relative">
              Orders
              {visiblePending.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold rounded-full bg-amber-500 text-white leading-none">
                  {visiblePending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex-1 text-xs h-7">
              Stock
              {visibleLowStock.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold rounded-full bg-red-500 text-white leading-none">
                  {visibleLowStock.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="system" className="flex-1 text-xs h-7">
              System
              {visibleSystem.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold rounded-full bg-blue-500 text-white leading-none">
                  {visibleSystem.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Orders tab ────────────────────────────────────────────── */}
          <TabsContent value="orders" className="mt-0 px-2">
            <ScrollArea className="h-[220px] pr-2">
              {visiblePending.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[180px] text-center">
                  <BellOff className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No pending orders</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    You're all caught up!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visiblePending.map((order) => (
                    <div
                      key={order._id}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-200 group"
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-900 leading-tight">
                          #{order.orderNumber}
                        </p>
                        <p className="text-[11px] text-amber-700 truncate mt-0.5">
                          {order.items
                            ?.slice(0, 2)
                            .map((i) => i.name || 'Item')
                            .join(', ')}
                          {(order.items?.length ?? 0) > 2 && ` +${(order.items?.length ?? 0) - 2}`}
                        </p>
                        <p className="text-[11px] font-semibold text-amber-800 mt-0.5">
                          {fmt(order.total)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => dismiss(order._id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            {visiblePending.length > 0 && onViewOrders && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
                onClick={onViewOrders}
              >
                <ShoppingCart className="w-3 h-3 mr-1.5" />
                Review {visiblePending.length} Order{visiblePending.length > 1 ? 's' : ''}
              </Button>
            )}
          </TabsContent>

          {/* ── Stock tab ─────────────────────────────────────────────── */}
          <TabsContent value="stock" className="mt-0 px-2">
            <ScrollArea className="h-[220px] pr-2">
              {visibleLowStock.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[180px] text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400/60 mb-2" />
                  <p className="text-xs text-muted-foreground">All stock levels OK</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    No restocking needed
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleLowStock.map((product) => (
                    <div
                      key={product._id}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg bg-red-50 border border-red-200 group"
                    >
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-8 h-8 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-red-100 flex items-center justify-center shrink-0">
                          <Package className="w-3.5 h-3.5 text-red-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate leading-tight">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{fmt(product.price)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 px-1.5 ${
                            product.stock === 0
                              ? 'border-red-400 bg-red-100 text-red-700'
                              : 'border-amber-300 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {product.stock === 0 ? 'Out' : `${product.stock} left`}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => dismiss(product._id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            {visibleLowStock.length > 0 && onViewProducts && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 h-7 text-xs"
                onClick={onViewProducts}
              >
                <TrendingDown className="w-3 h-3 mr-1.5 text-red-500" />
                Restock {visibleLowStock.length} Product{visibleLowStock.length > 1 ? 's' : ''}
              </Button>
            )}
          </TabsContent>

          {/* ── System tab ────────────────────────────────────────────── */}
          <TabsContent value="system" className="mt-0 px-2">
            <ScrollArea className="h-[220px] pr-2">
              {visibleSystem.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[180px] text-center">
                  <BellOff className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">No system notifications</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleSystem.map((notif) => (
                    <div
                      key={notif.id}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors group"
                    >
                      <TypeIcon type={notif.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-tight">
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {fmtTime(notif.time)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                        onClick={() => dismiss(notif.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
