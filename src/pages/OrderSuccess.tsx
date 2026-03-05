import { useLocation, Link } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ShoppingBag, Download, Package, Truck, Banknote, Smartphone, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { PaymentMethodBadge } from "@/components/PaymentMethodBadge";
import { PaymentStatus } from "@/components/PaymentStatus";

const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  local:           { label: "Local",            color: "bg-green-100 text-green-800" },
  metro:           { label: "Metro",            color: "bg-blue-100 text-blue-800" },
  tier2:           { label: "Tier-2 City",      color: "bg-indigo-100 text-indigo-800" },
  rest_of_india:   { label: "Rest of India",    color: "bg-orange-100 text-orange-800" },
  remote:          { label: "Remote Area",      color: "bg-red-100 text-red-800" },
};

export default function OrderSuccess() {
  const location = useLocation();
  const orderId = location.state?.orderId || "ORDER123";
  const totalAmount = location.state?.totalAmount || 0;
  const paymentMethod = location.state?.paymentMethod || "cod";
  const paymentStatus = location.state?.paymentStatus || "pending";
  const txnId = location.state?.txnId;
  const estimatedDelivery = location.state?.estimatedDelivery || "5-7 business days";
  const shippingZone: string | undefined = location.state?.shippingZone;
  const zoneLabel: string | undefined = location.state?.zoneLabel;
  const suggestedCourier: string | undefined = location.state?.suggestedCourier;

  const zoneInfo = shippingZone ? ZONE_LABELS[shippingZone] : null;

  const isCOD = paymentMethod === 'cod';
  const isUPI = paymentMethod === 'upi' || paymentMethod === 'zoho_upi' || paymentMethod === 'paytm_upi';

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-20 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Success Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
            </motion.div>
            <h1 className="text-4xl font-bold mb-2">Order Placed Successfully!</h1>
            <p className="text-lg text-muted-foreground">
              Thank you for your purchase. Your order has been confirmed.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-6"
          >
            {/* Order Details Card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Order ID</p>
                    <p className="font-mono font-semibold text-lg">{orderId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                    <p className="font-bold text-2xl text-primary">₹{totalAmount.toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Payment Method</p>
                    <PaymentMethodBadge method={paymentMethod} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Payment Status</p>
                    <PaymentStatus status={paymentStatus} method={paymentMethod} />
                  </div>
                </div>

                {/* COD Amount Due */}
                {isCOD && (
                  <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Banknote className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-orange-900 dark:text-orange-100 mb-1">
                          Cash on Delivery
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-200">
                          Please keep <span className="font-bold">₹{totalAmount.toLocaleString()}</span> ready for payment at the time of delivery.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* UPI Transaction ID */}
                {isUPI && txnId && (
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Smartphone className="w-5 h-5 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-green-900 dark:text-green-100 mb-1">
                          Payment Successful
                        </p>
                        <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                          Your payment has been received and verified.
                        </p>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-green-700 dark:text-green-300">Transaction ID</span>
                          <span className="font-mono font-medium">{txnId}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Estimated Delivery */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Estimated Delivery
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">{estimatedDelivery}</p>
                  </div>
                  {zoneInfo && (
                    <Badge className={`text-xs ${zoneInfo.color}`}>
                      {zoneLabel || zoneInfo.label}
                    </Badge>
                  )}
                </div>

                {/* Shipping Zone & Courier */}
                {(shippingZone || suggestedCourier) && (
                  <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                    <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      {shippingZone && (
                        <div>
                          <span className="text-muted-foreground">Shipping zone: </span>
                          <span className="font-medium">{zoneLabel || zoneInfo?.label || shippingZone}</span>
                        </div>
                      )}
                      {suggestedCourier && (
                        <div>
                          <span className="text-muted-foreground">Suggested courier: </span>
                          <span className="font-medium">{suggestedCourier}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* What's Next Card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  What's Next?
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Order Confirmation Sent</p>
                      <p className="text-sm text-muted-foreground">
                        Check your email for order details and receipt
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Package className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Seller Processing</p>
                      <p className="text-sm text-muted-foreground">
                        The artisan will prepare your order for shipment
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Truck className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Tracking Details</p>
                      <p className="text-sm text-muted-foreground">
                        You'll receive tracking information once shipped
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/orders">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  View My Orders
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to={`/order/${orderId}/invoice`}>
                  <Download className="w-4 h-4 mr-2" />
                  View &amp; Print Invoice
                </Link>
              </Button>
              <Button asChild className="flex-1 btn-hero">
                <Link to="/shop">Continue Shopping</Link>
              </Button>
            </div>

            {/* Support Info */}
            <p className="text-sm text-center text-muted-foreground">
              Need help with your order? Contact us at{" "}
              <a href="mailto:support@zaymazone.com" className="text-primary hover:underline">
                support@zaymazone.com
              </a>
            </p>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

