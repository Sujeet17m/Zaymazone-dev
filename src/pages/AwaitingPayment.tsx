import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, Smartphone, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

export default function AwaitingPayment() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');
    const txnToken = searchParams.get('txnToken');

    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
    const [isChecking, setIsChecking] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'success' | 'failed'>('pending');

    // Countdown timer
    useEffect(() => {
        if (timeLeft <= 0) {
            handleTimeout();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft]);

    // Auto-check payment status every 5 seconds
    useEffect(() => {
        if (!orderId) return;

        const checkInterval = setInterval(async () => {
            await checkPaymentStatus();
        }, 5000);

        return () => clearInterval(checkInterval);
    }, [orderId]);

    const checkPaymentStatus = async () => {
        if (!orderId || isChecking) return;

        setIsChecking(true);
        try {
            const response = await api.paytm.verifyTransaction({ orderId });

            if (response.success && response.paymentStatus === 'paid') {
                setPaymentStatus('success');
                setTimeout(() => {
                    navigate(`/payment-verified?orderId=${orderId}&txnId=${response.transaction?.txnId}`);
                }, 1000);
            } else if (response.paymentStatus === 'failed') {
                setPaymentStatus('failed');
            }
        } catch (error) {
            console.error('Error checking payment status:', error);
        } finally {
            setIsChecking(false);
        }
    };

    const handleTimeout = () => {
        toast({
            title: "Payment Timeout",
            description: "Payment time has expired. Please try again.",
            variant: "destructive",
        });
        navigate('/checkout');
    };

    const handleCancel = () => {
        navigate('/checkout');
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!orderId || !amount) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Invalid Payment Link</h2>
                        <p className="text-muted-foreground mb-4">
                            This payment link is invalid or has expired.
                        </p>
                        <Button onClick={() => navigate('/shop')}>
                            Continue Shopping
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <Navigation />

            <div className="pt-20 pb-16">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Card>
                            <CardHeader className="text-center border-b">
                                <div className="flex justify-center mb-4">
                                    {paymentStatus === 'success' ? (
                                        <CheckCircle2 className="w-16 h-16 text-green-600" />
                                    ) : paymentStatus === 'failed' ? (
                                        <AlertCircle className="w-16 h-16 text-destructive" />
                                    ) : (
                                        <Loader2 className="w-16 h-16 text-primary animate-spin" />
                                    )}
                                </div>
                                <CardTitle className="text-2xl">
                                    {paymentStatus === 'success' ? 'Payment Detected!' :
                                        paymentStatus === 'failed' ? 'Payment Failed' :
                                            'Awaiting Payment'}
                                </CardTitle>
                                <p className="text-muted-foreground mt-2">
                                    {paymentStatus === 'success' ? 'Verifying your payment...' :
                                        paymentStatus === 'failed' ? 'Your payment could not be processed' :
                                            'Complete payment in your UPI app'}
                                </p>
                            </CardHeader>

                            <CardContent className="p-6 space-y-6">
                                {/* Amount */}
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
                                    <p className="text-4xl font-bold text-primary">₹{parseFloat(amount).toLocaleString()}</p>
                                </div>

                                {/* Timer */}
                                {paymentStatus === 'pending' && (
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                        <Clock className="w-4 h-4" />
                                        <span className="text-sm">
                                            Time remaining: <span className="font-mono font-semibold">{formatTime(timeLeft)}</span>
                                        </span>
                                    </div>
                                )}

                                {/* Instructions */}
                                {paymentStatus === 'pending' && (
                                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-3">
                                        <div className="flex items-start gap-3">
                                            <Smartphone className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                            <div className="space-y-2 text-sm">
                                                <p className="font-medium text-blue-900 dark:text-blue-100">
                                                    How to complete payment:
                                                </p>
                                                <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                                                    <li>Open your UPI app (Google Pay, PhonePe, Paytm, etc.)</li>
                                                    <li>Check for payment request notification</li>
                                                    <li>Verify the amount and merchant details</li>
                                                    <li>Enter your UPI PIN to complete payment</li>
                                                </ol>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Transaction Details */}
                                <div className="border rounded-lg p-4 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Order ID</span>
                                        <span className="font-mono font-medium">{orderId}</span>
                                    </div>
                                    {txnToken && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Transaction Token</span>
                                            <span className="font-mono text-xs">{txnToken.substring(0, 20)}...</span>
                                        </div>
                                    )}
                                </div>

                                {/* Status Indicator */}
                                {paymentStatus === 'pending' && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Checking payment status...</span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    {paymentStatus === 'pending' && (
                                        <>
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={handleCancel}
                                            >
                                                Cancel Payment
                                            </Button>
                                            <Button
                                                className="flex-1"
                                                onClick={checkPaymentStatus}
                                                disabled={isChecking}
                                            >
                                                {isChecking ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        Checking...
                                                    </>
                                                ) : (
                                                    'Check Status'
                                                )}
                                            </Button>
                                        </>
                                    )}
                                    {paymentStatus === 'failed' && (
                                        <Button
                                            className="w-full"
                                            onClick={() => navigate('/checkout')}
                                        >
                                            Try Again
                                        </Button>
                                    )}
                                </div>

                                {/* Help Text */}
                                <p className="text-xs text-center text-muted-foreground">
                                    Having trouble? Contact our support team for assistance.
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
