import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Heart,
  ShoppingBag,
  Edit,
  Save,
  Camera,
  Loader2,
  X,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { getImageUrl, api, imagesApi } from "@/lib/api";

// ── Client-side image compression ────────────────────────────────────────────
async function compressImage(file: File, maxSizePx = 512, quality = 0.80): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxSizePx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
            type: 'image/webp', lastModified: Date.now()
          }));
        },
        'image/webp',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}
import { useAuth } from "@/contexts/AuthContext";
import { ProfileCompletionBar } from "@/components/profile/ProfileCompletionBar";
import { ProfilePreviewCard } from "@/components/profile/ProfilePreviewCard";
import { SensitiveChangeModal } from "@/components/profile/SensitiveChangeModal";
import type { SensitiveField } from "@/components/profile/SensitiveChangeModal";

interface OrderItem {
  product?: string;
  name?: string;
  quantity?: number;
  price?: number;
}

interface Order {
  id?: string;
  _id?: string;
  createdAt: string;
  total?: number;
  status: string;
  items?: OrderItem[];
}

interface WishlistItem {
  id?: string;
  _id?: string;
  productId?: {
    _id?: string;
    name?: string;
    images?: string[];
    price?: number;
    artisan?: { name?: string };
  };
  name?: string;
  image?: string;
  artisan?: { name?: string };
  price?: number;
}

// ── Validation helpers ───────────────────────────────────────────────────────
const PHONE_RE  = /^[\d\s\-+().]{7,20}$/;
const ZIP_RE    = /^[A-Za-z0-9\s-]{3,12}$/;

type UserDataShape = {
  name: string; email: string; phone: string;
  street: string; city: string; state: string; zipCode: string; country: string;
  bio: string; joinDate: string; avatar: string;
};

const BIO_KEY = (userId: string) => `profile_bio_${userId}`;

