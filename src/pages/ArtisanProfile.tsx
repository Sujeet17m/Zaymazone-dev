import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  User,
  MapPin,
  Phone,
  Mail,
  Store,
  Package,
  Truck,
  CreditCard,
  Edit,
  Save,
  X,
  Camera,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Building,
  Hash,
  IdCard,
  Star,
  Globe,
  Instagram,
  Facebook,
  RefreshCw,
  Lock,
  Briefcase,
  Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/api';
// Module 11
import { VerificationTimeline } from '@/components/trust/VerificationTimeline';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ArtisanProfile {
  _id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  profilePic: string;
  shopName: string;
  sellerType: 'gst' | 'non-gst';
  village: string;
  district: string;
  state: string;
  pincode: string;
  gstNumber: string;
  panNumber: string;
  aadhaarNumber: string;
  productCategories: string[];
  productDescription: string;
  materials: string;
  priceRange: { min: number; max: number };
  stockQuantity: number;
  productPhotos: string[];
  shippingDetails: {
    pickupAddress?: { sameAsMain?: boolean; address?: string };
    dispatchTime: string;
    packagingType: string;
  };
  bankDetails: {
    accountNumber: string;
    ifscCode: string;
    bankName: string;
  };
  upiId: string;
  paymentFrequency: string;
  bio: string;
  experience: number;
  socials: { instagram: string; facebook: string; website: string };
  bannerImage?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  stats: {
    totalProducts: number;
    totalSales: number;
    averageRating: number;
    totalReviews: number;
  };
  pendingChanges?: {
    hasChanges: boolean;
    changedAt?: string;
    changedFields: string[];
  };
  createdAt: string;
  updatedAt: string;
}

