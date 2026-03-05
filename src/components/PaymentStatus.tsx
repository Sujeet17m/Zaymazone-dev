import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, AlertCircle, RefreshCw } from "lucide-react";

type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled';
type PaymentMethod = 'cod' | 'upi' | 'zoho_upi' | 'paytm' | 'paytm_upi';

interface PaymentStatusProps {
    status: PaymentStatus;
    method?: PaymentMethod;
    showLabel?: boolean;
    className?: string;
}

export function PaymentStatus({
    status,
    method,
    showLabel = true,
    className = ""
}: PaymentStatusProps) {

    const getStatusInfo = () => {
        const isCOD = method === 'cod';

        switch (status) {
            case 'paid':
                return {
                    label: 'Paid',
                    icon: <CheckCircle2 className="w-4 h-4" />,
                    variant: 'default' as const,
                    className: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200'
                };

            case 'pending':
                return {
                    label: isCOD ? 'Payment on Delivery' : 'Payment Pending',
                    icon: <Clock className="w-4 h-4" />,
                    variant: 'secondary' as const,
                    className: isCOD
                        ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-200'
                        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200'
                };

            case 'processing':
                return {
                    label: 'Processing Payment',
                    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
                    variant: 'secondary' as const,
                    className: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200'
                };

            case 'failed':
                return {
                    label: 'Payment Failed',
                    icon: <XCircle className="w-4 h-4" />,
                    variant: 'destructive' as const,
                    className: 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200'
                };

            case 'refunded':
                return {
                    label: 'Refunded',
                    icon: <RefreshCw className="w-4 h-4" />,
                    variant: 'outline' as const,
                    className: 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200'
                };

            case 'cancelled':
                return {
                    label: 'Cancelled',
                    icon: <AlertCircle className="w-4 h-4" />,
                    variant: 'outline' as const,
                    className: 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200'
                };

            default:
                return {
                    label: status,
                    icon: <AlertCircle className="w-4 h-4" />,
                    variant: 'outline' as const,
                    className: ''
                };
        }
    };

    const info = getStatusInfo();

    return (
        <Badge
            variant={info.variant}
            className={`${info.className} ${className} flex items-center gap-1.5 w-fit`}
        >
            {info.icon}
            {showLabel && <span>{info.label}</span>}
        </Badge>
    );
}

// Compact icon-only version
export function PaymentStatusIcon({ status, method }: { status: PaymentStatus; method?: PaymentMethod }) {
    const isCOD = method === 'cod';

    switch (status) {
        case 'paid':
            return <CheckCircle2 className="w-5 h-5 text-green-600" />;
        case 'pending':
            return <Clock className={`w-5 h-5 ${isCOD ? 'text-orange-600' : 'text-yellow-600'}`} />;
        case 'processing':
            return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
        case 'failed':
            return <XCircle className="w-5 h-5 text-red-600" />;
        case 'refunded':
            return <RefreshCw className="w-5 h-5 text-purple-600" />;
        case 'cancelled':
            return <AlertCircle className="w-5 h-5 text-gray-600" />;
        default:
            return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
}
