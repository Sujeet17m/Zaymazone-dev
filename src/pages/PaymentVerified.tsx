import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Smartphone, ShoppingBag, Download } from "lucide-react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { PaymentMethodBadge } from "@/components/PaymentMethodBadge";

export default function PaymentVerified() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const orderId = searchParams.get('orderId');
    const txnId = searchParams.get('txnId');
    const amount = searchParams.get('amount');

    // Trigger confetti animation on mount
    useEffect(() => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;

        const randomInRange = (min: number, max: number) => {
            return Math.random() * (max - min) + min;
        };

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                clearInterval(interval);
                return;
            }

            confetti({
                particleCount: 3,
                angle: randomInRange(55, 125),
                spread: randomInRange(50, 70),
                origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
                colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']
            });
        }, 100);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-background">
            <Navigation />

            <div className="pt-20 pb-16">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, type: "spring" }}
                    >
                        <Card className="border-2 border-green-200 dark:border-green-800">
                            <CardContent className="p-8 text-center space-y-6">
                                {/* Success Icon */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                                    className="flex justify-center"
                                >
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-green-500 rounded-full blur-xl opacity-30 animate-pulse" />
                                        <CheckCircle2 className="w-24 h-24 text-green-600 relative" />
                                    </div>
                                </motion.div>

                                {/* Success Message */}
                                <div className="space-y-2">
                                    <h1 className="text-3xl font-bold text-green-600">Payment Successful!</h1>
                                    <p className="text-muted-foreground">
                                        Your payment has been verified and processed successfully
                                    </p>
                                </div>

                                {/* Payment Details */}
                                <div className="bg-green-50 dark:bg-green-950 rounded-lg p-6 space-y-4">
                                    {/* Amount */}
                                    {amount && (
                                        <div className="text-center">
                                            <p className="text-sm text-muted-foreground mb-1">Amount Paid</p>
                                            <p className="text-3xl font-bold text-green-600">₹{parseFloat(amount).toLocaleString()}</p>
                                        </div>
                                    )}

                                    {/* Payment Method */}
                                    <div className="flex items-center justify-center gap-2">
                                        <Smartphone className="w-5 h-5 text-green-600" />
                                        <PaymentMethodBadge method="upi" variant="default" />
                                    </div>

                                    {/* Transaction Details */}
                                    <div className="border-t border-green-200 dark:border-green-800 pt-4 space-y-2 text-sm">
                                        {orderId && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Order ID</span>
                                                <span className="font-mono font-medium">{orderId}</span>
                                            </div>
                                        )}
                                        {txnId && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Transaction ID</span>
                                                <span className="font-mono font-medium text-xs">{txnId}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Payment Time</span>
                                            <span className="font-medium">{new Date().toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Order Summary */}
                                <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 text-left">
                                    <div className="flex items-start gap-3">
                                        <ShoppingBag className="w-5 h-5 text-blue-600 mt-0.5" />
                                        <div className="space-y-1 text-sm">
                                            <p className="font-medium text-blue-900 dark:text-blue-100">
                                                What's Next?
                                            </p>
                                            <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                                                <li>✓ Order confirmation sent to your email</li>
                                                <li>✓ Seller will process your order shortly</li>
                                                <li>✓ You'll receive tracking details once shipped</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => navigate('/orders')}
                                    >
                                        <ShoppingBag className="w-4 h-4 mr-2" />
                                        View Order
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                            if (orderId) {
                                                navigate(`/order/${orderId}/invoice`);
                                            }
                                        }}
                                        disabled={!orderId}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        View Invoice
                                    </Button>
                                    <Button
                                        className="flex-1 btn-hero"
                                        onClick={() => navigate('/shop')}
                                    >
                                        Continue Shopping
                                    </Button>
                                </div>

                                {/* Support */}
                                <p className="text-xs text-muted-foreground">
                                    Need help? Contact our support team at support@zaymazone.com
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