interface EditData {
  profilePic: string;
  bannerImage: string;
  mobileNumber: string;
  email: string;
  bio: string;
  experience: number | '';
  socials: { instagram: string; facebook: string; website: string };
  shippingDetails: {
    pickupAddress: { sameAsMain: boolean; address: string };
    dispatchTime: string;
    packagingType: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── ReadOnlyField ─────────────────────────────────────────────────────────────
function ReadOnlyField({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <span className="text-sm font-medium">{value || <span className="text-muted-foreground/50 italic">Not provided</span>}</span>
        <Lock className="w-3 h-3 text-muted-foreground/30 ml-auto flex-shrink-0" />
      </div>
    </div>
  );
}

// ── Stars ────────────────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
// Compress banner to max 1400×350, WebP 80%
async function compressBanner(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_W = 1400;
      const MAX_H = 350;
      const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/webp', 0.80));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const ArtisanProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ArtisanProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');

  const defaultEdit = (p?: ArtisanProfile | null): EditData => ({
    profilePic:    p?.profilePic   ?? '',
    bannerImage:   p?.bannerImage  ?? '',
    mobileNumber:  p?.mobileNumber ?? '',
    email:         p?.email        ?? '',
    bio:           p?.bio          ?? '',
    experience:    p?.experience   ?? '',
    socials: {
      instagram: p?.socials?.instagram ?? '',
      facebook:  p?.socials?.facebook  ?? '',
      website:   p?.socials?.website   ?? '',
    },
    shippingDetails: {
      pickupAddress: {
        sameAsMain: p?.shippingDetails?.pickupAddress?.sameAsMain ?? true,
        address:    p?.shippingDetails?.pickupAddress?.address    ?? '',
      },
      dispatchTime:  p?.shippingDetails?.dispatchTime  ?? '',
      packagingType: p?.shippingDetails?.packagingType ?? '',
    },
  });

  const [editData, setEditData] = useState<EditData>(defaultEdit());

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadProfile = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiRequest<ArtisanProfile>('/api/artisans/profile', { method: 'GET', auth: true });
      setProfile(res);
      setEditData(defaultEdit(res));
    } catch {
      if (!silent) toast({ title: 'Error', description: 'Failed to load profile.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) loadProfile();
  }, [user, loadProfile]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStartEdit = () => {
    setEditData(defaultEdit(profile));
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditData(defaultEdit(profile));
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest('/api/artisans/profile', {
        method: 'PUT',
        body: {
          ...editData,
          experience: editData.experience === '' ? undefined : Number(editData.experience),
          bannerImage: editData.bannerImage || undefined,
        },
        auth: true,
      });
      toast({ title: 'Profile saved', description: 'Your changes have been saved.' });
      setEditing(false);
      loadProfile(true);
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 2 MB allowed.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => setEditData(d => ({ ...d, profilePic: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10 MB allowed for banner.', variant: 'destructive' });
      return;
    }
    try {
      const compressed = await compressBanner(file);
      setEditData(d => ({ ...d, bannerImage: compressed }));
    } catch {
      toast({ title: 'Error', description: 'Failed to process banner image.', variant: 'destructive' });
    }
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const setSocial = (key: keyof EditData['socials'], val: string) =>
    setEditData(d => ({ ...d, socials: { ...d.socials, [key]: val } }));

  const statusConfig = {
    approved: { icon: CheckCircle, label: 'Approved',       className: 'bg-green-100 text-green-800 border-green-200' },
    rejected: { icon: XCircle,     label: 'Rejected',       className: 'bg-red-100 text-red-800 border-red-200'       },
    pending:  { icon: Clock,       label: 'Pending Review', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your profile…</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <XCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl font-semibold mb-2">Profile Not Found</p>
            <p className="text-muted-foreground">Please complete your artisan registration first.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const StatusIcon = statusConfig[profile.approvalStatus].icon;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Pending changes notice */}
        {profile.pendingChanges?.hasChanges && (
          <div className="mb-6 flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Changes saved</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Your recent updates have been recorded.
                {profile.pendingChanges.changedAt &&
                  ` Last updated ${formatDate(profile.pendingChanges.changedAt)}.`}
              </p>
            </div>
          </div>
        )}

        {/* ── Banner ── */}
        <div className="relative w-full rounded-xl overflow-hidden mb-6 aspect-[4/1] min-h-[120px] max-h-[220px] bg-gradient-to-br from-primary/20 via-primary/10 to-orange-100 dark:from-primary/30 dark:via-primary/15 dark:to-orange-900/20">
          {(editing ? editData.bannerImage : profile.bannerImage) ? (
            <img
              src={editing ? editData.bannerImage : profile.bannerImage}
              alt="Shop banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-primary/40 select-none">
              <Camera className="w-8 h-8" />
              <span className="text-xs font-medium">{editing ? 'Click the button to add a banner' : 'No banner image'}</span>
            </div>
          )}

          {/* Gradient overlay at bottom for contrast */}
          {(editing ? editData.bannerImage : profile.bannerImage) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
          )}

          {/* Upload button — edit mode only */}
          {editing && (
            <>
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                aria-label="Change banner image"
                className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white text-xs font-medium backdrop-blur-sm transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                {editData.bannerImage ? 'Change Banner' : 'Add Banner'}
              </button>
              {editData.bannerImage && (
                <button
                  type="button"
                  onClick={() => setEditData(d => ({ ...d, bannerImage: '' }))}
                  aria-label="Remove banner image"
                  className="absolute top-3 right-36 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-red-600/80 text-white text-xs font-medium backdrop-blur-sm transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                id="artisan-banner-upload"
                name="banner-upload"
                aria-label="Banner image file input"
                onChange={handleBannerChange}
              />
            </>
          )}
        </div>

        {/* ── Hero header ── */}
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar className="w-24 h-24 ring-2 ring-border">
              <AvatarImage src={editing ? editData.profilePic : profile.profilePic} alt={profile.fullName} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {getInitials(profile.fullName)}
              </AvatarFallback>
            </Avatar>
            {editing && (
              <>
                <button
                  type="button"
                  aria-label="Upload profile picture"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  aria-label="Profile picture file input"
                />
              </>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-3 mb-1">
              <h1 className="text-3xl font-bold text-foreground">{profile.fullName}</h1>
              <Badge
                variant="outline"
                className={`mt-1 flex items-center gap-1 ${statusConfig[profile.approvalStatus].className}`}
              >
                <StatusIcon className="w-3 h-3" />
                {statusConfig[profile.approvalStatus].label}
              </Badge>
            </div>
            {profile.shopName && (
              <p className="text-base font-medium text-muted-foreground mb-1">{profile.shopName}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {(profile.village || profile.district || profile.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {[profile.village, profile.district, profile.state].filter(Boolean).join(', ')}
                  {profile.pincode && ` – ${profile.pincode}`}
                </span>
              )}
              {profile.experience > 0 && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {profile.experience} yr{profile.experience !== 1 ? 's' : ''} experience
                </span>
              )}
              {profile.createdAt && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Member since {formatDate(profile.createdAt)}
                </span>
              )}
            </div>
            {profile.bio && !editing && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl line-clamp-2">
                {profile.bio}
              </p>
            )}
          </div>

          {/* Edit controls */}
          <div className="flex gap-2 flex-shrink-0">
            {!editing ? (
              <Button onClick={handleStartEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Save Changes</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Products',    value: profile.stats.totalProducts,              icon: Package,    color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: 'Total Sales', value: formatCurrency(profile.stats.totalSales), icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Reviews',     value: profile.stats.totalReviews,               icon: FileText,   color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Rating',      value: profile.stats.averageRating.toFixed(1),   icon: Star,       color: 'text-yellow-600', bg: 'bg-yellow-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold mt-1">{value}</p>
                    {label === 'Rating' && <Stars rating={profile.stats.averageRating} />}
                  </div>
                  <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="shipping">Shipping</TabsTrigger>
            <TabsTrigger value="banking">Banking</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
          </TabsList>

          {/* ── Personal Info ── */}
          <TabsContent value="personal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Personal Information</CardTitle>
                <CardDescription>Contact details and public bio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ReadOnlyField label="Full Name" value={profile.fullName} icon={User} />

                  <div>
                    <Label className="text-xs text-muted-foreground font-medium">Email Address</Label>
                    {editing ? (
                      <Input id="artisan-email" name="email" type="email" autoComplete="email" className="mt-1" value={editData.email}
                        onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium">{profile.email}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground font-medium">Mobile Number</Label>
                    {editing ? (
                      <Input id="artisan-mobile" name="mobileNumber" type="tel" autoComplete="tel" className="mt-1" value={editData.mobileNumber}
                        onChange={e => setEditData(d => ({ ...d, mobileNumber: e.target.value }))} />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium">{profile.mobileNumber || <span className="text-muted-foreground/50 italic">Not provided</span>}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground font-medium">Years of Experience</Label>
                    {editing ? (
                      <Input id="artisan-experience" name="experience" type="number" min={0} max={100} autoComplete="off" className="mt-1" value={editData.experience}
                        onChange={e => setEditData(d => ({ ...d, experience: e.target.value === '' ? '' : Number(e.target.value) }))} />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium">
                          {profile.experience ? `${profile.experience} years` : <span className="text-muted-foreground/50 italic">Not specified</span>}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Address</p>
                    <Lock className="w-3 h-3 text-muted-foreground/30" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Village/Town', value: profile.village },
                      { label: 'District',     value: profile.district },
                      { label: 'State',        value: profile.state },
                      { label: 'Pincode',      value: profile.pincode },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-xs text-muted-foreground font-medium">Bio / About Yourself</Label>
                  {editing ? (
                    <>
                      <Textarea className="mt-1 resize-none" rows={4} maxLength={1000}
                        placeholder="Tell customers about yourself, your craft, and what makes your work special…"
                        value={editData.bio}
                        onChange={e => setEditData(d => ({ ...d, bio: e.target.value }))} />
                      <p className="text-xs text-muted-foreground/60 mt-1 text-right">{editData.bio.length}/1000</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {profile.bio || <span className="italic opacity-50">No bio added yet. Click Edit Profile to add one.</span>}
                    </p>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-semibold mb-3">Social Links</p>
                  {editing ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Instagram className="w-3 h-3" /> Instagram URL
                        </Label>
                        <Input className="mt-1" type="url" placeholder="https://instagram.com/yourhandle"
                          value={editData.socials.instagram} onChange={e => setSocial('instagram', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Facebook className="w-3 h-3" /> Facebook URL
                        </Label>
                        <Input className="mt-1" type="url" placeholder="https://facebook.com/yourpage"
                          value={editData.socials.facebook} onChange={e => setSocial('facebook', e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Website URL
                        </Label>
                        <Input className="mt-1" type="url" placeholder="https://yourwebsite.com"
                          value={editData.socials.website} onChange={e => setSocial('website', e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {profile.socials?.instagram && (
                        <a href={profile.socials.instagram} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 hover:bg-pink-100 transition-colors">
                          <Instagram className="w-4 h-4" /> Instagram
                        </a>
                      )}
                      {profile.socials?.facebook && (
                        <a href={profile.socials.facebook} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors">
                          <Facebook className="w-4 h-4" /> Facebook
                        </a>
                      )}
                      {profile.socials?.website && (
                        <a href={profile.socials.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors">
                          <Globe className="w-4 h-4" /> Website
                        </a>
                      )}
                      {!profile.socials?.instagram && !profile.socials?.facebook && !profile.socials?.website && (
                        <p className="text-sm text-muted-foreground/50 italic">No social links added yet.</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Business ── */}
          <TabsContent value="business" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Store className="w-5 h-5" />Business Information</CardTitle>
                <CardDescription>Shop, registration, and compliance details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ReadOnlyField label="Shop Name" value={profile.shopName} icon={Store} />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Seller Type</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={profile.sellerType === 'gst' ? 'default' : 'secondary'}>
                        {profile.sellerType === 'gst' ? 'GST Registered' : 'Non-GST Seller'}
                      </Badge>
                      <Lock className="w-3 h-3 text-muted-foreground/30" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {profile.sellerType === 'gst' ? 'GST Registered Seller Details' : 'Non-GST Seller Details'}
                    <Lock className="w-3 h-3 text-muted-foreground/30" />
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {profile.sellerType === 'gst' ? (
                      <>
                        <ReadOnlyField label="GST Number" value={profile.gstNumber} icon={Hash} />
                        <ReadOnlyField label="PAN Number"  value={profile.panNumber}  icon={IdCard} />
                      </>
                    ) : (
                      <>
                        <ReadOnlyField label="Aadhaar Number" value={profile.aadhaarNumber} icon={IdCard} />
                        <ReadOnlyField label="PAN Number"     value={profile.panNumber}     icon={IdCard} />
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground/60 italic mt-3">
                    Document details are locked for security. Contact support to request changes.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Products ── */}
          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" />Product Information</CardTitle>
                <CardDescription>Categories, materials, and pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1">
                    Product Categories <Lock className="w-3 h-3 text-muted-foreground/30" />
                  </p>
                  {profile.productCategories?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.productCategories.map((cat, i) => (
                        <Badge key={i} variant="secondary">{cat}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground/50 italic">No categories specified.</p>
                  )}
                </div>
                {profile.productDescription && (
                  <><Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
                      Product Description <Lock className="w-3 h-3 text-muted-foreground/30" />
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{profile.productDescription}</p>
                  </div></>
                )}
                {profile.materials && (
                  <><Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
                      Materials Used <Lock className="w-3 h-3 text-muted-foreground/30" />
                    </p>
                    <p className="text-sm text-muted-foreground">{profile.materials}</p>
                  </div></>
                )}
                {(profile.priceRange?.min || profile.priceRange?.max) && (
                  <><Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Min Price</p>
                      <p className="text-sm font-medium mt-0.5">{formatCurrency(profile.priceRange.min)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Max Price</p>
                      <p className="text-sm font-medium mt-0.5">{formatCurrency(profile.priceRange.max)}</p>
                    </div>
                  </div></>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Shipping ── */}
          <TabsContent value="shipping" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Truck className="w-5 h-5" />Shipping & Delivery</CardTitle>
                <CardDescription>Pickup address and dispatch preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-xs text-muted-foreground font-medium">Pickup Address</Label>
                  {editing ? (
                    <div className="mt-2 space-y-3">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="sameAsMain" aria-label="Same as main address" className="w-4 h-4 accent-primary"
                          checked={editData.shippingDetails.pickupAddress.sameAsMain}
                          onChange={e => setEditData(d => ({
                            ...d,
                            shippingDetails: {
                              ...d.shippingDetails,
                              pickupAddress: { ...d.shippingDetails.pickupAddress, sameAsMain: e.target.checked },
                            },
                          }))} />
                        <Label htmlFor="sameAsMain" className="cursor-pointer text-sm">Same as main address</Label>
                      </div>
                      {!editData.shippingDetails.pickupAddress.sameAsMain && (
                        <Textarea rows={3} placeholder="Enter pickup address" className="resize-none"
                          value={editData.shippingDetails.pickupAddress.address}
                          onChange={e => setEditData(d => ({
                            ...d,
                            shippingDetails: {
                              ...d.shippingDetails,
                              pickupAddress: { ...d.shippingDetails.pickupAddress, address: e.target.value },
                            },
                          }))} />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm mt-1 text-muted-foreground">
                      {profile.shippingDetails?.pickupAddress?.sameAsMain
                        ? 'Same as main address'
                        : profile.shippingDetails?.pickupAddress?.address || '—'}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium">Dispatch Time</Label>
                    {editing ? (
                      <Input className="mt-1" placeholder="e.g., 2–3 business days"
                        value={editData.shippingDetails.dispatchTime}
                        onChange={e => setEditData(d => ({
                          ...d,
                          shippingDetails: { ...d.shippingDetails, dispatchTime: e.target.value },
                        }))} />
                    ) : (
                      <p className="text-sm mt-1 text-muted-foreground">{profile.shippingDetails?.dispatchTime || '—'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground font-medium">Packaging Type</Label>
                    {editing ? (
                      <Input className="mt-1" placeholder="e.g., Eco-friendly kraft boxes"
                        value={editData.shippingDetails.packagingType}
                        onChange={e => setEditData(d => ({
                          ...d,
                          shippingDetails: { ...d.shippingDetails, packagingType: e.target.value },
                        }))} />
                    ) : (
                      <p className="text-sm mt-1 text-muted-foreground">{profile.shippingDetails?.packagingType || '—'}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Banking ── */}
          <TabsContent value="banking" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5" />Banking Details</CardTitle>
                <CardDescription>Payment and settlement information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ReadOnlyField label="Bank Name" value={profile.bankDetails?.bankName} icon={Building} />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Account Number</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-medium">
                        {profile.bankDetails?.accountNumber
                          ? `${'•'.repeat(Math.max(0, profile.bankDetails.accountNumber.length - 4))}${profile.bankDetails.accountNumber.slice(-4)}`
                          : <span className="text-muted-foreground/50 italic font-sans">Not provided</span>}
                      </span>
                      <Lock className="w-3 h-3 text-muted-foreground/30 ml-auto" />
                    </div>
                  </div>
                  <ReadOnlyField label="IFSC Code" value={profile.bankDetails?.ifscCode} icon={Hash} />
                  <ReadOnlyField label="UPI ID"    value={profile.upiId}                  icon={CreditCard} />
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Banking details are locked for security. Contact support to update them.</p>
                </div>
                {profile.paymentFrequency && (
                  <><Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Payment Frequency</p>
                    <p className="text-sm font-medium">{profile.paymentFrequency}</p>
                  </div></>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Verification (Module 11) ── */}
          <TabsContent value="verification" className="space-y-6">
            <VerificationTimeline
              approvalStatus={profile.approvalStatus}
              createdAt={profile.createdAt}
            />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default ArtisanProfile;
