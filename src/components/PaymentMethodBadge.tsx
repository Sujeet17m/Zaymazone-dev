import { Badge } from "@/components/ui/badge";
import { CreditCard, Banknote, Smartphone } from "lucide-react";

type PaymentMethod = 'cod' | 'upi' | 'upi_prepaid' | 'zoho_upi' | 'paytm' | 'paytm_upi' | 'zoho_card' | 'zoho_netbanking' | 'zoho_wallet' | 'razorpay';

interface PaymentMethodBadgeProps {
    method: PaymentMethod;
    variant?: 'default' | 'outline' | 'secondary';
    showIcon?: boolean;
    className?: string;
}

export function PaymentMethodBadge({
    method,
    variant = 'default',
    showIcon = true,
    className = ""
}: PaymentMethodBadgeProps) {

    const getPaymentInfo = (method: PaymentMethod) => {
        // Normalize UPI methods
        const isUPI = method === 'upi' || method === 'upi_prepaid' || method === 'zoho_upi' || method === 'paytm_upi';
        const isCOD = method === 'cod';

        if (isUPI) {
            return {
                label: 'UPI Paid',
                icon: <Smartphone className="w-3 h-3" />,
                variant: 'default' as const,
                className: 'bg-green-600 hover:bg-green-700 text-white'
            };
        }

        if (isCOD) {
            return {
                label: 'Cash on Delivery',
                icon: <Banknote className="w-3 h-3" />,
                variant: 'secondary' as const,
                className: 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-200'
            };
        }

        // Other payment methods
        return {
            label: method.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            icon: <CreditCard className="w-3 h-3" />,
            variant: 'outline' as const,
            className: ''
        };
    };

    const info = getPaymentInfo(method);

    return (
        <Badge
            variant={variant || info.variant}
            className={`${info.className} ${className} flex items-center gap-1.5 w-fit`}
        >
            {showIcon && info.icon}
            <span>{info.label}</span>
        </Badge>
    );
}

// Compact version for tables/lists
export function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
    const isUPI = method === 'upi' || method === 'upi_prepaid' || method === 'zoho_upi' || method === 'paytm_upi';
    const isCOD = method === 'cod';

    if (isUPI) {
        return (
            <div className="flex items-center gap-1.5 text-green-600">
                <Smartphone className="w-4 h-4" />
                <span className="text-xs font-medium">UPI</span>
            </div>
        );
    }

    if (isCOD) {
        return (
            <div className="flex items-center gap-1.5 text-orange-600">
                <Banknote className="w-4 h-4" />
                <span className="text-xs font-medium">COD</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 text-muted-foreground">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-medium">Card</span>
        </div>
    );
}
