import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { CheckCircle2 } from 'lucide-react';

interface PaymentInstructionsProps {
    orderNumber: string;
    amount: number;
    merchantName: string;
}

export default function PaymentInstructions({ orderNumber, amount, merchantName }: PaymentInstructionsProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>How to Pay</CardTitle>
                <CardDescription>Follow these simple steps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Order Summary */}
                <div className="rounded-lg bg-primary/10 p-4 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Order Number</span>
                        <span className="font-bold">{orderNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Amount to Pay</span>
                        <span className="text-2xl font-bold text-primary">₹{amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Pay to</span>
                        <span className="font-medium">{merchantName}</span>
                    </div>
                </div>

                {/* Payment Steps */}
                <div className="space-y-3 pt-2">
                    <h3 className="font-semibold text-sm">Payment Steps:</h3>

                    <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                            1
                        </div>
                        <div>
                            <p className="font-medium text-sm">Scan QR Code</p>
                            <p className="text-sm text-muted-foreground">
                                Open any UPI app (GPay, PhonePe, Paytm, BHIM, etc.) and scan the QR code
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                            2
                        </div>
                        <div>
                            <p className="font-medium text-sm">Or Use UPI Link</p>
                            <p className="text-sm text-muted-foreground">
                                Click the "Open UPI App" button to directly open your payment app
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                            3
                        </div>
                        <div>
                            <p className="font-medium text-sm">Verify Details</p>
                            <p className="text-sm text-muted-foreground">
                                Double-check the order number and amount before confirming payment
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                            4
                        </div>
                        <div>
                            <p className="font-medium text-sm">Complete Payment</p>
                            <p className="text-sm text-muted-foreground">
                                Enter your UPI PIN and complete the transaction in your app
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white text-sm font-medium">
                            <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="font-medium text-sm">Auto-Verification</p>
                            <p className="text-sm text-muted-foreground">
                                Your payment will be automatically verified within seconds
                            </p>
                        </div>
                    </div>
                </div>

                {/* Important Notes */}
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 space-y-1">
                    <p className="text-sm font-medium text-yellow-900">Important Notes:</p>
                    <ul className="text-xs text-yellow-800 space-y-1 ml-4 list-disc">
                        <li>Do not close this page until payment is confirmed</li>
                        <li>Payment link expires in 30 minutes</li>
                        <li>Status updates automatically every 5 seconds</li>
                        <li>Keep your transaction receipt for reference</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}
