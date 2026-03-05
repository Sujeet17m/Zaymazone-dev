import { useState } from 'react';
import { UpiPayment, upiPaymentsApi } from '../../lib/api';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface VerifyPaymentModalProps {
    payment: UpiPayment;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function VerifyPaymentModal({ payment, open, onClose, onSuccess }: VerifyPaymentModalProps) {
    const [utr, setUtr] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const validateUtr = (value: string) => {
        const cleaned = value.trim().toUpperCase();
        if (cleaned.length < 10 || cleaned.length > 16) {
            return 'UTR must be 10-16 characters';
        }
        if (!/^[A-Z0-9]+$/.test(cleaned)) {
            return 'UTR must contain only letters and numbers';
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate UTR
        const validationError = validateUtr(utr);
        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setLoading(true);
            await upiPaymentsApi.verifyPayment({
                upiPaymentId: payment._id,
                utr: utr.trim().toUpperCase(),
                verificationNotes: notes.trim() || undefined,
            });

            toast({
                title: 'Payment Verified!',
                description: `Payment for order ${payment.orderNumber} has been verified`,
            });

            onSuccess();
            handleClose();
        } catch (err: any) {
            const errCode = err?.code;
            const errMsg = err?.message || 'Failed to verify payment';

            let displayError = errMsg;
            let toastTitle = 'Verification Failed';

            if (errCode === 'DUPLICATE_UTR') {
                toastTitle = 'Duplicate Transaction';
                displayError = 'This UTR has already been used for another payment. Each UTR can only be used once. Please check the transaction reference.';
            } else if (errCode === 'PARTIAL_PAYMENT') {
                toastTitle = 'Partial Payment Detected';
                displayError = errMsg; // Backend already provides a detailed message with amounts
            } else if (errCode === 'OVERPAYMENT') {
                toastTitle = 'Overpayment Detected';
                displayError = errMsg;
            } else if (errCode === 'INVALID_UTR' || errCode === 'INVALID_UTR_FORMAT') {
                toastTitle = 'Invalid UTR';
                displayError = 'UTR must be 10-16 alphanumeric characters (letters and numbers only, no spaces or symbols).';
            } else if (errCode === 'PAYMENT_NOT_VERIFIABLE') {
                toastTitle = 'Cannot Verify Payment';
                displayError = errMsg;
            }

            setError(displayError);
            toast({
                title: toastTitle,
                description: displayError,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setUtr('');
        setNotes('');
        setError(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Verify UPI Payment</DialogTitle>
                        <DialogDescription>
                            Enter the UTR (Transaction Reference) to verify this payment
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Payment Details */}
                        <div className="rounded-lg bg-muted p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Order Number</span>
                                <span className="font-medium">{payment.orderNumber}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Amount</span>
                                <span className="font-medium">₹{payment.amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Merchant UPI ID</span>
                                <span className="font-medium">{payment.merchantUpiId}</span>
                            </div>
                        </div>

                        {/* Customer Receipt Screenshot */}
                        {payment.receiptScreenshot && (
                            <div className="space-y-2">
                                <Label>Customer Receipt Screenshot</Label>
                                <div className="border rounded-lg overflow-hidden bg-muted">
                                    <img
                                        src={payment.receiptScreenshot}
                                        alt="Payment receipt"
                                        className="w-full max-h-64 object-contain"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Uploaded: {payment.receiptUploadedAt ? new Date(payment.receiptUploadedAt).toLocaleString() : 'N/A'}
                                </p>
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* UTR Input */}
                        <div className="space-y-2">
                            <Label htmlFor="utr">
                                UTR (Transaction Reference) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="utr"
                                placeholder="Enter 10-16 character UTR"
                                value={utr}
                                onChange={(e) => setUtr(e.target.value.toUpperCase())}
                                required
                                maxLength={16}
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                The unique transaction reference from the payment app (10-16 alphanumeric characters)
                            </p>
                        </div>

                        {/* Notes Input */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Verification Notes (Optional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="Add any notes about this verification..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !utr.trim()}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                'Verify Payment'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
