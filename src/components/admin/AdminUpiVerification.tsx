import { useState, useEffect } from 'react';
import { UpiPayment, upiPaymentsApi } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Clock, Paperclip } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import VerifyPaymentModal from './VerifyPaymentModal';
import RejectPaymentModal from './RejectPaymentModal';
import ReceiptPreviewModal from './ReceiptPreviewModal';

export default function AdminUpiVerification() {
    const [payments, setPayments] = useState<UpiPayment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<UpiPayment | null>(null);
    const [verifyModalOpen, setVerifyModalOpen] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [previewPayment, setPreviewPayment] = useState<UpiPayment | null>(null);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const { toast } = useToast();

    const fetchPendingPayments = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await upiPaymentsApi.getPendingPayments();
            setPayments(response.payments);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch pending payments');
            toast({
                title: 'Error',
                description: err.message || 'Failed to fetch pending payments',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingPayments();
    }, []);

    const handlePreviewReceipt = (payment: UpiPayment) => {
        setPreviewPayment(payment);
        setPreviewModalOpen(true);
    };

    const handleVerifyClick = (payment: UpiPayment) => {
        setSelectedPayment(payment);
        setVerifyModalOpen(true);
    };

    const handleRejectClick = (payment: UpiPayment) => {
        setSelectedPayment(payment);
        setRejectModalOpen(true);
    };

    const handleVerifySuccess = () => {
        setVerifyModalOpen(false);
        setSelectedPayment(null);
        fetchPendingPayments();
        toast({
            title: 'Payment Verified!',
            description: 'Payment has been verified and order updated',
        });
    };

    const handleRejectSuccess = () => {
        setRejectModalOpen(false);
        setSelectedPayment(null);
        fetchPendingPayments();
        toast({
            title: 'Payment Rejected',
            description: 'Payment has been marked as failed',
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
            case 'verified':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Verified</Badge>;
            case 'failed':
                return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-lg">Loading pending payments...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>UPI Payment Verification</CardTitle>
                            <CardDescription>Review and verify pending UPI payments</CardDescription>
                        </div>
                        <Button onClick={fetchPendingPayments} variant="outline" size="sm">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {payments.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Pending Payments</h3>
                            <p className="text-muted-foreground">All UPI payments have been processed</p>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order Number</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead>Payment Mode</TableHead>
                                        <TableHead>Receipt</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Expires</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {payments.map((payment) => (
                                        <TableRow key={payment._id}>
                                            <TableCell className="font-medium">{payment.orderNumber}</TableCell>
                                            <TableCell>₹{payment.amount.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{payment.paymentMode}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {payment.receiptScreenshot ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePreviewReceipt(payment)}
                                                        className="focus:outline-none"
                                                        title="Click to view receipt"
                                                    >
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 cursor-pointer hover:bg-green-100 transition-colors">
                                                            <Paperclip className="h-3 w-3" />
                                                            View Receipt
                                                        </Badge>
                                                    </button>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(payment.paymentStatus)}</TableCell>
                                            <TableCell>{formatDate(payment.createdAt)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDate(payment.expiresAt)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        onClick={() => handleVerifyClick(payment)}
                                                    >
                                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                                        Verify
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => handleRejectClick(payment)}
                                                    >
                                                        <XCircle className="h-4 w-4 mr-1" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {previewPayment && (
                <ReceiptPreviewModal
                    payment={previewPayment}
                    open={previewModalOpen}
                    onClose={() => {
                        setPreviewModalOpen(false);
                        setPreviewPayment(null);
                    }}
                />
            )}

            {selectedPayment && (
                <>
                    <VerifyPaymentModal
                        payment={selectedPayment}
                        open={verifyModalOpen}
                        onClose={() => setVerifyModalOpen(false)}
                        onSuccess={handleVerifySuccess}
                    />
                    <RejectPaymentModal
                        payment={selectedPayment}
                        open={rejectModalOpen}
                        onClose={() => setRejectModalOpen(false)}
                        onSuccess={handleRejectSuccess}
                    />
                </>
            )}
        </div>
    );
}