const Profile = () => {
  const { user, updateUserProfile } = useAuth();

  // ── Edit / save state ────────────────────────────────────────────────────
  const [isEditing, setIsEditing]           = useState(false);
  const [isSaving, setIsSaving]             = useState(false);
  const [loading, setLoading]               = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  // Draft data (mutated while editing; reverted on cancel)
  const [userData, setUserData]             = useState<UserDataShape>({
    name: "", email: "", phone: "", street: "", city: "", state: "",
    zipCode: "", country: "India", bio: "", joinDate: "", avatar: ""
  });
  // Snapshot of last-saved values — used to detect changes & enable cancel
  const savedData                           = useRef<UserDataShape>(userData);
  const avatarInputRef                      = useRef<HTMLInputElement>(null);
  // Per-field validation errors
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof UserDataShape, string>>>({});

  // ── Approval-flow state ──────────────────────────────────────────────────
  const [showSensitiveModal, setShowSensitiveModal] = useState(false);
  const pendingSavePayload = useRef<Parameters<typeof updateUserProfile>[0] | null>(null);

  const [orders, setOrders]   = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [stats, setStats]     = useState({
    totalOrders: 0, totalSpent: 0, wishlistItems: 0, memberSince: ""
  });

  useEffect(() => {
    if (user) {
      loadUserData();
    }
    // loadUserData is stable per-user and defined below; disabling to avoid circular dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Restore bio from localStorage (bio is not a backend field for regular users)
      const storedBio = user?.id ? (localStorage.getItem(BIO_KEY(user.id)) ?? '') : '';

      const freshData: UserDataShape = {
        name:     user?.name     || "",
        email:    user?.email    || "",
        phone:    user?.phone    || "",
        street:   user?.address?.street  || "",
        city:     user?.address?.city    || "",
        state:    user?.address?.state   || "",
        zipCode:  user?.address?.zipCode || "",
        country:  user?.address?.country || "India",
        bio:      storedBio || "",
        joinDate: user?.createdAt
          ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : "",
        avatar:   user?.avatar || "",
      };

      setUserData(freshData);
      savedData.current = freshData;

      // Load orders and wishlist in parallel
      const [ordersData, wishlistData] = await Promise.all([
        api.getUserOrders().catch(() => ({ orders: [] })),
        api.getWishlist().catch(() => [])
      ]);

      setOrders(ordersData.orders || []);
      const wishlistData2 = wishlistData as { products?: WishlistItem[] };
      const wishlistItems: WishlistItem[] = Array.isArray(wishlistData)
        ? (wishlistData as WishlistItem[])
        : (wishlistData2?.products && Array.isArray(wishlistData2.products)
           ? wishlistData2.products
           : []);
      setWishlist(wishlistItems);

      const totalSpent = (ordersData.orders as Order[] || []).reduce(
        (sum: number, order: Order) => sum + (order.total || 0), 0
      );
      setStats({
        totalOrders:  ordersData.orders?.length || 0,
        totalSpent,
        wishlistItems: wishlistItems.length || 0,
        memberSince:  user?.createdAt
          ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : "",
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Partial<Record<keyof UserDataShape, string>> = {};
    if (!userData.name.trim())                                    errs.name    = 'Name is required';
    if (userData.phone && !PHONE_RE.test(userData.phone))         errs.phone   = 'Enter a valid phone number';
    if (userData.zipCode && !ZIP_RE.test(userData.zipCode))       errs.zipCode = 'Enter a valid ZIP / PIN';
    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Cancel edit ───────────────────────────────────────────────────────────
  const handleCancel = () => {
    setUserData(savedData.current);   // revert all draft changes
    setValidationErrors({});
    setIsEditing(false);
  };

  // ── Avatar / profile picture upload ─────────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';         // allow re-selecting the same file
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG, WebP, etc.)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be smaller than 10 MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Compress to 512×512 WebP before uploading
      const compressed = await compressImage(file, 512, 0.80);
      const result = await imagesApi.upload(compressed);
      // Server returns { success, image: { id, filename, url, ... } }
      const avatarUrl: string = result?.image?.url || result?.image?.filename || result?.url || result?.filename;
      if (!avatarUrl) throw new Error('No URL returned from upload');
      await updateUserProfile({ avatar: avatarUrl });
      setUserData(prev => ({ ...prev, avatar: avatarUrl }));
      savedData.current = { ...savedData.current, avatar: avatarUrl };
      toast.success('Profile picture updated!');
    } catch (err) {
      console.error('Avatar upload failed:', err);
      toast.error('Failed to upload profile picture — please try again');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // ── Detect sensitive (phone) changes ─────────────────────────────────────
  const getSensitiveChanges = () => {
    const changes: { field: SensitiveField; oldValue: string; newValue: string }[] = [];
    if (userData.phone.trim() !== savedData.current.phone.trim()) {
      changes.push({ field: 'phone', oldValue: savedData.current.phone, newValue: userData.phone.trim() });
    }
    return changes;
  };

  // ── Core save ────────────────────────────────────────────────────────────
  const doActualSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name:    userData.name.trim(),
        phone:   userData.phone.trim(),
        address: {
          street:  userData.street.trim(),
          city:    userData.city.trim(),
          state:   userData.state.trim(),
          zipCode: userData.zipCode.trim(),
          country: userData.country.trim() || 'India',
        },
      };

      // Persist bio locally (not a backend field for Firebase users)
      if (user?.id) {
        localStorage.setItem(BIO_KEY(user.id), userData.bio.trim());
      }

      await updateUserProfile(payload);

      // Commit the saved snapshot
      savedData.current = { ...userData };
      setValidationErrors({});
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Profile update failed:', error);
      toast.error('Failed to update profile — please try again');
    } finally {
      setIsSaving(false);
      setShowSensitiveModal(false);
    }
  };

  // ── Handle save button click ──────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the highlighted errors before saving');
      return;
    }

    const sensitiveChanges = getSensitiveChanges();
    if (sensitiveChanges.length > 0) {
      // Show confirmation modal first
      pendingSavePayload.current = null;   // signal to use current userData
      setShowSensitiveModal(true);
      return;
    }

    await doActualSave();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Delivered": return <Badge variant="default">Delivered</Badge>;
      case "Shipped": return <Badge variant="secondary">Shipped</Badge>;
      case "Processing": return <Badge variant="outline">Processing</Badge>;
      default: return <Badge variant="destructive">Pending</Badge>;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please sign in</h2>
            <p className="text-muted-foreground">You need to be logged in to access your profile</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your personal details</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                    <Button
                      variant={isEditing ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                      ) : isEditing ? (
                        <><Save className="w-4 h-4 mr-2" />Save changes</>
                      ) : (
                        <><Edit className="w-4 h-4 mr-2" />Edit profile</>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <Avatar className="w-20 h-20">
                        <AvatarImage src={userData.avatar ? getImageUrl(userData.avatar) : getImageUrl('/assets/user-avatar.jpg')} />
                        <AvatarFallback>{userData.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      {/* Hidden file input for avatar */}
                      <input
                        ref={avatarInputRef}
                        type="file"
                        id="profile-avatar-upload"
                        name="avatar-upload"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        title="Upload profile picture"
                        aria-label="Upload profile picture"
                        autoComplete="off"
                        onChange={handleAvatarUpload}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0"
                        aria-label="Change profile picture"
                        disabled={isUploadingAvatar}
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {isUploadingAvatar
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Camera className="w-3 h-3" />}
                      </Button>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{userData.name}</h3>
                      <p className="text-sm text-muted-foreground">Customer since {userData.joinDate}</p>
                      <Badge variant="secondary" className="mt-1">Verified Customer</Badge>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        name="name"
                        autoComplete="name"
                        value={userData.name}
                        disabled={!isEditing}
                        onChange={(e) => setUserData({...userData, name: e.target.value})}
                        className={validationErrors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
                      />
                      {validationErrors.name && (
                        <p className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="w-3 h-3" />{validationErrors.name}
                        </p>
                      )}
                    </div>

                    {/* Email — always read-only */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-1.5">
                        Email
                        <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                          <Lock className="w-3 h-3" />
                          <span>Identity-verified</span>
                        </span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          value={userData.email}
                          disabled
                          className="pr-8 bg-muted/50 cursor-not-allowed"
                        />
                        <ShieldCheck className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-xs text-muted-foreground">Email changes require identity verification. Contact support.</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Phone — sensitive field */}
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        Phone Number
                        {isEditing && userData.phone !== savedData.current.phone && (
                          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50 gap-1">
                            <AlertCircle className="w-3 h-3" />Sensitive — will confirm
                          </Badge>
                        )}
                      </Label>
                      <Input
                        id="phone"
                        name="phone"
                        autoComplete="tel"
                        value={userData.phone}
                        disabled={!isEditing}
                        onChange={(e) => setUserData({...userData, phone: e.target.value})}
                        className={validationErrors.phone ? 'border-destructive focus-visible:ring-destructive' : ''}
                        placeholder="+91 98765 43210"
                      />
                      {validationErrors.phone && (
                        <p className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="w-3 h-3" />{validationErrors.phone}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="street">Street Address</Label>
                      <Input 
                        id="street"
                        name="street"
                        autoComplete="address-line1"
                        value={userData.street}
                        disabled={!isEditing}
                        placeholder="123 Main St"
                        onChange={(e) => setUserData({...userData, street: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input 
                        id="city"
                        name="city"
                        autoComplete="address-level2"
                        value={userData.city}
                        disabled={!isEditing}
                        onChange={(e) => setUserData({...userData, city: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input 
                        id="state"
                        name="state"
                        autoComplete="address-level1"
                        value={userData.state}
                        disabled={!isEditing}
                        onChange={(e) => setUserData({...userData, state: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP / PIN Code</Label>
                      <Input
                        id="zipCode"
                        name="zipCode"
                        autoComplete="postal-code"
                        value={userData.zipCode}
                        disabled={!isEditing}
                        onChange={(e) => setUserData({...userData, zipCode: e.target.value})}
                        className={validationErrors.zipCode ? 'border-destructive focus-visible:ring-destructive' : ''}
                        placeholder="400 001"
                      />
                      {validationErrors.zipCode && (
                        <p className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="w-3 h-3" />{validationErrors.zipCode}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input 
                        id="country"
                        name="country"
                        autoComplete="country-name"
                        value={userData.country}
                        disabled={!isEditing}
                        onChange={(e) => setUserData({...userData, country: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">About Me</Label>
                    <Textarea 
                      id="bio"
                      name="bio"
                      autoComplete="off"
                      value={userData.bio}
                      disabled={!isEditing}
                      onChange={(e) => setUserData({...userData, bio: e.target.value})}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {/* ── Profile Completion ── */}
                <ProfileCompletionBar
                  data={userData}
                  onEditClick={() => setIsEditing(true)}
                />

                {/* ── Live Preview (visible only while editing) ── */}
                {isEditing && (
                  <ProfilePreviewCard
                    data={{ ...userData, email: userData.email }}
                    editing
                  />
                )}

                {/* ── Account Stats ── */}
                {!isEditing && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Account Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        ['Total Orders',  stats.totalOrders],
                        ['Total Spent',   `₹${stats.totalSpent.toLocaleString()}`],
                        ['Wishlist Items', stats.wishlistItems],
                        ['Member Since',  stats.memberSince || '—'],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-semibold">{value}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* ── Contact Info ── */}
                {!isEditing && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Contact Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{userData.email}</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>{userData.phone || <em className="text-muted-foreground">Not set</em>}</span>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                        <span>{[userData.street, userData.city, userData.state, userData.zipCode].filter(Boolean).join(', ') || <em className="text-muted-foreground">No address set</em>}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>Joined {userData.joinDate || '—'}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>View and track your recent orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No orders yet</h3>
                      <p className="text-muted-foreground">Start shopping to see your orders here</p>
                    </div>
                  ) : (
                    orders.map((order: Order) => (
                      <div key={order.id || order._id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-foreground">#{(order.id || order._id)?.slice(-8)}</p>
                            <p className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {order.items?.length || 0} item{(order.items?.length || 0) > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold text-foreground">₹{(order.total || 0).toLocaleString()}</p>
                            {getStatusBadge(order.status)}
                          </div>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wishlist" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Wishlist</CardTitle>
                <CardDescription>Items you've saved for later</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {loading ? (
                    <div className="flex items-center justify-center py-8 col-span-full">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  ) : wishlist.length === 0 ? (
                    <div className="text-center py-8 col-span-full">
                      <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Your wishlist is empty</h3>
                      <p className="text-muted-foreground">Save items you love for later</p>
                    </div>
                  ) : (
                    wishlist.map((item: WishlistItem) => (
                      <Card key={item.productId?._id || item.id || item._id} className="overflow-hidden">
                        <div className="aspect-square bg-muted">
                          <img 
                            src={getImageUrl(item.productId?.images?.[0] || item.image || '/placeholder.svg')} 
                            alt={item.productId?.name || item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-medium text-foreground mb-1">{item.productId?.name || item.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">by {item.productId?.artisan?.name || item.artisan?.name || 'Unknown Artisan'}</p>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">₹{(item.productId?.price || item.price || 0).toLocaleString()}</span>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">
                                <Heart className="w-4 h-4" />
                              </Button>
                              <Button size="sm">
                                <ShoppingBag className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>Manage your preferences and security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium text-foreground mb-4">Notifications</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Order updates</span>
                      <Button variant="outline" size="sm">Enabled</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>New product alerts</span>
                      <Button variant="outline" size="sm">Enabled</Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Marketing emails</span>
                      <Button variant="outline" size="sm">Disabled</Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium text-foreground mb-4">Security</h3>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      Change Password
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Two-Factor Authentication
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Download My Data
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-medium text-foreground mb-4">Danger Zone</h3>
                  <Button variant="destructive" className="w-full">
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Module 10: Sensitive-change approval modal ── */}
      <SensitiveChangeModal
        open={showSensitiveModal}
        changes={getSensitiveChanges()}
        saving={isSaving}
        onConfirm={doActualSave}
        onCancel={() => setShowSensitiveModal(false)}
      />

      <Footer />
    </div>
  );
};

export default Profile;