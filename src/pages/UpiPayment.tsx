import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import UpiPaymentComponent from '../components/UpiPayment';
import { ordersApi, Order } from '../lib/api';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

export default function UpiPaymentPage() {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) {
                setError('Order ID is required');
                setLoading(false);
                return;
            }

            try {
                const orderData = await ordersApi.getById(orderId);
                setOrder(orderData);
            } catch (err: any) {
                setError(err.message || 'Failed to load order');
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [orderId]);

    const handlePaymentSuccess = () => {
        // Navigate to order confirmation page
        navigate('/orders');
    };

    const handlePaymentFailure = () => {
        // Stay on page or show retry option
        console.log('Payment failed');
    };

    if (loading) {
        return (
            <div className="container mx-auto py-12">
                <Card className="w-full max-w-2xl mx-auto">
                    <CardContent className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="ml-3 text-lg">Loading order details...</span>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="container mx-auto py-12">
                <Card className="w-full max-w-2xl mx-auto">
                    <CardContent className="py-8 text-center">
                        <p className="text-red-600">{error || 'Order not found'}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Complete Your Payment</h1>
                <p className="text-muted-foreground mt-2">
                    Scan the QR code or use the UPI link to complete your payment securely
                </p>
            </div>

            <UpiPaymentComponent
                orderId={order._id}
                amount={order.total}
                orderNumber={order.orderNumber}
                onSuccess={handlePaymentSuccess}
                onFailure={handlePaymentFailure}
            />
        </div>
    );
}
