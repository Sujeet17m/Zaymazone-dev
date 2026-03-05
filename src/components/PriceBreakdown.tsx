import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Truck, Info, Package, Clock, CreditCard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShippingBreakdownData {
    zone: string;
    zoneLabel: string;
    totalWeightGrams: number;
    totalWeightDisplay: string;
    baseCharge: number;
    weightCharge: number;
    isFreeShipping: boolean;
    freeShippingThreshold: number;
    amountForFreeShipping: number;
    estimatedDeliveryDays: string;
}

interface CourierFlagsData {
    isPrepaid: boolean;
    isCod: boolean;
    bookingType: 'prepaid' | 'cod';
    suggestedCourier: string;
    zone: string;
    zoneLabel: string;
}

interface PriceBreakdownProps {
    subtotal: number;
    shipping: number;
    codFee?: number;
    discount?: number;
    showCodFee: boolean;
    className?: string;
    // Module 3: Shipping engine data
    shippingBreakdown?: ShippingBreakdownData | null;
    courierFlags?: CourierFlagsData | null;
    shippingLoading?: boolean;
    estimatedDeliveryDays?: string;
}

// ─── Zone Badge Colors ────────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, string> = {
    local: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    metro: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    tier2: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    rest_of_india: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    remote: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PriceBreakdown({
    subtotal,
    shipping,
    codFee = 25,
    discount = 0,
    showCodFee,
    className = "",
    shippingBreakdown = null,
    courierFlags = null,
    shippingLoading = false,
    estimatedDeliveryDays,
}: PriceBreakdownProps) {
    const total = subtotal + shipping + (showCodFee ? codFee : 0) - discount;
    const freeShippingThreshold = shippingBreakdown?.freeShippingThreshold ?? 1500;
    const isFreeShipping = shipping === 0;
    const zone = shippingBreakdown?.zone || courierFlags?.zone || 'rest_of_india';
    const zoneLabel = shippingBreakdown?.zoneLabel || courierFlags?.zoneLabel || 'Rest of India';
    const deliveryDays = estimatedDeliveryDays || shippingBreakdown?.estimatedDeliveryDays || '4-6';
    const weightDisplay = shippingBreakdown?.totalWeightDisplay;
    const suggestedCourier = courierFlags?.suggestedCourier;
    const bookingType = courierFlags?.bookingType;
    const zoneColorClass = ZONE_COLORS[zone] || ZONE_COLORS.rest_of_india;

    return (
        <Card className={className}>
            <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Price Breakdown</h3>

                <div className="space-y-3">
                    {/* Subtotal */}
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">₹{subtotal.toLocaleString()}</span>
                    </div>

                    {/* Shipping */}
                    <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Shipping</span>
                            {shippingLoading && (
                                <span className="text-xs text-muted-foreground animate-pulse">calculating…</span>
                            )}
                        </div>
                        <span className={`font-medium ${isFreeShipping ? 'text-green-600' : ''}`}>
                            {isFreeShipping ? 'FREE' : `₹${shipping.toLocaleString()}`}
                        </span>
                    </div>

                    {/* Shipping Details — Zone + Weight + Courier */}
                    {(shippingBreakdown || courierFlags) && !shippingLoading && (
                        <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-xs">
                            {/* Zone badge */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <MapPinIcon className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Zone</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${zoneColorClass}`}>
                                    {zoneLabel}
                                </span>
                            </div>

                            {/* Weight */}
                            {weightDisplay && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Package className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-muted-foreground">Total weight</span>
                                    </div>
                                    <span className="font-medium">{weightDisplay}</span>
                                </div>
                            )}

                            {/* Estimated delivery */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-muted-foreground">Estimated delivery</span>
                                </div>
                                <span className="font-medium">{deliveryDays} days</span>
                            </div>

                            {/* Courier + booking type */}
                            {suggestedCourier && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Truck className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-muted-foreground">Courier</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-medium">{suggestedCourier}</span>
                                        {bookingType && (
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${bookingType === 'cod'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                }`}>
                                                {bookingType === 'cod' ? 'COD' : 'Prepaid'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Free Shipping Progress */}
                    {!isFreeShipping && (
                        <div className="space-y-1.5">
                            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded">
                                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span>
                                    Add ₹{(freeShippingThreshold - subtotal).toLocaleString()} more for free shipping
                                </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full bg-muted rounded-full h-1.5">
                                <div
                                    className="bg-primary rounded-full h-1.5 transition-all duration-500 [width:var(--bar-progress)]"
                                    style={{ '--bar-progress': `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` } as { '--bar-progress': string }}
                                />
                            </div>
                        </div>
                    )}

                    {/* COD Fee */}
                    {showCodFee && (
                        <div className="flex justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">COD Handling Fee</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="w-3 h-3 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs">Additional fee for Cash on Delivery orders</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <span className="font-medium text-orange-600">₹{codFee}</span>
                        </div>
                    )}

                    {/* Discount */}
                    {discount > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Discount</span>
                            <span className="font-medium text-green-600">-₹{discount.toLocaleString()}</span>
                        </div>
                    )}

                    <Separator />

                    {/* Total */}
                    <div className="flex justify-between text-base font-bold">
                        <span>Total</span>
                        <span className="text-primary">₹{total.toLocaleString()}</span>
                    </div>
                </div>

                {/* Free Shipping Savings Banner */}
                {isFreeShipping && shipping === 0 && subtotal > 0 && (
                    <div className="text-xs text-green-600 bg-green-50 dark:bg-green-950 p-2 rounded text-center">
                        🎉 You qualify for free shipping!
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Inline MapPin icon (avoids extra import)
function MapPinIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}
