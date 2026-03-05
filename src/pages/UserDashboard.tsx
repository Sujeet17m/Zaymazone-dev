import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { api, getImageUrl } from "@/lib/api";
import { CancellationFeeDialog } from "@/components/CancellationFeeDialog";
import { 
  User, 
  Package, 
  Heart, 
  MapPin, 
  Phone, 
  Mail, 
  Edit2, 
  Eye,
  ShoppingBag,
  Calendar,
  Loader2,
  Ban,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

interface WishlistItem {
  id: string;
  name: string;
  image: string;
  price: number;
}

interface Order {
  _id: string;
  orderNumber?: string;
  items: Array<{
    product: {
      _id: string;
      name: string;
      images: string[];
      price: number;
    };
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: 'pending' | 'placed' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned' | 'refunded' | 'rejected';
  createdAt: string;
  paymentMethod: string;
  paymentStatus: string;
  rejectionReason?: string;
  rejectedAt?: string;
  statusHistory?: Array<{ status: string; timestamp: string; note?: string; }>;
}

export default function UserDashboard() {
  const { user, updateUser, updateUserProfile, signOut } = useAuth();
  const { cart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "India"
    }
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderPaymentStatus, setOrderPaymentStatus] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadUserData();
    }
    // start polling for orders every 30s
    const interval = setInterval(() => {
      if (user) loadUserData();
    }, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedOrder) {
      const pollPaymentStatus = async () => {
        try {
          const result = await api.getPaymentStatus(selectedOrder._id);
          if (result.success) {
            setOrderPaymentStatus(result.payment.paymentStatus);
          }
        } catch (err) {
          console.error('Failed to poll payment status', err);
        }
      };
      pollPaymentStatus();
      const interval = setInterval(pollPaymentStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedOrder]);

  // keep local profileData in sync when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || {
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: "India"
        }
      });
    }
  }, [user]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Load orders and wishlist
      const [ordersData, wishlistData] = await Promise.all([
        api.getUserOrders(),
        api.getWishlist().catch(() => []) // Wishlist might not exist
      ]);
      
      // Transform API orders to match local Order interface
      type ApiOrderItem = { productId: string; name: string; image: string; price: number; quantity: number };
      type ApiOrder = { id: string; orderNumber?: string; items: ApiOrderItem[]; total: number; status: Order['status']; createdAt: string; paymentMethod: string; paymentStatus: string };
      const rawOrders = (ordersData.orders as unknown as ApiOrder[]) || [];
      const transformedOrders: Order[] = rawOrders.map((order) => ({
        _id: order.id,
        orderNumber: order.orderNumber,
        items: order.items.map((item: ApiOrderItem) => ({
          product: {
            _id: item.productId,
            name: item.name,
            images: [item.image],
            price: item.price
          },
          quantity: item.quantity,
          price: item.price
        })),
        totalAmount: order.total,
        status: order.status,
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus
      }));
      
      setOrders(transformedOrders);
      setWishlist((wishlistData || []) as unknown as WishlistItem[]);
    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: "Error loading data",
        description: "Failed to load your account information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uploadResult: any = await api.uploadImage(avatarFile);
        avatarUrl = uploadResult.url || uploadResult.data?.url || uploadResult.imageUrl || uploadResult["url"];
      }

      const payload: { name: string; phone: string; address: typeof profileData.address; avatar?: string } = {
        name: profileData.name,
        phone: profileData.phone,
        address: profileData.address,
      };
      if (avatarUrl) payload.avatar = avatarUrl;

      // call AuthContext's updateUserProfile which persists to backend and updates context
      if (updateUserProfile) {
        await updateUserProfile(payload);
      } else {
        // fallback: update local user
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateUser(profileData as any);
      }

      setAvatarFile(null);
      setEditingProfile(false);
      toast({ title: 'Profile updated', description: 'Your profile has been successfully updated' });
    } catch (err) {
      console.error('Profile update failed', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to update your profile';
      toast({ title: 'Error updating profile', description: errMsg, variant: 'destructive' });
    }
  };

  // removed dynamic helper; using updateUserProfile from AuthContext instead

  type BadgeConfig = { variant: "secondary" | "default" | "destructive"; text: string };
  const getStatusBadge = (status: string) => {
    const variants: Record<string, BadgeConfig> = {
      pending: { variant: "secondary", text: "Pending" },
      placed: { variant: "secondary", text: "Placed" },
      confirmed: { variant: "default", text: "Confirmed" },
      processing: { variant: "default", text: "Processing" },
      packed: { variant: "default", text: "Packed" },
      shipped: { variant: "default", text: "Shipped" },
      out_for_delivery: { variant: "default", text: "Out for Delivery" },
      delivered: { variant: "default", text: "Delivered" },
      returned: { variant: "secondary", text: "Returned" },
      refunded: { variant: "secondary", text: "Refunded" },
      cancelled: { variant: "destructive", text: "Cancelled" },
      rejected: { variant: "destructive", text: "Rejected" }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const [expandedTimelines, setExpandedTimelines] = useState<Set<string>>(new Set());

  const toggleTimeline = (orderId: string) => {
    setExpandedTimelines(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  // Module 5: open the cancellation-fee dialog instead of cancelling immediately
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    orderId: string;
    orderNumber: string;
  }>({ open: false, orderId: '', orderNumber: '' });

  const handleCancelOrder = (orderId: string) => {
    const order = orders.find(o => o._id === orderId);
    setCancelDialog({
      open: true,
      orderId,
      orderNumber: order?.orderNumber || orderId,
    });
  };

  const handlePayNow = async (orderId: string) => {
    try {
      const result = await api.createPaymentOrder({ orderId });
      if (result.success && result.paymentOrder.paymentUrl) {
        window.location.href = result.paymentOrder.paymentUrl;
      } else {
        toast({ title: 'Payment failed', description: 'Could not create payment order', variant: 'destructive' });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to initiate payment';
      toast({ title: 'Error', description: errMsg, variant: 'destructive' });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please sign in</h2>
          <p className="text-muted-foreground">You need to be logged in to access your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome, {user.name}! 👋
            </h1>
            <p className="text-muted-foreground">
              Manage your account, orders, and preferences
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{orders.length}</p>
                  </div>
                  <Package className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Cart Items</p>
                    <p className="text-2xl font-bold">{cart?.items.length || 0}</p>
                  </div>
                  <ShoppingBag className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Wishlist Items</p>
                    <p className="text-2xl font-bold">{wishlist.length}</p>
                  </div>
                  <Heart className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="orders" className="space-y-6">
            <TabsList className="grid w-full lg:w-auto grid-cols-3">
              <TabsTrigger value="orders" className="relative">
                My Orders
                {orders.filter(o => o.status === 'rejected').length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs w-5 h-5">
                    {orders.filter(o => o.status === 'rejected').length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
            </TabsList>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Order History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No orders yet</h3>
                      <p className="text-muted-foreground mb-4">Start shopping to see your orders here</p>
                      <Button asChild>
                        <a href="/products">Browse Products</a>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order._id} className={`border rounded-lg p-4 ${
                          order.status === 'rejected' ? 'ring-1 ring-red-300 border-red-200 bg-red-50/30' : ''
                        }`}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="font-medium">Order #{order._id.slice(-8)}</p>
                              <p className="text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                {new Date(order.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              {getStatusBadge(order.status)}
                              <p className="text-lg font-bold mt-1">₹{order.totalAmount.toLocaleString()}</p>
                            </div>
                          </div>

                          {/* Rejection Alert Banner */}
                          {order.status === 'rejected' && (
                            <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200">
                              <Ban className="h-4 w-4" />
                              <AlertTitle className="text-red-800 font-semibold">Order Rejected by Seller</AlertTitle>
                              <AlertDescription className="text-red-700">
                                {order.rejectionReason ? (
                                  <p className="mt-1">
                                    <span className="font-medium">Reason: </span>
                                    <em>"{order.rejectionReason}"</em>
                                  </p>
                                ) : (
                                  <p className="mt-1 text-sm">The seller has rejected this order.</p>
                                )}
                                {order.rejectedAt && (
                                  <p className="text-xs mt-1 text-red-500">
                                    Rejected on {new Date(order.rejectedAt).toLocaleString()}
                                  </p>
                                )}
                                <p className="text-xs mt-2 text-red-600">
                                  If a payment was made, a refund will be processed within 5–7 business days.
                                </p>
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          <div className="space-y-2">
                            {order.items.map((item) => (
                              <div key={item.product._id} className="flex items-center gap-3">
                                <img 
                                  src={getImageUrl(item.product.images[0] || "/placeholder.svg")} 
                                  alt={item.product.name}
                                  className="w-12 h-12 object-cover rounded"
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{item.product.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Qty: {item.quantity} × ₹{item.price.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Collapsible Status Timeline */}
                          {order.statusHistory && order.statusHistory.length > 0 && (
                            <div className="mb-4">
                              <button
                                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                                onClick={() => toggleTimeline(order._id)}
                              >
                                {expandedTimelines.has(order._id)
                                  ? <><ChevronUp className="w-3 h-3" /> Hide timeline</>
                                  : <><ChevronDown className="w-3 h-3" /> Show timeline ({order.statusHistory.length} events)</>}
                              </button>
                              {expandedTimelines.has(order._id) && (
                                <div className="mt-2 space-y-1 pl-2 border-l-2 border-muted">
                                  {[...order.statusHistory].reverse().map((event, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                                        event.status === 'rejected' ? 'bg-red-500' :
                                        event.status === 'delivered' ? 'bg-green-500' :
                                        i === 0 ? 'bg-primary' : 'bg-muted-foreground'
                                      }`} />
                                      <div>
                                        <span className="font-medium capitalize">{event.status.replace(/_/g, ' ')}</span>
                                        <span className="text-muted-foreground ml-2">{new Date(event.timestamp).toLocaleString()}</span>
                                        {event.status === 'rejected' && event.note && (
                                          <p className="text-red-600 mt-0.5">Reason: {event.note}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex justify-between items-center mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground">
                              Payment: {order.paymentMethod.toUpperCase()}
                            </p>
                            <div className="flex items-center gap-2">
                              {order.status === 'rejected' && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href="/products">Browse Similar</a>
                                </Button>
                              )}
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => setSelectedOrder(order)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </Button>
                              </DialogTrigger>
                              {order.paymentStatus === 'pending' && order.status !== 'rejected' && (
                                <Button size="sm" onClick={() => handlePayNow(order._id)}>
                                  Pay Now
                                </Button>
                              )}
                              {['placed', 'confirmed', 'processing'].includes(order.status) && (
                                <div className="flex flex-col items-end gap-0.5">
                                  {/* Module 10: Inline fee transparency hint */}
                                  {order.status === 'placed' && (
                                    <span className="text-[10px] font-medium text-green-600">Free cancel</span>
                                  )}
                                  {order.status === 'confirmed' && (
                                    <span className="text-[10px] font-medium text-orange-600">~2% fee</span>
                                  )}
                                  {order.status === 'processing' && (
                                    <span className="text-[10px] font-medium text-red-600">~5% fee</span>
                                  )}
                                  <Button size="sm" variant="destructive" onClick={() => handleCancelOrder(order._id)}>
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Profile Information
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingProfile(!editingProfile)}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      {editingProfile ? "Cancel" : "Edit"}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {editingProfile ? (
                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            name="name"
                            autoComplete="name"
                            value={profileData.name}
                            onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                          />
                        </div>
                          <div>
                            <Label htmlFor="avatar">Profile Picture</Label>
                            <input
                              id="avatar"
                              name="avatar"
                              type="file"
                              accept="image/*"
                              autoComplete="off"
                              onChange={(e) => setAvatarFile(e.target.files ? e.target.files[0] : null)}
                              className="block"
                              aria-label="Upload profile picture"
                            />
                            {avatarFile && (
                              <img src={URL.createObjectURL(avatarFile)} alt="preview" className="w-24 h-24 object-cover rounded mt-2" />
                            )}
                          </div>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            value={profileData.email}
                            onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            name="phone"
                            autoComplete="tel"
                            value={profileData.phone}
                            onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-4">
                        <h3 className="font-medium">Address Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <Label htmlFor="street">Street Address</Label>
                            <Input
                              id="street"
                              name="street"
                              autoComplete="address-line1"
                              value={profileData.address.street}
                              onChange={(e) => setProfileData({
                                ...profileData, 
                                address: {...profileData.address, street: e.target.value}
                              })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="city">City</Label>
                            <Input
                              id="city"
                              name="city"
                              autoComplete="address-level2"
                              value={profileData.address.city}
                              onChange={(e) => setProfileData({
                                ...profileData, 
                                address: {...profileData.address, city: e.target.value}
                              })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="state">State</Label>
                            <Input
                              id="state"
                              name="state"
                              autoComplete="address-level1"
                              value={profileData.address.state}
                              onChange={(e) => setProfileData({
                                ...profileData, 
                                address: {...profileData.address, state: e.target.value}
                              })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <Button type="submit">Save Changes</Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setEditingProfile(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Email</p>
                              <p className="font-medium">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">Phone</p>
                              <p className="font-medium">{profileData.phone || "Not provided"}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                            <div>
                              <p className="text-sm text-muted-foreground">Address</p>
                              <p className="font-medium">
                                {profileData.address.street || "No address provided"}
                              </p>
                              {profileData.address.city && (
                                <p className="text-sm text-muted-foreground">
                                  {profileData.address.city}, {profileData.address.state}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex justify-end">
                        <Button variant="destructive" onClick={handleSignOut}>
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Wishlist Tab */}
            <TabsContent value="wishlist">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    My Wishlist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {wishlist.length === 0 ? (
                    <div className="text-center py-8">
                      <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Your wishlist is empty</h3>
                      <p className="text-muted-foreground mb-4">Save items you love for later</p>
                      <Button asChild>
                        <a href="/products">Explore Products</a>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {wishlist.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4">
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-full h-48 object-cover rounded mb-3"
                          />
                          <h3 className="font-medium mb-2">{item.name}</h3>
                          <p className="text-lg font-bold text-primary mb-3">₹{item.price.toLocaleString()}</p>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1">Add to Cart</Button>
                            <Button variant="outline" size="sm">
                              <Heart className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Footer />

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              View detailed information about your order including items, status, and payment information.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <p><strong>Order ID:</strong> {selectedOrder._id}</p>
                <p><strong>Status:</strong> {selectedOrder.status}</p>
                <p><strong>Payment Status:</strong> {orderPaymentStatus || 'Loading...'}</p>
                <p><strong>Payment Method:</strong> {selectedOrder.paymentMethod}</p>
                <p><strong>Total:</strong> ₹{selectedOrder.totalAmount.toLocaleString()}</p>
                <p><strong>Created:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <h4 className="font-medium">Items:</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.product._id} className="flex items-center gap-3">
                      <img 
                        src={getImageUrl(item.product.images[0] || "/placeholder.svg")} 
                        alt={item.product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div>
                        <p className="font-medium text-sm">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} × ₹{item.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Module 5: Cancellation Fee Dialog */}
      <CancellationFeeDialog
        orderId={cancelDialog.orderId}
        orderNumber={cancelDialog.orderNumber}
        open={cancelDialog.open}
        onOpenChange={(open) => setCancelDialog(prev => ({ ...prev, open }))}
        onConfirmed={() => {
          toast({ title: 'Order cancelled', description: 'Your order has been cancelled.' });
          loadUserData();
        }}
      />
    </div>
  );
}