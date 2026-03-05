import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  MapPin,
  CreditCard,
  Eye,
  RefreshCw,
  Loader2,
  Calendar,
  IndianRupee,
  FileText,
  Ban,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Bell,
  AlertTriangle,
  CheckCircle2,
  PackageX,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { PaymentMethodBadge } from "@/components/PaymentMethodBadge";
import { CancellationFeeDialog } from "@/components/CancellationFeeDialog";
import type { Order } from "@/lib/api";

export default function Orders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [expandedTimelines, setExpandedTimelines] = useState<Set<string>>(new Set());
  // Module 5: Cancellation fee dialog state
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    orderId: string;
    orderNumber: string;
  }>({ open: false, orderId: '', orderNumber: '' });
  const [rejectedAlertDismissed, setRejectedAlertDismissed] = useState<Set<string>>(() => {
    // Persist dismissed rejection alerts across renders using sessionStorage
    try {
      const saved = sessionStorage.getItem('dismissedRejectionAlerts');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: "Please sign in",
        description: "You need to sign in to view your orders",
        variant: "destructive"
      });
      navigate('/sign-in');
    }
  }, [isAuthenticated, navigate, toast]);

  const fetchOrders = async (page = 1) => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const response = await api.getUserOrders({ page, limit: pagination.limit });
      setOrders(response.orders);
      setPagination(response.pagination);

      // Module 9: Show toast alert for any newly-rejected orders not yet dismissed
      response.orders
        .filter(o => o.status === 'rejected' && !rejectedAlertDismissed.has(o._id || o.id))
        .forEach(o => {
          toast({
            title: '⚠️ Order Rejected',
            description: `Order ${o.orderNumber} was rejected by the seller.${
              o.rejectionReason ? ` Reason: ${o.rejectionReason}` : ''
            }`,
            variant: 'destructive',
          });
        });
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error loading orders",
        description: "Please try again later",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [isAuthenticated]);

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'placed':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Package className="w-4 h-4 text-orange-500" />;
      case 'packed':
        return <Package className="w-4 h-4 text-orange-600" />;
      case 'shipped':
        return <Truck className="w-4 h-4 text-blue-600" />;
      case 'out_for_delivery':
        return <MapPin className="w-4 h-4 text-purple-500" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'rejected':
        return <Ban className="w-4 h-4 text-red-600" />;
      case 'returned':
        return <RefreshCw className="w-4 h-4 text-yellow-500" />;
      case 'refunded':
        return <IndianRupee className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'placed':
        return 'bg-blue-100 text-blue-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'processing':
      case 'packed':
        return 'bg-orange-100 text-orange-800';
      case 'shipped':
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'rejected':
        return 'bg-red-100 text-red-900 ring-1 ring-red-300';
      case 'returned':
        return 'bg-yellow-100 text-yellow-800';
      case 'refunded':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: Order['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true;
    if (activeTab === 'active') return !['delivered', 'cancelled', 'returned', 'refunded', 'rejected'].includes(order.status);
    if (activeTab === 'delivered') return order.status === 'delivered';
    if (activeTab === 'cancelled') return ['cancelled', 'returned', 'refunded', 'rejected'].includes(order.status);
    return true;
  });

  // Module 9: count undismissed rejected orders for tab badge
  const rejectedCount = orders.filter(
    o => o.status === 'rejected' && !rejectedAlertDismissed.has(o._id || o.id)
  ).length;

  const toggleTimeline = (orderId: string) => {
    setExpandedTimelines(prev => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  };

  const dismissRejectionAlert = (orderId: string) => {
    setRejectedAlertDismissed(prev => {
      const next = new Set(prev);
      next.add(orderId);
      try {
        sessionStorage.setItem('dismissedRejectionAlerts', JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/order/${orderId}/invoice`);
  };

  // Module 5: open the cancellation-fee dialog instead of cancelling immediately
  const handleCancelOrder = (orderId: string) => {
    const order = orders.find(o => (o.id || o._id) === orderId);
    setCancelDialog({
      open: true,
      orderId,
      orderNumber: order?.orderNumber || orderId,
    });
  };

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">My Orders</h1>
            <p className="text-muted-foreground">Track and manage your orders</p>
          </div>

          {/* Module 9: Global rejection notification banner */}
          {rejectedCount > 0 && (
            <Alert className="mb-6 border-red-300 bg-red-50 dark:bg-red-950/30">
              <Bell className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-700 font-semibold">
                {rejectedCount} order{rejectedCount > 1 ? 's were' : ' was'} rejected by the seller
              </AlertTitle>
              <AlertDescription className="text-red-600">
                The seller could not fulfil {rejectedCount > 1 ? 'these orders' : 'this order'}. If you paid online, a full refund will be initiated within 5–7 business days. Check the "Cancelled" tab for details.
              </AlertDescription>
            </Alert>
          )}

          {/* Order Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All Orders</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="delivered">Delivered</TabsTrigger>
              <TabsTrigger value="cancelled" className="relative">
                Cancelled
                {rejectedCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-red-500 text-white">
                    {rejectedCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Package className="w-16 h-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">No orders found</h3>
                    <p className="text-muted-foreground text-center mb-6">
                      {activeTab === 'all'
                        ? "You haven't placed any orders yet"
                        : `No ${activeTab} orders found`
                      }
                    </p>
                    <Button onClick={() => navigate('/shop')}>
                      Start Shopping
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <Card key={order.id || order._id} className={order.status === 'rejected' ? 'border-red-200 ring-1 ring-red-200' : ''}>
                      <CardHeader className="pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              Order #{order.orderNumber}
                              {getStatusIcon(order.status)}
                            </CardTitle>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(order.createdAt).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1">
                                <Package className="w-4 h-4" />
                                {order.items.length} item{order.items.length > 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-foreground">
                              ₹{order.total.toLocaleString()}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Badge className={getStatusColor(order.status)}>
                                {order.status.replace(/_/g, ' ')}
                              </Badge>
                              <Badge className={getPaymentStatusColor(order.paymentStatus)}>
                                {order.paymentStatus}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent>
                        {/* Order Items */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                          {order.items.slice(0, 3).map((item, index) => (
                            <div key={index} className="flex gap-3">
                              <img
                                src={item.image || "/placeholder.svg"}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded-md"
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{item.name}</h4>
                                <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                <p className="text-sm font-medium">₹{item.price.toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <div className="flex items-center justify-center bg-muted rounded-md">
                              <span className="text-sm text-muted-foreground">
                                +{order.items.length - 3} more
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Module 9: Rejection alert banner */}
                        {order.status === 'rejected' && !rejectedAlertDismissed.has(order._id || order.id) && (
                          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1">
                                <PackageX className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="font-semibold text-red-700 text-sm mb-1">Order Rejected by Seller</p>
                                  {order.rejectionReason ? (
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-red-600">Reason provided:</p>
                                      <p className="text-sm text-red-600 italic bg-red-100 dark:bg-red-900/40 px-3 py-2 rounded">&#8220;{order.rejectionReason}&#8221;</p>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-red-600">No reason was provided by the seller.</p>
                                  )}
                                  {order.rejectedAt && (
                                    <p className="text-xs text-red-400 mt-1.5">
                                      Rejected on {new Date(order.rejectedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                  <p className="text-xs text-red-500 mt-2">
                                    ℹ️ If you paid online, a full refund will be processed within 5–7 business days.
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => dismissRejectionAlert(order._id || order.id)}
                                className="text-red-400 hover:text-red-600 text-xs shrink-0 mt-0.5"
                                aria-label="Dismiss"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Module 9: show summarised rejection even after alert is dismissed */}
                        {order.status === 'rejected' && rejectedAlertDismissed.has(order._id || order.id) && (
                          <div className="mb-4 flex items-center gap-2 text-xs text-red-500 bg-red-50 border border-red-200 px-3 py-2 rounded-md">
                            <Ban className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>This order was rejected by the seller.{order.rejectionReason ? ` Reason: ${order.rejectionReason}` : ''}</span>
                          </div>
                        )}

                        <Separator className="my-4" />

                        {/* Order Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-muted-foreground mb-1">Payment Method</div>
                            <PaymentMethodBadge method={order.paymentMethod as any} />
                          </div>
                          <div>
                            <div className="font-medium text-muted-foreground mb-1">Shipping Address</div>
                            <div className="flex items-start gap-1">
                              <MapPin className="w-4 h-4 mt-0.5" />
                              <div>
                                {order.shippingAddress.fullName}<br />
                                {order.shippingAddress.city}, {order.shippingAddress.state}
                              </div>
                            </div>
                          </div>
                          {order.trackingNumber && (
                            <div>
                              <div className="font-medium text-muted-foreground mb-1">Tracking</div>
                              <div className="flex items-center gap-1">
                                <Truck className="w-4 h-4" />
                                <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                  {order.trackingNumber}
                                </span>
                              </div>
                            </div>
                          )}
                          {(order.shippingZone || order.courierFlags?.suggestedCourier) && (
                            <div>
                              <div className="font-medium text-muted-foreground mb-1">Shipping Info</div>
                              <div className="flex flex-wrap gap-2 text-xs">
                                {order.shippingZone && (
                                  <span className="bg-muted px-2 py-1 rounded capitalize">
                                    {order.courierFlags?.zoneLabel || order.shippingZone.replace(/_/g, ' ')}
                                  </span>
                                )}
                                {order.courierFlags?.suggestedCourier && (
                                  <span className="bg-muted px-2 py-1 rounded">
                                    {order.courierFlags.suggestedCourier}
                                    {order.courierFlags.bookingType && (
                                      <span className="text-muted-foreground ml-1">
                                        ({order.courierFlags.bookingType})
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Module 10: Cancelled order fee & refund info */}
                        {order.status === 'cancelled' && order.cancellationFee !== undefined && (
                          <div className="mb-3 flex items-start gap-2 text-xs rounded-md bg-muted/40 border px-3 py-2.5">
                            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {order.cancellationFee > 0 ? (
                                <>
                                  Cancellation fee charged:{' '}
                                  <strong className="text-foreground">₹{order.cancellationFee.toLocaleString()}</strong>
                                  {order.refundableAmount !== undefined && order.refundableAmount > 0 && (
                                    <> · Refund:{' '}
                                      <strong className="text-green-700">₹{order.refundableAmount.toLocaleString()}</strong>
                                      {' '}(5–7 business days)
                                    </>
                                  )}
                                </>
                              ) : order.paymentMethod?.toLowerCase() === 'cod' ? (
                                <>Cash on Delivery order — no refund needed.</>
                              ) : (
                                <>
                                  No cancellation fee.
                                  {order.refundableAmount !== undefined && order.refundableAmount > 0 && (
                                    <> Full refund of{' '}
                                      <strong className="text-green-700">₹{order.refundableAmount.toLocaleString()}</strong>
                                      {' '}initiated (5–7 business days).
                                    </>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 mt-6">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewOrder(order.id || order._id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>

                          {/* Invoice button — available for all non-draft orders */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/order/${order.id || order._id}/invoice`)}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Invoice
                          </Button>

                          {['placed', 'confirmed', 'processing'].includes(order.status) && (
                            <div className="flex flex-col items-start gap-1">
                              {/* Module 10: Inline fee transparency hint */}
                              {order.status === 'placed' && (
                                <span className="text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                  Free cancellation
                                </span>
                              )}
                              {order.status === 'confirmed' && (
                                <span className="text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                                  ~2% fee applies
                                </span>
                              )}
                              {order.status === 'processing' && (
                                <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                  ~5% fee applies
                                </span>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className={
                                  order.status === 'processing'
                                    ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                                    : order.status === 'confirmed'
                                    ? 'border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300'
                                    : ''
                                }
                                onClick={() => handleCancelOrder(order.id || order._id)}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Cancel Order
                              </Button>
                            </div>
                          )}

                          {order.status === 'delivered' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const pid = order.items?.[0]?.productId;
                                navigate(pid ? `/product/${pid}` : '/shop');
                              }}
                            >
                              Write Review
                            </Button>
                          )}

                          {order.status === 'rejected' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate('/shop')}
                            >
                              <Package className="w-4 h-4 mr-2" />
                              Browse Similar Products
                            </Button>
                          )}
                        </div>

                        {/* Module 9: Order Status Timeline */}
                        {order.statusHistory && order.statusHistory.length > 0 && (
                          <div className="mt-5">
                            <button
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => toggleTimeline(order._id || order.id)}
                            >
                              {expandedTimelines.has(order._id || order.id)
                                ? <><ChevronUp className="w-3.5 h-3.5" /> Hide timeline</>
                                : <><ChevronDown className="w-3.5 h-3.5" /> Show order timeline ({order.statusHistory.length} event{order.statusHistory.length !== 1 ? 's' : ''})</>
                              }
                            </button>

                            {expandedTimelines.has(order._id || order.id) && (
                              <div className="mt-3 space-y-0 relative">
                                {/* vertical connecting line */}
                                <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border" />
                                {[...order.statusHistory].reverse().map((event, idx) => {
                                  const isRejection = event.status === 'rejected';
                                  return (
                                    <div key={idx} className="relative flex items-start gap-3 pl-5 pb-4 last:pb-0">
                                      {/* dot */}
                                      <div className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                                        isRejection
                                          ? 'bg-red-500 border-red-600'
                                          : event.status === 'delivered'
                                          ? 'bg-green-500 border-green-600'
                                          : idx === 0
                                          ? 'bg-primary border-primary'
                                          : 'bg-background border-border'
                                      }`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`text-xs font-semibold capitalize ${
                                            isRejection ? 'text-red-600' : 'text-foreground'
                                          }`}>
                                            {event.status.replace(/_/g, ' ')}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {new Date(event.timestamp).toLocaleString('en-IN', {
                                              day: 'numeric', month: 'short', year: 'numeric',
                                              hour: '2-digit', minute: '2-digit'
                                            })}
                                          </span>
                                        </div>
                                        {event.note && (
                                          <p className={`text-xs mt-0.5 ${
                                            isRejection ? 'text-red-500 font-medium' : 'text-muted-foreground'
                                          }`}>{event.note}</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchOrders(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchOrders(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      <Footer />

      {/* Module 5: Cancellation Fee Dialog */}
      <CancellationFeeDialog
        orderId={cancelDialog.orderId}
        orderNumber={cancelDialog.orderNumber}
        open={cancelDialog.open}
        onOpenChange={(open) => setCancelDialog(prev => ({ ...prev, open }))}
        onConfirmed={() => {
          toast({
            title: 'Order cancelled',
            description: 'Your order has been cancelled successfully.',
          });
          fetchOrders();
        }}
      />
    </div>
  );
}