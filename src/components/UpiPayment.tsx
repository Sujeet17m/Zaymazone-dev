import { useState, useEffect, useCallback } from 'react';
import { UpiPayment, upiPaymentsApi } from '../lib/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle2, XCircle, Clock, Copy, Download, ExternalLink, Loader2, Upload, ImageIcon, AlertTriangle } from 'lucide-react';
import { useToast } from '../hooks/use-toast';


interface UpiPaymentProps {
    orderId: string;
    amount: number;
    orderNumber: string;
    onSuccess?: (payment: UpiPayment) => void;
    onFailure?: (payment: UpiPayment) => void;
}

export default function UpiPaymentComponent({ orderId, amount, orderNumber, onSuccess, onFailure }: UpiPaymentProps) {
    const [paymentIntent, setPaymentIntent] = useState<any>(null);
    const [paymentStatus, setPaymentStatus] = useState<UpiPayment | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [pollingActive, setPollingActive] = useState(false);
    const [uploadStep, setUploadStep] = useState<'idle' | 'pending_upload' | 'uploading' | 'uploaded'>('idle');
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const { toast } = useToast();

    // Calculate time remaining
    useEffect(() => {
        if (!paymentIntent?.expiresAt) return;

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const expiry = new Date(paymentIntent.expiresAt).getTime();
            const remaining = Math.max(0, expiry - now);
            setTimeRemaining(remaining);

            if (remaining === 0) {
                setPollingActive(false);
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [paymentIntent]);

    // Format time remaining
    const formatTimeRemaining = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Generate payment intent on mount
    useEffect(() => {
        const generateIntent = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await upiPaymentsApi.generateIntent({
                    orderId,
                    amount,
                    expiryMinutes: 30
                });

                setPaymentIntent(response);
                setPollingActive(true);

                toast({
                    title: 'Payment Intent Generated',
                    description: 'Scan the QR code or click the UPI link to pay',
                });
            } catch (err: any) {
                setError(err.message || 'Failed to generate payment intent');
                toast({
                    title: 'Error',
                    description: err.message || 'Failed to generate payment intent',
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };

        generateIntent();
    }, [orderId, amount]);

    // Poll payment status
    useEffect(() => {
        if (!pollingActive || !paymentIntent?.upiPaymentId) return;

        const pollStatus = async () => {
            try {
                const status = await upiPaymentsApi.getPaymentStatus(paymentIntent.upiPaymentId);
                setPaymentStatus(status);

                if (status.paymentStatus === 'verified') {
                    setPollingActive(false);
                    toast({
                        title: 'Payment Successful!',
                        description: 'Your payment has been verified',
                    });
                    onSuccess?.(status);
                } else if (status.paymentStatus === 'failed') {
                    setPollingActive(false);
                    toast({
                        title: 'Payment Failed',
                        description: status.failureReason || 'Payment verification failed',
                        variant: 'destructive',
                    });
                    onFailure?.(status);
                }
            } catch (err) {
                console.error('Error polling payment status:', err);
            }
        };

        // Poll immediately
        pollStatus();

        // Then poll every 5 seconds
        const interval = setInterval(pollStatus, 5000);

        return () => clearInterval(interval);
    }, [pollingActive, paymentIntent?.upiPaymentId, onSuccess, onFailure]);

    // Copy to clipboard
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copied!',
            description: `${label} copied to clipboard`,
        });
    };

    // Download QR code
    const downloadQRCode = () => {
        const link = document.createElement('a');
        link.href = paymentIntent.qrCodeData;
        link.download = `upi-qr-${orderNumber}.png`;
        link.click();
        toast({
            title: 'QR Code Downloaded',
            description: 'QR code saved to your device',
        });
    };

    // Handle file selection — read as base64
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setUploadError('File too large — max 5 MB');
            return;
        }
        setUploadError(null);
        const reader = new FileReader();
        reader.onload = () => setReceiptPreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    // Upload the selected receipt screenshot
    const handleUploadReceipt = async () => {
        if (!receiptPreview || !paymentIntent?.upiPaymentId) return;
        try {
            setUploadStep('uploading');
            await upiPaymentsApi.uploadReceipt(paymentIntent.upiPaymentId, receiptPreview);
            setUploadStep('uploaded');
            setPollingActive(false); // stop polling — awaiting manual admin review
            toast({
                title: 'Receipt Submitted',
                description: 'Admin will verify your payment and confirm shortly.',
            });
        } catch (err: any) {
            setUploadStep('pending_upload');
            setUploadError(err.message || 'Upload failed — please try again');
            toast({ title: 'Upload Failed', description: err.message || 'Please try again', variant: 'destructive' });
        }
    };

    if (loading) {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-lg">Generating payment intent...</span>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardContent className="py-8">
                    <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    // Payment verified
    if (paymentStatus?.paymentStatus === 'verified') {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                    </div>
                    <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
                    <CardDescription>Your payment has been verified</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted p-4 space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Order Number</span>
                            <span className="font-medium">{orderNumber}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Amount Paid</span>
                            <span className="font-medium">₹{amount.toFixed(2)}</span>
                        </div>
                        {paymentStatus.utr && (
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">UTR</span>
                                <span className="font-medium">{paymentStatus.utr}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Verified At</span>
                            <span className="font-medium">
                                {new Date(paymentStatus.verifiedAt!).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Payment failed
    if (paymentStatus?.paymentStatus === 'failed') {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <XCircle className="h-10 w-10 text-red-600" />
                    </div>
                    <CardTitle className="text-2xl text-red-600">Payment Failed</CardTitle>
                    <CardDescription>
                        {paymentStatus.failureReason || 'Payment verification failed'}
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    // Payment expired
    if (timeRemaining === 0) {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
                        <Clock className="h-10 w-10 text-yellow-600" />
                    </div>
                    <CardTitle className="text-2xl text-yellow-600">Payment Expired</CardTitle>
                    <CardDescription>This payment link has expired. Please create a new order.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    // Active payment screen
    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            {/* Timer Alert */}
            {timeRemaining < 300000 && timeRemaining > 0 && (
                <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                        Payment link expires in {formatTimeRemaining(timeRemaining)}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                {/* QR Code Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Scan QR Code</CardTitle>
                        <CardDescription>Use any UPI app to scan and pay</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Fixed-amount warning */}
                        <Alert className="border-amber-300 bg-amber-50">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-amber-800">
                                Amount is fixed at <strong>₹{amount.toFixed(2)}</strong> — do <strong>NOT</strong> change it in your UPI app.
                            </AlertDescription>
                        </Alert>
                        <div className="flex justify-center">
                            <img
                                src={paymentIntent.qrCodeData}
                                alt="UPI QR Code"
                                className="w-64 h-64 border-4 border-primary rounded-lg"
                            />
                        </div>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={downloadQRCode}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download QR Code
                        </Button>
                    </CardContent>
                </Card>

                {/* Payment Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Payment Instructions</CardTitle>
                        <CardDescription>Follow these steps to complete payment</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Order Details */}
                        <div className="rounded-lg bg-muted p-4 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Order ID</span>
                                <span className="font-medium">{orderNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Amount</span>
                                <span className="font-medium text-lg">₹{amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Merchant</span>
                                <span className="font-medium">{paymentIntent.merchantName}</span>
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                                    1
                                </div>
                                <p className="text-sm">Scan the QR code with any UPI app (GPay, PhonePe, Paytm, etc.)</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                                    2
                                </div>
                                <p className="text-sm">Or click the UPI link below to open your payment app</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                                    3
                                </div>
                                <p className="text-sm">Verify the order ID and amount match</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                                    4
                                </div>
                                <p className="text-sm">Complete the payment in your UPI app</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                                    5
                                </div>
                                <p className="text-sm">Click <strong>I Have Paid</strong> and upload a screenshot of your payment confirmation</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm">
                                    6
                                </div>
                                <p className="text-sm">Admin will verify your screenshot and confirm the order</p>
                            </div>
                        </div>

                        {/* UPI Link */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">UPI Payment Link</label>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => window.open(paymentIntent.upiIntentUrl, '_blank')}
                                >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open UPI App
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(paymentIntent.upiIntentUrl, 'UPI link')}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Merchant UPI ID */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Merchant UPI ID</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    id="merchant-upi-id"
                                    aria-label="Merchant UPI ID"
                                    title="Merchant UPI ID"
                                    value={paymentIntent.merchantUpiId}
                                    readOnly
                                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(paymentIntent.merchantUpiId, 'Merchant UPI ID')}
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Upload error */}
                        {uploadError && (
                            <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription>{uploadError}</AlertDescription>
                            </Alert>
                        )}

                        {/* Step 1: I Have Paid button */}
                        {uploadStep === 'idle' && (
                            <Button className="w-full" size="lg" onClick={() => setUploadStep('pending_upload')} disabled={!pollingActive}>
                                <Upload className="mr-2 h-4 w-4" />
                                I Have Paid — Upload Receipt
                            </Button>
                        )}

                        {/* Step 2: File selection */}
                        {uploadStep === 'pending_upload' && (
                            <div className="space-y-3">
                                <Alert>
                                    <ImageIcon className="h-4 w-4" />
                                    <AlertDescription>Upload a screenshot of your payment confirmation screen</AlertDescription>
                                </Alert>
                                <label htmlFor="receipt-upload" className="block cursor-pointer">
                                    <div className="border-2 border-dashed border-border rounded-lg p-5 text-center hover:bg-muted transition-colors">
                                        {receiptPreview ? (
                                            <img src={receiptPreview} alt="Receipt preview" className="max-h-48 mx-auto rounded" />
                                        ) : (
                                            <>
                                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                                <p className="text-sm text-muted-foreground">Click to select a screenshot</p>
                                                <p className="text-xs text-muted-foreground mt-1">JPG, PNG — max 5 MB</p>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        id="receipt-upload"
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={handleFileSelect}
                                    />
                                </label>
                                {receiptPreview && (
                                    <Button className="w-full" onClick={handleUploadReceipt}>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Submit Receipt
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Step 3: Uploading */}
                        {uploadStep === 'uploading' && (
                            <Button className="w-full" disabled>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading Receipt...
                            </Button>
                        )}

                        {/* Step 4: Uploaded — awaiting admin */}
                        {uploadStep === 'uploaded' && (
                            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center space-y-1">
                                <div className="flex items-center justify-center gap-2 text-green-700">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span className="font-medium">Receipt submitted!</span>
                                </div>
                                <p className="text-sm text-green-600">Our admin will verify your payment and confirm the order shortly.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
