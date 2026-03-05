import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, CreditCard, Truck, MapPin, User, Loader2, Smartphone, Banknote, Zap, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { api, shippingApi, getImageUrl } from "@/lib/api";
import { artisanAnimations } from "@/lib/animations";
import { AnimatedInput } from "@/components/AnimatedInput";
import { LoginForm } from "@/components/LoginForm";
import { analytics } from "@/lib/analytics";
import { PriceBreakdown } from "@/components/PriceBreakdown";

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { cart, isLoading: cartLoading, clearCart } = useCart();
  const { user } = useAuth();

  // Check for direct purchase from location state
  const directPurchase = location.state?.directPurchase;
  const directProduct = location.state?.product;
  const directQuantity = location.state?.quantity || 1;

  const [isGuest, setIsGuest] = useState(!user);
  // 'saved' = use address from user profile; 'new' = enter a different address for this order
  const [addressOption, setAddressOption] = useState<'saved' | 'new'>(
    user?.address?.street ? 'saved' : 'new'
  );
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // COD eligibility state
  const [codEligibility, setCodEligibility] = useState<{
    eligible: boolean;
    reason: string | null;
    codFee: number;
    loading: boolean;
    checked: boolean;
  }>({
    eligible: true,
    reason: null,
    codFee: 25,
    loading: false,
    checked: false,
  });

  // ── Shipping Estimate State (Module 3) ─────────────────────────────────────
  const [shippingEstimate, setShippingEstimate] = useState<{
    shippingCharge: number;
    codFee: number;
    zone: string;
    zoneLabel: string;
    isFreeShipping: boolean;
    freeShippingThreshold: number;
    estimatedDeliveryDays: string;
    breakdown: import('@/lib/api').ShippingBreakdown | null;
    courierFlags: import('@/lib/api').CourierFlags | null;
    loading: boolean;
    error: boolean;
  }>({
    shippingCharge: 80,  // sensible default (rest_of_india base)
    codFee: 25,
    zone: 'rest_of_india',
    zoneLabel: 'Rest of India',
    isFreeShipping: false,
    freeShippingThreshold: 1500,
    estimatedDeliveryDays: '4-6',
    breakdown: null,
    courierFlags: null,
    loading: false,
    error: false,
  });

  // Pre-populate formData from the signed-in user's profile on first render.
  // Address fields are filled from the saved profile when addressOption is 'saved'.
  const [formData, setFormData] = useState(() => {
    const nameParts = (user?.name || '').split(' ');
    const hasSavedAddress = !!user?.address?.street;
    return {
      email: user?.email || '',
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      phone: user?.phone || '',
      address: hasSavedAddress ? (user?.address?.street || '') : '',
      city: hasSavedAddress ? (user?.address?.city || '') : '',
      state: hasSavedAddress ? (user?.address?.state || '') : '',
      pincode: hasSavedAddress ? (user?.address?.zipCode || '') : '',
    };
  });

  // Re-populate form and address option when user is loaded asynchronously.
  // This handles the case where auth was still loading when the component first mounted.
  useEffect(() => {
    if (!user) return;
    const nameParts = (user.name || '').split(' ');
    setFormData(prev => ({
      ...prev,
      email: prev.email || user.email || '',
      firstName: prev.firstName || nameParts[0] || '',
      lastName: prev.lastName || nameParts.slice(1).join(' ') || '',
      phone: prev.phone || user.phone || '',
      // Only fill address fields if they are still empty (user hasn't typed yet)
      address: prev.address || user.address?.street || '',
      city: prev.city || user.address?.city || '',
      state: prev.state || user.address?.state || '',
      pincode: prev.pincode || user.address?.zipCode || '',
    }));
    // Switch to 'saved' address option if the profile has a saved address
    if (user.address?.street) {
      setAddressOption('saved');
    }
  }, [user]);

  // For direct purchase, we don't need cart validation
  const hasItems = directPurchase ? !!directProduct : (cart && cart.items.length > 0);

  const subtotal = directPurchase && directProduct
    ? directProduct.price * directQuantity
    : cart?.items.reduce((sum, item) => sum + (item.productId.price * item.quantity), 0) || 0;

  // Live shipping from estimate API; fall back to estimate state
  const shipping = shippingEstimate.isFreeShipping ? 0 : shippingEstimate.shippingCharge;
  const codFee = paymentMethod === 'cod' ? (shippingEstimate.codFee || codEligibility.codFee) : 0;
  const total = subtotal + shipping + codFee;

  // High-value COD warning threshold
  const HIGH_VALUE_WARNING = 25000;
  const showHighValueCodWarning = paymentMethod === 'cod' && subtotal >= HIGH_VALUE_WARNING && codEligibility.eligible;

  // ── COD Eligibility Check ──────────────────────────────────────────────────
  const checkCodEligibility = useCallback(async () => {
    if (paymentMethod !== 'cod') return;
    setCodEligibility(prev => ({ ...prev, loading: true }));
    try {
      const params = new URLSearchParams({
        subtotal: subtotal.toString(),
        ...(formData.state ? { state: formData.state } : {}),
        ...(user?.id ? { userId: user.id } : {}),
      });
      const res = await fetch(`/api/cod/eligibility?${params}`);
      const data = await res.json();
      setCodEligibility({
        eligible: data.eligible ?? true,
        reason: data.reason ?? null,
        codFee: data.codFee ?? 25,
        loading: false,
        checked: true,
      });
    } catch {
      // On network error, don't block the user — backend will enforce
      setCodEligibility(prev => ({ ...prev, loading: false, checked: true }));
    }
  }, [paymentMethod, subtotal, formData.state, user?.id]);

  // Re-check COD eligibility when payment method, subtotal, or state changes
  useEffect(() => {
    if (paymentMethod === 'cod') {
      const debounce = setTimeout(checkCodEligibility, 500);
      return () => clearTimeout(debounce);
    } else {
      setCodEligibility(prev => ({ ...prev, checked: false }));
    }
  }, [paymentMethod, subtotal, formData.state, checkCodEligibility]);

  // ── Live Shipping Estimate (Module 3) ───────────────────────────────────
  const fetchShippingEstimate = useCallback(async () => {
    if (!formData.state || subtotal <= 0) return;

    // Build items list for the estimate API
    const items = directPurchase && directProduct
      ? [{ productId: directProduct._id || directProduct.id, quantity: directQuantity }]
      : (cart?.items.map(item => ({
        productId: item.productId._id || item.productId.id,
        quantity: item.quantity,
      })) || []);

    if (items.length === 0) return;

    setShippingEstimate(prev => ({ ...prev, loading: true, error: false }));
    try {
      const result = await shippingApi.estimate({
        items,
        toState: formData.state,
        paymentMethod,
      });
      setShippingEstimate({
        shippingCharge: result.shippingCharge,
        codFee: result.codFee,
        zone: result.zone,
        zoneLabel: result.zoneLabel,
        isFreeShipping: result.isFreeShipping,
        freeShippingThreshold: result.freeShippingThreshold,
        estimatedDeliveryDays: result.estimatedDeliveryDays,
        breakdown: result.breakdown,
        courierFlags: result.courierFlags,
        loading: false,
        error: false,
      });
    } catch {
      // On error keep previous estimate, don't block user
      setShippingEstimate(prev => ({ ...prev, loading: false, error: true }));
    }
  }, [formData.state, paymentMethod, subtotal, directPurchase, directProduct, directQuantity, cart]);

  // Debounced shipping estimate fetch
  useEffect(() => {
    const debounce = setTimeout(fetchShippingEstimate, 600);
    return () => clearTimeout(debounce);
  }, [formData.state, paymentMethod, subtotal, fetchShippingEstimate]);

  // Redirect if no items (only for cart checkout)
  useEffect(() => {
    if (!directPurchase && !cartLoading && (!cart || cart.items.length === 0)) {
      toast({
        title: "Cart is empty",
        description: "Add some items to cart before checkout",
        variant: "destructive",
      });
      navigate('/shop');
    }
  }, [cart, cartLoading, navigate, toast, directPurchase]);

  // Track begin checkout event
  useEffect(() => {
    if (directPurchase && directProduct) {
      analytics.beginCheckout(
        [{
          id: directProduct._id || directProduct.id,
          name: directProduct.name,
          category: directProduct.category,
          price: directProduct.price,
          quantity: directQuantity
        }],
        directProduct.price * directQuantity
      );
    } else if (cart && cart.items.length > 0) {
      analytics.beginCheckout(
        cart.items,
        cart.total
      );
    }
  }, [cart, directPurchase, directProduct, directQuantity]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handles switching between "use saved address" and "enter new address".
  // When switching to 'saved', the address fields are re-populated from the user profile.
  // When switching to 'new', the address fields are cleared so the user can type freely.
  const handleAddressOptionChange = (option: 'saved' | 'new') => {
    setAddressOption(option);
    if (option === 'saved' && user?.address) {
      setFormData(prev => ({
        ...prev,
        address: user.address?.street || '',
        city: user.address?.city || '',
        state: user.address?.state || '',
        pincode: user.address?.zipCode || '',
      }));
    } else if (option === 'new') {
      setFormData(prev => ({
        ...prev,
        address: '',
        city: '',
        state: '',
        pincode: '',
      }));
    }
  };

  // ── Enhanced form validation with phone & PIN format checks ───────────────
  const validateForm = () => {
    // lastName is intentionally excluded — users with a single display name have no last name
    const required = ['firstName', 'phone', 'address', 'city', 'state', 'pincode'];
    if (isGuest && !formData.email) required.push('email');

    const missing = required.filter(field => !formData[field]);
    if (missing.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please fill in: ${missing.map(f => f.replace(/([A-Z])/g, ' $1')).join(', ')}`,
        variant: "destructive",
      });
      return false;
    }

    // Phone: must be 10 digits (Indian mobile)
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)",
        variant: "destructive",
      });
      return false;
    }

    // PIN code: must be exactly 6 digits
    if (!/^\d{6}$/.test(formData.pincode)) {
      toast({
        title: "Invalid PIN code",
        description: "PIN code must be exactly 6 digits (e.g. 400001)",
        variant: "destructive",
      });
      return false;
    }

    // COD eligibility guard
    if (paymentMethod === 'cod' && codEligibility.checked && !codEligibility.eligible) {
      toast({
        title: "COD not available",
        description: codEligibility.reason || "Cash on Delivery is not available for this order. Please choose UPI.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;

    setIsPlacingOrder(true);
    try {
      // Prepare order items based on purchase type
      const orderItems = directPurchase && directProduct ? [{
        productId: directProduct._id || directProduct.id,
        quantity: directQuantity,
      }] : cart!.items.map(item => ({
        productId: item.productId._id || item.productId.id,
        quantity: item.quantity,
      }));

      const orderData = {
        items: orderItems,
        shippingAddress: (() => {
          // Use the user's saved profile address when selected
          if (user?.address?.street && addressOption === 'saved') {
            return {
              fullName: `${formData.firstName} ${formData.lastName}`.trim() || user.name || '',
              phone: formData.phone,
              email: formData.email || user?.email || undefined,
              addressLine1: user.address.street,
              city: user.address.city,
              state: user.address.state,
              zipCode: user.address.zipCode,
              country: user.address.country || 'India',
              addressType: 'home' as const,
            };
          }
          // Otherwise use what was entered in the form
          return {
            fullName: `${formData.firstName} ${formData.lastName}`,
            phone: formData.phone,
            email: formData.email || user?.email || undefined,
            addressLine1: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.pincode,
            country: 'India',
            addressType: 'home' as const,
          };
        })(),
        billingAddress: (() => {
          if (user?.address?.street && addressOption === 'saved') {
            return {
              fullName: `${formData.firstName} ${formData.lastName}`.trim() || user.name || '',
              phone: formData.phone,
              email: formData.email || user?.email || undefined,
              addressLine1: user.address.street,
              city: user.address.city,
              state: user.address.state,
              zipCode: user.address.zipCode,
              country: user.address.country || 'India',
              addressType: 'home' as const,
            };
          }
          return {
            fullName: `${formData.firstName} ${formData.lastName}`,
            phone: formData.phone,
            email: formData.email || user?.email || undefined,
            addressLine1: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.pincode,
            country: 'India',
            addressType: 'home' as const,
          };
        })(),
        useShippingAsBilling: true,
        paymentMethod: paymentMethod as import('@/lib/api').Order['paymentMethod'],
      };

      const order = await api.createOrder(orderData);

      // Handle payment based on method
      if (paymentMethod === 'cod') {
        // COD orders go directly to success
        if (!directPurchase) {
          await clearCart();
        }

        toast({
          title: "Order Placed Successfully!",
          description: `Order ID: ${order.orderNumber}`,
        });

        navigate('/order-success', {
          state: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            totalAmount: total,
            paymentMethod: 'cod',
            estimatedDelivery: `${shippingEstimate.estimatedDeliveryDays} business days`,
            shippingZone: shippingEstimate.zone,
            zoneLabel: shippingEstimate.zoneLabel,
            suggestedCourier: shippingEstimate.courierFlags?.suggestedCourier,
          }
        });
      } else if (paymentMethod === 'upi_prepaid') {
        // UPI Prepaid payment - redirect to UPI payment page
        if (!directPurchase) {
          await clearCart();
        }

        toast({
          title: "Redirecting to Payment",
          description: "Please complete the UPI payment",
        });

        navigate(`/upi-payment/${order._id}`, {
          state: {
            orderId: order._id,
            orderNumber: order.orderNumber,
            amount: total,
            estimatedDelivery: `${shippingEstimate.estimatedDeliveryDays} business days`,
            shippingZone: shippingEstimate.zone,
            zoneLabel: shippingEstimate.zoneLabel,
            suggestedCourier: shippingEstimate.courierFlags?.suggestedCourier,
          }
        });
      } else if (paymentMethod === 'paytm') {
        // Paytm payment gateway
        const paytmResponse = await api.paytm.createTransaction({ orderId: order._id });

        if (paytmResponse.success && paytmResponse.transaction.paymentUrl) {
          // Redirect to Paytm payment page (or mock page if in mock mode)
          window.location.href = paytmResponse.transaction.paymentUrl;
        } else {
          toast({
            title: "Payment Error",
            description: "Unable to initiate Paytm payment. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        // For Zoho online payments
        const paymentResponse = await api.createPaymentOrder({ orderId: order._id });

        // Redirect to Zoho payment page
        if (paymentResponse.success && paymentResponse.paymentOrder.paymentUrl) {
          window.location.href = paymentResponse.paymentOrder.paymentUrl;
        } else {
          toast({
            title: "Payment Error",
            description: "Unable to initiate payment. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error: unknown) {
      console.error('Error placing order:', error);

      // ── Structured backend error code handling ─────────────────────────────
      const errCode = (error as { code?: string; response?: { data?: { code?: string } } })?.code || (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const errMsg = (error as { message?: string; response?: { data?: { error?: string } } })?.message || (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Please try again';

      let title = "Failed to place order";
      let description = errMsg;

      if (errCode === 'COD_INELIGIBLE') {
        title = "COD Not Available";
        description = errMsg || "Cash on Delivery is not available for this order. Please choose UPI payment.";
        // Update local eligibility state
        setCodEligibility(prev => ({ ...prev, eligible: false, reason: errMsg }));
      } else if (errCode === 'PAYMENT_NOT_VERIFIED') {
        title = "Payment Not Verified";
        description = "Your payment has not been verified yet. Please wait for confirmation.";
      } else if (errCode === 'PARTIAL_PAYMENT') {
        title = "Partial Payment Detected";
        description = errMsg;
      } else if (errCode === 'DUPLICATE_UTR') {
        title = "Duplicate Transaction";
        description = "This UTR has already been used. Please contact support.";
      } else if (errMsg.includes('stock') || errMsg.includes('Stock')) {
        title = "Out of Stock";
        description = errMsg;
      }

      toast({ title, description, variant: "destructive" });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!directPurchase && cartLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {directPurchase ? 'Quick Checkout' : 'Checkout'}
            </h1>
            <p className="text-muted-foreground">
              {directPurchase
                ? 'Complete your purchase in just a few steps'
                : 'Complete your order in just a few steps'
              }
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Checkout Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Account — signed-in banner for authenticated users, Guest/Login tabs otherwise */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Account
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {user ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-green-900 dark:text-green-100 truncate">{user.name}</p>
                          <p className="text-xs text-green-700 dark:text-green-300 truncate">{user.email}</p>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex-shrink-0"
                        >
                          Signed In
                        </Badge>
                      </div>
                    ) : (
                      <Tabs value={isGuest ? "guest" : "login"} onValueChange={(value) => setIsGuest(value === "guest")}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="guest">Guest Checkout</TabsTrigger>
                          <TabsTrigger value="login">Login</TabsTrigger>
                        </TabsList>
                        <TabsContent value="guest" className="mt-4">
                          <div className="space-y-4">
                            <AnimatedInput
                              id="email"
                              label="Email Address"
                              type="email"
                              placeholder="your@email.com"
                              value={formData.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                            />
                          </div>
                        </TabsContent>
                        <TabsContent value="login" className="mt-4">
                          <LoginForm onSuccess={() => setIsGuest(false)} />
                        </TabsContent>
                      </Tabs>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Shipping Address */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Shipping Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {user ? (
                      user.address?.street ? (
                        /* ── Signed-in user WITH a saved address ── */
                        <>
                          {/* Saved address summary */}
                          {addressOption === 'saved' && (
                            <div className="mb-4 p-4 rounded-lg border bg-muted/40 space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                {formData.firstName} {formData.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">{user.address.street}</p>
                              <p className="text-sm text-muted-foreground">
                                {user.address.city}, {user.address.state} {user.address.zipCode}
                              </p>
                              {formData.phone && (
                                <p className="text-sm text-muted-foreground">{formData.phone}</p>
                              )}
                            </div>
                          )}

                          {/* Radio: keep saved vs use different */}
                          <RadioGroup
                            value={addressOption}
                            onValueChange={(v) => handleAddressOptionChange(v as 'saved' | 'new')}
                            className="space-y-2 mb-4"
                          >
                            <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:border-primary transition-colors">
                              <RadioGroupItem value="saved" id="addr-saved" className="mt-0.5" />
                              <Label htmlFor="addr-saved" className="flex-1 cursor-pointer">
                                <span className="font-medium text-sm">Deliver to my saved address</span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {user.address.street}, {user.address.city}, {user.address.state}
                                </p>
                              </Label>
                            </div>
                            <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:border-primary transition-colors">
                              <RadioGroupItem value="new" id="addr-new" className="mt-0.5" />
                              <Label htmlFor="addr-new" className="flex-1 cursor-pointer">
                                <span className="font-medium text-sm">Use a different address for this order</span>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Override your saved address for this order only
                                </p>
                              </Label>
                            </div>
                          </RadioGroup>

                          {/* Form fields — only when choosing a different address */}
                          {addressOption === 'new' && (
                            <div className="grid md:grid-cols-2 gap-4 pt-1">
                              <AnimatedInput
                                id="firstName"
                                label="First Name"
                                value={formData.firstName}
                                onChange={(e) => handleInputChange('firstName', e.target.value)}
                                required
                              />
                              <AnimatedInput
                                id="lastName"
                                label="Last Name"
                                value={formData.lastName}
                                onChange={(e) => handleInputChange('lastName', e.target.value)}
                                required
                              />
                              <div className="md:col-span-2">
                                <AnimatedInput
                                  id="phone"
                                  label="Phone Number"
                                  value={formData.phone}
                                  onChange={(e) => handleInputChange('phone', e.target.value)}
                                  placeholder="+91 1234567890"
                                  required
                                />
                              </div>
                              <div className="md:col-span-2">
                                <AnimatedInput
                                  id="address"
                                  label="Address"
                                  placeholder="Street address, apartment, suite, etc."
                                  value={formData.address}
                                  onChange={(e) => handleInputChange('address', e.target.value)}
                                  required
                                />
                              </div>
                              <AnimatedInput
                                id="city"
                                label="City"
                                value={formData.city}
                                onChange={(e) => handleInputChange('city', e.target.value)}
                                required
                              />
                              <AnimatedInput
                                id="state"
                                label="State"
                                value={formData.state}
                                onChange={(e) => handleInputChange('state', e.target.value)}
                                required
                              />
                              <AnimatedInput
                                id="pincode"
                                label="PIN Code"
                                value={formData.pincode}
                                onChange={(e) => handleInputChange('pincode', e.target.value)}
                                pattern="[0-9]{6}"
                                placeholder="123456"
                                required
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        /* ── Signed-in user WITHOUT a saved address ── */
                        <>
                          <div className="flex items-start gap-2 mb-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                              No shipping address found on your profile. Please enter one below — you can also save it permanently from your{' '}
                              <a href="/profile" className="underline underline-offset-2 font-medium">Profile</a>.
                            </span>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <AnimatedInput id="firstName" label="First Name" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} required />
                            <AnimatedInput id="lastName" label="Last Name" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} required />
                            <div className="md:col-span-2">
                              <AnimatedInput id="phone" label="Phone Number" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="+91 1234567890" required />
                            </div>
                            <div className="md:col-span-2">
                              <AnimatedInput id="address" label="Address" placeholder="Street address, apartment, suite, etc." value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} required />
                            </div>
                            <AnimatedInput id="city" label="City" value={formData.city} onChange={(e) => handleInputChange('city', e.target.value)} required />
                            <AnimatedInput id="state" label="State" value={formData.state} onChange={(e) => handleInputChange('state', e.target.value)} required />
                            <AnimatedInput id="pincode" label="PIN Code" value={formData.pincode} onChange={(e) => handleInputChange('pincode', e.target.value)} pattern="[0-9]{6}" placeholder="123456" required />
                          </div>
                        </>
                      )
                    ) : (
                      /* ── Guest user ── */
                      <div className="grid md:grid-cols-2 gap-4">
                        <AnimatedInput id="firstName" label="First Name" value={formData.firstName} onChange={(e) => handleInputChange('firstName', e.target.value)} required />
                        <AnimatedInput id="lastName" label="Last Name" value={formData.lastName} onChange={(e) => handleInputChange('lastName', e.target.value)} required />
                        <div className="md:col-span-2">
                          <AnimatedInput id="phone" label="Phone Number" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="+91 1234567890" required />
                        </div>
                        <div className="md:col-span-2">
                          <AnimatedInput id="address" label="Address" placeholder="Street address, apartment, suite, etc." value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} required />
                        </div>
                        <AnimatedInput id="city" label="City" value={formData.city} onChange={(e) => handleInputChange('city', e.target.value)} required />
                        <AnimatedInput id="state" label="State" value={formData.state} onChange={(e) => handleInputChange('state', e.target.value)} required />
                        <AnimatedInput id="pincode" label="PIN Code" value={formData.pincode} onChange={(e) => handleInputChange('pincode', e.target.value)} pattern="[0-9]{6}" placeholder="123456" required />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>              {/* Payment Options */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
              >
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <CreditCard className="w-5 h-5" />
                      Payment Method
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">
                      Choose your preferred payment method. We currently support Cash on Delivery and UPI payments.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                      {/* Primary Option 1: Cash on Delivery */}
                      <div className="flex items-start space-x-4 p-6 border-2 rounded-xl hover:border-primary hover:shadow-md transition-all cursor-pointer bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
                        <RadioGroupItem value="cod" id="cod" className="mt-1" />
                        <Label htmlFor="cod" className="flex-1 cursor-pointer">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2.5 bg-orange-100 dark:bg-orange-900 rounded-lg">
                                <Banknote className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-lg mb-1">Cash on Delivery</div>
                                <div className="text-sm text-muted-foreground leading-relaxed">
                                  Pay with cash when your order is delivered to your doorstep. No advance payment required.
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 ml-12">
                              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-3 py-1">
                                {codEligibility.loading ? 'Calculating fee...' : `₹${codEligibility.codFee} handling fee`}
                              </Badge>
                              <Badge variant="outline" className="text-xs px-3 py-1">
                                No advance payment
                              </Badge>
                            </div>
                          </div>
                        </Label>
                      </div>

                      {/* COD Eligibility Alerts — shown only when COD is selected */}
                      <AnimatePresence>
                        {paymentMethod === 'cod' && codEligibility.checked && !codEligibility.eligible && (
                          <motion.div
                            key="cod-ineligible"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                          >
                            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
                              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                                  COD not available for this order
                                </p>
                                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                                  {codEligibility.reason || 'Cash on Delivery is not available for this order.'}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setPaymentMethod('upi_prepaid')}
                                  className="mt-2 text-xs font-medium text-red-700 dark:text-red-300 underline underline-offset-2 hover:text-red-900"
                                >
                                  Switch to UPI Payment →
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {showHighValueCodWarning && (
                          <motion.div
                            key="cod-high-value"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                          >
                            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                                  High-value order — UPI recommended
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                                  For orders above ₹{HIGH_VALUE_WARNING.toLocaleString()}, we recommend UPI for faster processing and instant payment confirmation.
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Primary Option 2: UPI Payment */}
                      <div className="flex items-start space-x-4 p-6 border-2 rounded-xl hover:border-primary hover:shadow-md transition-all cursor-pointer bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                        <RadioGroupItem value="upi_prepaid" id="upi_prepaid" className="mt-1" />
                        <Label htmlFor="upi_prepaid" className="flex-1 cursor-pointer">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2.5 bg-green-100 dark:bg-green-900 rounded-lg">
                                <Smartphone className="w-6 h-6 text-green-600 dark:text-green-400" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-lg">UPI Payment</span>
                                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
                                    <Zap className="w-3 h-3 mr-1" />
                                    Instant
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground leading-relaxed">
                                  Pay instantly using Google Pay, PhonePe, Paytm, or any UPI app. Quick and secure digital payment.
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 ml-12">
                              <Badge variant="outline" className="text-xs px-3 py-1 border-green-200 text-green-700 dark:border-green-800 dark:text-green-300">
                                0% Fee
                              </Badge>
                              <Badge variant="outline" className="text-xs px-3 py-1 border-green-200 text-green-700 dark:border-green-800 dark:text-green-300">
                                Secure
                              </Badge>
                              <Badge variant="outline" className="text-xs px-3 py-1 border-green-200 text-green-700 dark:border-green-800 dark:text-green-300">
                                Instant confirmation
                              </Badge>
                            </div>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>

                    {/* Payment Info Note */}
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex gap-3">
                        <div className="text-blue-600 dark:text-blue-400 mt-0.5">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                            More payment options coming soon!
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                            We're working on adding credit/debit cards, net banking, and digital wallets. For now, enjoy the convenience of COD or the speed of UPI payments.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      Order Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Cart Items or Direct Purchase Item */}
                    {directPurchase && directProduct ? (
                      <motion.div
                        className="flex gap-3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.4 }}
                      >
                        <img
                          src={getImageUrl(directProduct.images[0] || "/placeholder.svg")}
                          alt={directProduct.name}
                          className="w-16 h-16 object-cover rounded-md"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{directProduct.name}</h4>
                          <p className="text-sm text-muted-foreground">Qty: {directQuantity}</p>
                          <p className="text-sm font-medium">₹{(directProduct.price * directQuantity).toLocaleString()}</p>
                        </div>
                      </motion.div>
                    ) : (
                      cart?.items.map((item, index) => (
                        <motion.div
                          key={item.productId.id}
                          className="flex gap-3"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                        >
                          <img
                            src={getImageUrl(item.productId.images[0] || "/placeholder.svg")}
                            alt={item.productId.name}
                            className="w-16 h-16 object-cover rounded-md"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm truncate">{item.productId.name}</h4>
                            <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                            <p className="text-sm font-medium">₹{(item.productId.price * item.quantity).toLocaleString()}</p>
                          </div>
                        </motion.div>
                      ))
                    ) || []}

                    <Separator />

                    {/* Price Breakdown Component */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.6 }}
                    >
                      <PriceBreakdown
                        subtotal={subtotal}
                        shipping={shipping}
                        codFee={codFee}
                        showCodFee={paymentMethod === 'cod'}
                        className="border-0 shadow-none p-0"
                        shippingBreakdown={shippingEstimate.breakdown}
                        courierFlags={shippingEstimate.courierFlags}
                        shippingLoading={shippingEstimate.loading}
                        estimatedDeliveryDays={shippingEstimate.estimatedDeliveryDays}
                      />
                    </motion.div>

                    {/* Place Order Button */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.8 }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Button
                          onClick={handlePlaceOrder}
                          className="w-full btn-hero mt-6"
                          size="lg"
                          disabled={isPlacingOrder || (paymentMethod === 'cod' && codEligibility.checked && !codEligibility.eligible)}
                        >
                          {isPlacingOrder ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Placing Order...
                            </>
                          ) : (
                            'Place Order'
                          )}
                        </Button>
                      </motion.div>
                    </motion.div>

                    <motion.div
                      className="text-xs text-muted-foreground text-center mt-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 1.0 }}
                    >
                      By placing your order, you agree to our Terms of Service and Privacy Policy
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}