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
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface RejectPaymentModalProps {
    payment: UpiPayment;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RejectPaymentModal({ payment, open, onClose, onSuccess }: RejectPaymentModalProps) {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!reason.trim()) {
            setError('Please provide a reason for rejection');
            return;
        }

        try {
            setLoading(true);
            await upiPaymentsApi.updatePaymentStatus(payment._id, {
                status: 'failed',
                reason: reason.trim(),
            });

            toast({
                title: 'Payment Rejected',
                description: `Payment for order ${payment.orderNumber} has been marked as failed`,
            });

            onSuccess();
            handleClose();
        } catch (err: any) {
            setError(err.message || 'Failed to reject payment');
            toast({
                title: 'Rejection Failed',
                description: err.message || 'Failed to reject payment',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setReason('');
        setError(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Reject UPI Payment</DialogTitle>
                        <DialogDescription>
                            Provide a reason for rejecting this payment. The order will be marked as failed.
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

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Reason Input */}
                        <div className="space-y-2">
                            <Label htmlFor="reason">
                                Rejection Reason <span className="text-red-500">*</span>
                            </Label>
                            <Textarea
                                id="reason"
                                placeholder="Enter the reason for rejecting this payment..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                                rows={4}
                                className="resize-none"
                            />
                            <p className="text-xs text-muted-foreground">
                                This reason will be recorded and may be visible to the customer
                            </p>
                        </div>

                        {/* Warning */}
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Warning:</strong> Rejecting this payment will mark the order as failed. This action cannot be easily undone.
                            </AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="destructive" disabled={loading || !reason.trim()}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Rejecting...
                                </>
                            ) : (
                                'Reject Payment'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
