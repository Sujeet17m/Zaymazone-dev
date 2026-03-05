import { useState } from 'react';
import { UpiPayment } from '../../lib/api';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Download, ZoomIn, ZoomOut } from 'lucide-react';

interface ReceiptPreviewModalProps {
    payment: UpiPayment;
    open: boolean;
    onClose: () => void;
}

export default function ReceiptPreviewModal({ payment, open, onClose }: ReceiptPreviewModalProps) {
    const [zoomed, setZoomed] = useState(false);

    const handleDownload = () => {
        if (!payment.receiptScreenshot) return;
        const link = document.createElement('a');
        link.href = payment.receiptScreenshot;
        link.download = `receipt-${payment.orderNumber}.png`;
        link.click();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[680px]">
                <DialogHeader>
                    <DialogTitle>Payment Receipt</DialogTitle>
                    <DialogDescription>
                        Customer-uploaded receipt for order{' '}
                        <span className="font-semibold text-foreground">{payment.orderNumber}</span>
                    </DialogDescription>
                </DialogHeader>

                {/* Order summary strip */}
                <div className="flex flex-wrap gap-3 rounded-lg bg-muted px-4 py-3 text-sm">
                    <div>
                        <span className="text-muted-foreground">Amount: </span>
                        <span className="font-semibold">₹{payment.amount.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">UPI ID: </span>
                        <span className="font-semibold">{payment.merchantUpiId}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Status: </span>
                        <Badge
                            variant="outline"
                            className={
                                payment.paymentStatus === 'verified'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : payment.paymentStatus === 'failed'
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }
                        >
                            {payment.paymentStatus}
                        </Badge>
                    </div>
                    {payment.receiptUploadedAt && (
                        <div>
                            <span className="text-muted-foreground">Uploaded: </span>
                            <span className="font-semibold">
                                {new Date(payment.receiptUploadedAt).toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Receipt image */}
                {payment.receiptScreenshot ? (
                    <div
                        className={`relative overflow-auto rounded-lg border bg-muted flex items-center justify-center transition-all ${
                            zoomed ? 'max-h-[70vh] cursor-zoom-out' : 'max-h-96 cursor-zoom-in'
                        }`}
                        onClick={() => setZoomed((z) => !z)}
                    >
                        <img
                            src={payment.receiptScreenshot}
                            alt="Payment receipt screenshot"
                            className={`rounded transition-all ${
                                zoomed ? 'w-full h-auto' : 'max-h-96 object-contain'
                            }`}
                        />
                    </div>
                ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                        No receipt uploaded
                    </div>
                )}

                <p className="text-center text-xs text-muted-foreground">
                    Click the image to toggle zoom
                </p>

                {/* Action buttons */}
                <div className="flex justify-end gap-2">
                    {payment.receiptScreenshot && (
                        <Button variant="outline" size="sm" onClick={handleDownload}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setZoomed((z) => !z)}
                    >
                        {zoomed ? (
                            <>
                                <ZoomOut className="mr-2 h-4 w-4" />
                                Zoom Out
                            </>
                        ) : (
                            <>
                                <ZoomIn className="mr-2 h-4 w-4" />
                                Zoom In
                            </>
                        )}
                    </Button>
                    <Button variant="default" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
