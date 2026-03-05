import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Loader2,
  CheckCircle,
  XCircle,
  Shield,
  FileText,
  Truck,
  Package as PackageIcon,
  ZoomIn,
  Bell
} from "lucide-react";
import { adminService } from "@/services/adminService";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from '@/components/ImageUpload';
import { DocumentPreview } from '@/components/admin/DocumentPreview';

interface User {
  _id: string;
  name: string;
  email: string;
  role?: string;
}

interface Artisan {
  _id: string;
  name: string;
  email: string;
  bio: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
  avatar: string;
  coverImage: string;
  specialties: string[];
  experience: number;
  rating: number;
  totalRatings: number;
  totalProducts: number;
  userId?: string;
  phone?: string;
  website?: string;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
  };
  businessDetails?: {
    businessName?: string;
    gstNumber?: string;
    businessType?: string;
  };
  verification: {
    isVerified: boolean;
    verifiedAt?: Date;
    documentType?: string;
    documentNumber?: string;
    bankDetails?: {
      accountNumber?: string;
      ifscCode?: string;
      bankName?: string;
    };
  };
  businessInfo?: {
    businessName?: string;
    sellerType?: string;
    gstNumber?: string;
    panNumber?: string;
    contact?: {
      email?: string;
      phone?: string;
      address?: {
        village?: string;
        district?: string;
        state?: string;
        pincode?: string;
      };
    };
  };
  productInfo?: {
    description?: string;
    materials?: string;
    priceRange?: {
      min: number;
      max: number;
    };
    stockQuantity?: number;
    photos?: string[];
  };
  documents?: {
    gstCertificate?: string;
    aadhaarProof?: string;
    craftVideo?: string;
  };
  logistics?: {
    pickupAddress?: {
      sameAsMain?: boolean;
      address?: string;
    };
    dispatchTime?: string;
    packagingType?: string;
  };
  payment?: {
    upiId?: string;
    paymentFrequency?: string;
  };
  documentVerification?: {
    profilePhoto: boolean;
    gstCertificate: boolean;
    aadhaarProof: boolean;
    craftVideo: boolean;
    productPhotos: boolean;
    bankDetails: boolean;
  };
  approvalStatus?: string;
  approvalNotes?: string;
  approvedAt?: Date;
  approvedBy?: string;
  isActive: boolean;
  joinedDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
  pendingChanges?: {
    hasChanges: boolean;
    changedAt?: string;
    changedFields: string[];
    changes?: any;
  };
}

export function ArtisanManagement() {
  const queryClient = useQueryClient();
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isVerificationDialogOpen, setIsVerificationDialogOpen] = useState(false);
  const [editingArtisan, setEditingArtisan] = useState<Artisan | null>(null);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [verificationData, setVerificationData] = useState({
    profilePhoto: false,
    gstCertificate: false,
    aadhaarProof: false,
    craftVideo: false,
    productPhotos: false,
    bankDetails: false,
    isVerified: false
  });
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    city: "",
    state: "",
    country: "India",
    avatar: [] as string[],
    coverImage: [] as string[],
    specialties: "",
    experience: "",
    userId: "",
    phone: "",
    email: "",
    website: "",
    socialMedia: {
      instagram: "",
      facebook: "",
      twitter: ""
    },
    businessDetails: {
      businessName: "",
      gstNumber: "",
      businessType: ""
    },
    isVerified: false,
    isActive: true
  });
  const { toast } = useToast();

  const loadUsers = useCallback(async () => {
    try {
      const response = await adminService.getUsers();
      setUsers(response.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  const loadArtisans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminService.getArtisans({
        search: searchTerm || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined
      });
      setArtisans(response.artisans || []);
    } catch (error) {
      console.error('Error loading artisans:', error);
      toast({
        title: "Error",
        description: "Failed to load artisans data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, toast]);

  useEffect(() => {
    loadArtisans();
    loadUsers();
  }, [loadArtisans, loadUsers]);

  const handleSearch = () => {
    loadArtisans();
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    loadArtisans();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      bio: "",
      city: "",
      state: "",
      country: "India",
      avatar: [],
      coverImage: [],
      specialties: "",
      experience: "",
      userId: "",
      phone: "",
      email: "",
      website: "",
      socialMedia: {
        instagram: "",
        facebook: "",
        twitter: ""
      },
      businessDetails: {
        businessName: "",
        gstNumber: "",
        businessType: ""
      },
      isVerified: false,
      isActive: true
    });
  };

  const handleCreateArtisan = async () => {
    try {
      const artisanData = {
        name: formData.name,
        bio: formData.bio,
        location: {
          city: formData.city,
          state: formData.state,
          country: formData.country
        },
        avatar: formData.avatar[0] || "",
        coverImage: formData.coverImage[0] || "",
        specialties: formData.specialties.split(',').map(s => s.trim()).filter(s => s),
        experience: parseInt(formData.experience) || 0,
        userId: formData.userId,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        website: formData.website || undefined,
        socialMedia: {
          instagram: formData.socialMedia.instagram || undefined,
          facebook: formData.socialMedia.facebook || undefined,
          twitter: formData.socialMedia.twitter || undefined
        },
        businessDetails: {
          businessName: formData.businessDetails.businessName || undefined,
          gstNumber: formData.businessDetails.gstNumber || undefined,
          businessType: formData.businessDetails.businessType || undefined
        },
        verification: {
          isVerified: formData.isVerified
        },
        isActive: formData.isActive
      };

      await adminService.createArtisan(artisanData);
      toast({
        title: "Success",
        description: "Artisan created successfully"
      });
      // Invalidate public artisan queries to sync with frontend
      queryClient.invalidateQueries({ queryKey: ['artisans'] });
      setIsCreateDialogOpen(false);
      resetForm();
      loadArtisans();
    } catch (error) {
      console.error('Error creating artisan:', error);
      toast({
        title: "Error",
        description: "Failed to create artisan",
        variant: "destructive"
      });
    }
  };

  const handleEditArtisan = async () => {
    if (!editingArtisan) return;

    try {
      // Send data using the same field aliases the backend admin PUT route expects.
      // The backend maps phone→businessInfo.contact.phone, website→socials.website,
      // socialMedia→socials, businessDetails→businessInfo so nested docs are safe.
      const artisanData = {
        name: formData.name,
        bio: formData.bio,
        location: {
          city: formData.city,
          state: formData.state,
          country: formData.country
        },
        avatar: formData.avatar[0] || "",
        coverImage: formData.coverImage[0] || "",
        specialties: formData.specialties.split(',').map(s => s.trim()).filter(s => s),
        experience: parseInt(formData.experience) || 0,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        website: formData.website || undefined,
        socialMedia: {
          instagram: formData.socialMedia.instagram || undefined,
          facebook:  formData.socialMedia.facebook  || undefined
        },
        businessDetails: {
          businessName: formData.businessDetails.businessName || undefined,
          gstNumber:    formData.businessDetails.gstNumber    || undefined,
          businessType: formData.businessDetails.businessType || undefined
        }
      };

      await adminService.updateArtisan(editingArtisan._id, artisanData);
      toast({
        title: "Success",
        description: "Artisan updated successfully"
      });
      // Invalidate public artisan queries to sync with frontend
      queryClient.invalidateQueries({ queryKey: ['artisans'] });
      setIsEditDialogOpen(false);
      setEditingArtisan(null);
      resetForm();
      loadArtisans();
    } catch (error) {
      console.error('Error updating artisan:', error);
      toast({
        title: "Error",
        description: "Failed to update artisan",
        variant: "destructive"
      });
    }
  };

  const handleDeleteArtisan = async (artisanId: string) => {
    if (!confirm("Are you sure you want to delete this artisan?")) return;

    try {
      await adminService.deleteArtisan(artisanId);
      toast({
        title: "Success",
        description: "Artisan deleted successfully"
      });
      loadArtisans();
    } catch (error) {
      console.error('Error deleting artisan:', error);
      toast({
        title: "Error",
        description: "Failed to delete artisan",
        variant: "destructive"
      });
    }
  };

  const openVerificationDialog = (artisan: Artisan) => {
    setEditingArtisan(artisan);
    setVerificationData({
      profilePhoto: artisan.documentVerification?.profilePhoto || false,
      gstCertificate: artisan.documentVerification?.gstCertificate || false,
      aadhaarProof: artisan.documentVerification?.aadhaarProof || false,
      craftVideo: artisan.documentVerification?.craftVideo || false,
      productPhotos: artisan.documentVerification?.productPhotos || false,
      bankDetails: artisan.documentVerification?.bankDetails || false,
      isVerified: artisan.verification?.isVerified || false
    });
    setIsVerificationDialogOpen(true);
  };

  const handleUpdateVerification = async () => {
    if (!editingArtisan) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/artisans/${editingArtisan._id}/verification`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          documentVerification: {
            profilePhoto: verificationData.profilePhoto,
            gstCertificate: verificationData.gstCertificate,
            aadhaarProof: verificationData.aadhaarProof,
            craftVideo: verificationData.craftVideo,
            productPhotos: verificationData.productPhotos,
            bankDetails: verificationData.bankDetails
          },
          isVerified: verificationData.isVerified
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Document verification updated successfully"
        });
        setIsVerificationDialogOpen(false);
        setEditingArtisan(null);
        loadArtisans();
      } else {
        throw new Error('Failed to update verification');
      }
    } catch (error) {
      console.error('Error updating verification:', error);
      toast({
        title: "Error",
        description: "Failed to update document verification",
        variant: "destructive"
      });
    }
  };

  const handleAcknowledgeChanges = async (artisan: Artisan) => {
    try {
      await adminService.acknowledgeArtisanChanges(artisan._id);
      toast({ title: 'Changes marked as reviewed' });
      setIsViewDialogOpen(false);
      setEditingArtisan(null);
      loadArtisans();
    } catch (error) {
      console.error('Error acknowledging changes:', error);
      toast({ title: 'Error', description: 'Failed to mark changes as reviewed', variant: 'destructive' });
    }
  };

  const openEditDialog = (artisan: Artisan) => {
    setEditingArtisan(artisan);
    setFormData({
      name: artisan.name,
      bio: artisan.bio,
      city: artisan.location.city,
      state: artisan.location.state,
      country: artisan.location.country,
      avatar: artisan.avatar ? [artisan.avatar] : [],
      coverImage: artisan.coverImage ? [artisan.coverImage] : [],
      specialties: artisan.specialties.join(', '),
      experience: artisan.experience?.toString() || '0',
      userId: (artisan.userId as unknown as string) || "",
      // Phone is stored inside businessInfo.contact.phone in MongoDB
      phone: artisan.businessInfo?.contact?.phone || "",
      // Email can be top-level on the artisan doc or inside businessInfo.contact
      email: artisan.email || artisan.businessInfo?.contact?.email || "",
      // Website is stored inside socials sub-doc
      website: artisan.socials?.website || "",
      socialMedia: {
        // Social links are stored in the `socials` sub-doc (not `socialMedia`)
        instagram: artisan.socials?.instagram || "",
        facebook:  artisan.socials?.facebook  || "",
        twitter: ""
      },
      businessDetails: {
        // Business info is stored in `businessInfo` (not `businessDetails`)
        businessName: artisan.businessInfo?.businessName || "",
        gstNumber:    artisan.businessInfo?.gstNumber    || "",
        // sellerType in schema was mapped to businessType in the form
        businessType: artisan.businessInfo?.sellerType   || ""
      },
      isVerified: artisan.verification?.isVerified || false,
      isActive: artisan.isActive
    });
    setIsEditDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Artisan Management</h2>
          <p className="text-muted-foreground">
            Manage artisan profiles and verification status
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Artisan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Artisan</DialogTitle>
              <DialogDescription>
                Add a new artisan profile to the marketplace
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="col-span-3"
                  placeholder="Artisan's full name"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bio" className="text-right">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="col-span-3"
                  placeholder="Brief description about the artisan"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="city" className="text-right">
                  City *
                </Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="col-span-3"
                  placeholder="City name"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="state" className="text-right">
                  State *
                </Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="col-span-3"
                  placeholder="State name"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="col-span-3"
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="col-span-3"
                  placeholder="artisan@example.com"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="website" className="text-right">
                  Website
                </Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="col-span-3"
                  placeholder="https://artisan-website.com"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="specialties" className="text-right">
                  Specialties *
                </Label>
                <Input
                  id="specialties"
                  value={formData.specialties}
                  onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                  placeholder="pottery, textiles, jewelry (comma separated)"
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="experience" className="text-right">
                  Experience (years) *
                </Label>
                <Input
                  id="experience"
                  type="number"
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  className="col-span-3"
                  placeholder="5"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="business-name" className="text-right">
                  Business Name
                </Label>
                <Input
                  id="business-name"
                  value={formData.businessDetails.businessName}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    businessDetails: { 
                      ...formData.businessDetails, 
                      businessName: e.target.value 
                    } 
                  })}
                  className="col-span-3"
                  placeholder="Registered business name"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="gst-number" className="text-right">
                  GST Number
                </Label>
                <Input
                  id="gst-number"
                  value={formData.businessDetails.gstNumber}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    businessDetails: { 
                      ...formData.businessDetails, 
                      gstNumber: e.target.value 
                    } 
                  })}
                  className="col-span-3"
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="business-type" className="text-right">
                  Business Type
                </Label>
                <Select 
                  value={formData.businessDetails.businessType} 
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    businessDetails: { 
                      ...formData.businessDetails, 
                      businessType: value 
                    } 
                  })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sole-proprietorship">Sole Proprietorship</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="private-limited">Private Limited</SelectItem>
                    <SelectItem value="llp">LLP</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="instagram" className="text-right">
                  Instagram
                </Label>
                <Input
                  id="instagram"
                  value={formData.socialMedia.instagram}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    socialMedia: { 
                      ...formData.socialMedia, 
                      instagram: e.target.value 
                    } 
                  })}
                  className="col-span-3"
                  placeholder="@artisan_username"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="facebook" className="text-right">
                  Facebook
                </Label>
                <Input
                  id="facebook"
                  value={formData.socialMedia.facebook}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    socialMedia: { 
                      ...formData.socialMedia, 
                      facebook: e.target.value 
                    } 
                  })}
                  className="col-span-3"
                  placeholder="facebook.com/artisan"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="user" className="text-right">
                  User Account *
                </Label>
                <Select value={formData.userId} onValueChange={(value) => setFormData({ ...formData, userId: value })}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select user account" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user._id} value={user._id}>
                        {user.name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">
                  Avatar
                </Label>
                <div className="col-span-3">
                  <ImageUpload
                    images={formData.avatar}
                    onImagesChange={(images) => setFormData({ ...formData, avatar: images })}
                    maxImages={1}
                    category="artisans"
                    singleMode={true}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">
                  Cover Image
                </Label>
                <div className="col-span-3">
                  <ImageUpload
                    images={formData.coverImage}
                    onImagesChange={(images) => setFormData({ ...formData, coverImage: images })}
                    maxImages={1}
                    category="artisans"
                    singleMode={true}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <div className="col-span-4 flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is-verified"
                      checked={formData.isVerified}
                      onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                      className="rounded"
                      aria-label="Verified Artisan"
                    />
                    <Label htmlFor="is-verified">Verified Artisan</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is-active"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded"
                      aria-label="Active Account"
                    />
                    <Label htmlFor="is-active">Active Account</Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={handleCreateArtisan}>
                Create Artisan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search artisans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch}>Search</Button>
      </div>

      {/* Artisans List */}
      <div className="grid gap-6">
        {artisans.map((artisan) => (
          <Card 
            key={artisan._id}
            className={artisan.pendingChanges?.hasChanges ? 'bg-orange-50 dark:bg-orange-950/20 border-l-4 border-l-orange-500' : ''}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    {artisan.avatar ? (
                      <img 
                        src={artisan.avatar} 
                        alt={artisan.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        {artisan.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    )}
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {artisan.name}
                      {artisan.verification.isVerified ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {artisan.pendingChanges?.hasChanges && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 ml-2">
                          <Bell className="w-3 h-3 mr-1" />
                          Changed
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {artisan.location.city}, {artisan.location.state}
                      {artisan.pendingChanges?.hasChanges && (
                        <span className="block text-xs text-orange-600 mt-1">
                          Modified: {artisan.pendingChanges.changedFields.join(', ')}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={artisan.isActive ? "default" : "secondary"}>
                    {artisan.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant={artisan.verification.isVerified ? "default" : "outline"}>
                    {artisan.verification.isVerified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {artisan.bio.substring(0, 150)}...
                </p>
                <div className="flex flex-wrap gap-2">
                  {artisan.specialties.map((specialty, index) => (
                    <Badge key={index} variant="outline">
                      {specialty}
                </Badge>
                  ))}
                </div>
                
                {/* Document Verification Status */}
                {artisan.documentVerification && artisan.approvalStatus === 'approved' && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Document Verification:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        {artisan.documentVerification.profilePhoto ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-gray-400" />
                        )}
                        <span className={artisan.documentVerification.profilePhoto ? "text-green-600" : "text-gray-500"}>
                          Profile Photo
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {artisan.documentVerification.gstCertificate ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-gray-400" />
                        )}
                        <span className={artisan.documentVerification.gstCertificate ? "text-green-600" : "text-gray-500"}>
                          GST Certificate
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {artisan.documentVerification.aadhaarProof ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-gray-400" />
                        )}
                        <span className={artisan.documentVerification.aadhaarProof ? "text-green-600" : "text-gray-500"}>
                          Aadhaar Proof
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {artisan.documentVerification.craftVideo ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-gray-400" />
                        )}
                        <span className={artisan.documentVerification.craftVideo ? "text-green-600" : "text-gray-500"}>
                          Craft Video
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {artisan.documentVerification.productPhotos ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-gray-400" />
                        )}
                        <span className={artisan.documentVerification.productPhotos ? "text-green-600" : "text-gray-500"}>
                          Product Photos
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {artisan.documentVerification.bankDetails ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-gray-400" />
                        )}
                        <span className={artisan.documentVerification.bankDetails ? "text-green-600" : "text-gray-500"}>
                          Bank Details
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{artisan.experience} years experience</span>
                  <span>{artisan.totalProducts} products</span>
                  <span>Rating: {artisan.rating}/5</span>
                </div>
                <div className="flex justify-end space-x-2 flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingArtisan(artisan);
                      setIsViewDialogOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                  {artisan.approvalStatus === 'approved' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-blue-500 text-blue-600 hover:bg-blue-50"
                      onClick={() => openVerificationDialog(artisan)}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      Edit Verification
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(artisan)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteArtisan(artisan._id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {artisans.length === 0 && (
          <Card>
            <CardContent className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No artisans found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingArtisan(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Artisan</DialogTitle>
            <DialogDescription>
              Update artisan profile information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name *
              </Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
                placeholder="Artisan's full name"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-bio" className="text-right">
                Bio
              </Label>
              <Textarea
                id="edit-bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="col-span-3"
                placeholder="Brief description about the artisan"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-city" className="text-right">
                City *
              </Label>
              <Input
                id="edit-city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="col-span-3"
                placeholder="City name"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-state" className="text-right">
                State *
              </Label>
              <Input
                id="edit-state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="col-span-3"
                placeholder="State name"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-phone" className="text-right">
                Phone
              </Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="col-span-3"
                placeholder="+91 9876543210"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-3"
                placeholder="artisan@example.com"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-website" className="text-right">
                Website
              </Label>
              <Input
                id="edit-website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="col-span-3"
                placeholder="https://artisan-website.com"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-specialties" className="text-right">
                Specialties *
              </Label>
              <Input
                id="edit-specialties"
                value={formData.specialties}
                onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                placeholder="pottery, textiles, jewelry (comma separated)"
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-experience" className="text-right">
                Experience (years) *
              </Label>
              <Input
                id="edit-experience"
                type="number"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                className="col-span-3"
                placeholder="5"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-business-name" className="text-right">
                Business Name
              </Label>
              <Input
                id="edit-business-name"
                value={formData.businessDetails.businessName}
                onChange={(e) => setFormData({
                  ...formData,
                  businessDetails: {
                    ...formData.businessDetails,
                    businessName: e.target.value
                  }
                })}
                className="col-span-3"
                placeholder="Registered business name"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-gst-number" className="text-right">
                GST Number
              </Label>
              <Input
                id="edit-gst-number"
                value={formData.businessDetails.gstNumber}
                onChange={(e) => setFormData({
                  ...formData,
                  businessDetails: {
                    ...formData.businessDetails,
                    gstNumber: e.target.value
                  }
                })}
                className="col-span-3"
                placeholder="22AAAAA0000A1Z5"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-business-type" className="text-right">
                Business Type
              </Label>
              <Select
                value={formData.businessDetails.businessType}
                onValueChange={(value) => setFormData({
                  ...formData,
                  businessDetails: {
                    ...formData.businessDetails,
                    businessType: value
                  }
                })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sole-proprietorship">Sole Proprietorship</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="private-limited">Private Limited</SelectItem>
                  <SelectItem value="llp">LLP</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-instagram" className="text-right">
                Instagram
              </Label>
              <Input
                id="edit-instagram"
                value={formData.socialMedia.instagram}
                onChange={(e) => setFormData({
                  ...formData,
                  socialMedia: {
                    ...formData.socialMedia,
                    instagram: e.target.value
                  }
                })}
                className="col-span-3"
                placeholder="@artisan_username"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-facebook" className="text-right">
                Facebook
              </Label>
              <Input
                id="edit-facebook"
                value={formData.socialMedia.facebook}
                onChange={(e) => setFormData({
                  ...formData,
                  socialMedia: {
                    ...formData.socialMedia,
                    facebook: e.target.value
                  }
                })}
                className="col-span-3"
                placeholder="facebook.com/artisan"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-avatar" className="text-right">
                Avatar
              </Label>
              <div className="col-span-3">
                <ImageUpload
                  images={formData.avatar}
                  onImagesChange={(images) => setFormData({ ...formData, avatar: images })}
                  maxImages={1}
                  category="artisans"
                  singleMode
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-coverImage" className="text-right">
                Cover Image
              </Label>
              <div className="col-span-3">
                <ImageUpload
                  images={formData.coverImage}
                  onImagesChange={(images) => setFormData({ ...formData, coverImage: images })}
                  maxImages={1}
                  category="artisans"
                  singleMode
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <div className="col-span-4 flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-is-verified"
                    checked={formData.isVerified}
                    onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                    className="rounded"
                    aria-label="Verified Artisan"
                  />
                  <Label htmlFor="edit-is-verified">Verified Artisan</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-is-active"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded"
                    aria-label="Active Account"
                  />
                  <Label htmlFor="edit-is-active">Active Account</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleEditArtisan}>
              Update Artisan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Full Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={(open) => {
        setIsViewDialogOpen(open);
        if (!open) {
          setEditingArtisan(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Artisan Full Details</DialogTitle>
            <DialogDescription>
              Complete information and verification status
            </DialogDescription>
          </DialogHeader>
          
          {editingArtisan && (
            <div className="space-y-4">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-muted-foreground">Name</p>
                    <p>{editingArtisan.name}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Email</p>
                    <p>{editingArtisan.email}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Experience</p>
                    <p>{editingArtisan.experience} years</p>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground">Rating</p>
                    <p>{editingArtisan.rating}/5 ({editingArtisan.totalRatings} ratings)</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-semibold text-muted-foreground">Bio</p>
                    <p>{editingArtisan.bio || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Business Information */}
              {editingArtisan.businessInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Business Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-muted-foreground">Business Name</p>
                      <p>{editingArtisan.businessInfo.businessName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-muted-foreground">Seller Type</p>
                      <p>{editingArtisan.businessInfo.sellerType?.toUpperCase() || 'N/A'}</p>
                    </div>
                    {editingArtisan.businessInfo.gstNumber && (
                      <div>
                        <p className="font-semibold text-muted-foreground">GST Number</p>
                        <p>{editingArtisan.businessInfo.gstNumber}</p>
                      </div>
                    )}
                    {editingArtisan.businessInfo.panNumber && (
                      <div>
                        <p className="font-semibold text-muted-foreground">PAN Number</p>
                        <p>{editingArtisan.businessInfo.panNumber}</p>
                      </div>
                    )}
                    {editingArtisan.businessInfo.contact && (
                      <>
                        <div>
                          <p className="font-semibold text-muted-foreground">Contact Phone</p>
                          <p>{editingArtisan.businessInfo.contact.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-muted-foreground">Contact Email</p>
                          <p>{editingArtisan.businessInfo.contact.email || 'N/A'}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Location */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Location & Specialties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-muted-foreground">City</p>
                      <p>{editingArtisan.location.city}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-muted-foreground">State</p>
                      <p>{editingArtisan.location.state}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-muted-foreground">Country</p>
                      <p>{editingArtisan.location.country || 'India'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-muted-foreground mb-2">Specialties</p>
                    <div className="flex flex-wrap gap-2">
                      {editingArtisan.specialties.map((specialty, index) => (
                        <Badge key={index} variant="outline">{specialty}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Product Information */}
              {editingArtisan.productInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Product Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <p className="font-semibold text-muted-foreground">Description</p>
                        <p>{editingArtisan.productInfo.description || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-muted-foreground">Materials</p>
                        <p>{editingArtisan.productInfo.materials || 'N/A'}</p>
                      </div>
                      {editingArtisan.productInfo.priceRange && (
                        <div>
                          <p className="font-semibold text-muted-foreground">Price Range</p>
                          <p>₹{editingArtisan.productInfo.priceRange.min} - ₹{editingArtisan.productInfo.priceRange.max}</p>
                        </div>
                      )}
                      {editingArtisan.productInfo.stockQuantity && (
                        <div>
                          <p className="font-semibold text-muted-foreground">Stock Quantity</p>
                          <p>{editingArtisan.productInfo.stockQuantity}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Product Photos */}
                    {editingArtisan.productInfo.photos && editingArtisan.productInfo.photos.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-semibold text-muted-foreground">Product Photos</p>
                          {editingArtisan.documentVerification?.productPhotos && (
                            <Badge variant="default" className="ml-2">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {editingArtisan.productInfo.photos.map((photo, index) => (
                            <div 
                              key={index}
                              className="relative group cursor-pointer border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                              onClick={() => setPreviewDocument({ url: photo, type: 'image' })}
                            >
                              <img 
                                src={photo} 
                                alt={`Product ${index + 1}`} 
                                className="w-full h-24 object-cover"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-6 h-6 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Logistics Information */}
              {editingArtisan.logistics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      Logistics & Shipping
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    {editingArtisan.logistics.pickupAddress && (
                      <>
                        <div>
                          <p className="font-semibold text-muted-foreground">Pickup Address Same as Main</p>
                          <p>{editingArtisan.logistics.pickupAddress.sameAsMain ? 'Yes' : 'No'}</p>
                        </div>
                        {!editingArtisan.logistics.pickupAddress.sameAsMain && editingArtisan.logistics.pickupAddress.address && (
                          <div className="col-span-2">
                            <p className="font-semibold text-muted-foreground">Pickup Address</p>
                            <p>{editingArtisan.logistics.pickupAddress.address}</p>
                          </div>
                        )}
                      </>
                    )}
                    {editingArtisan.logistics.dispatchTime && (
                      <div>
                        <p className="font-semibold text-muted-foreground">Average Dispatch Time</p>
                        <Badge variant="outline">{editingArtisan.logistics.dispatchTime} days</Badge>
                      </div>
                    )}
                    {editingArtisan.logistics.packagingType && (
                      <div>
                        <p className="font-semibold text-muted-foreground">Packaging Type</p>
                        <Badge variant="outline" className="capitalize">{editingArtisan.logistics.packagingType}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Bank Details */}
              {editingArtisan.verification?.bankDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Bank Details
                      {editingArtisan.documentVerification?.bankDetails && (
                        <Badge variant="default" className="ml-2">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    {editingArtisan.verification.bankDetails.accountNumber && (
                      <div>
                        <p className="font-semibold text-muted-foreground">Account Number</p>
                        <p>{editingArtisan.verification.bankDetails.accountNumber}</p>
                      </div>
                    )}
                    {editingArtisan.verification.bankDetails.ifscCode && (
                      <div>
                        <p className="font-semibold text-muted-foreground">IFSC Code</p>
                        <p>{editingArtisan.verification.bankDetails.ifscCode}</p>
                      </div>
                    )}
                    {editingArtisan.verification.bankDetails.bankName && (
                      <div>
                        <p className="font-semibold text-muted-foreground">Bank Name</p>
                        <p>{editingArtisan.verification.bankDetails.bankName}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Payment Information */}
              {editingArtisan.payment && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Payment Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    {editingArtisan.payment.upiId && (
                      <div>
                        <p className="font-semibold text-muted-foreground">UPI ID</p>
                        <p>{editingArtisan.payment.upiId}</p>
                      </div>
                    )}
                    {editingArtisan.payment.paymentFrequency && (
                      <div>
                        <p className="font-semibold text-muted-foreground">Payment Frequency</p>
                        <p className="capitalize">{editingArtisan.payment.paymentFrequency}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Submitted Documents */}
              {editingArtisan.documents && (Object.keys(editingArtisan.documents).some(key => editingArtisan.documents?.[key as keyof typeof editingArtisan.documents]) || editingArtisan.avatar) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Submitted Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Profile Photo */}
                    {editingArtisan.avatar && (
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm">Profile Photo</strong>
                            {editingArtisan.documentVerification?.profilePhoto && (
                              <Badge variant="default">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewDocument({ url: editingArtisan.avatar!, type: 'image' })}
                            className="h-8"
                          >
                            <ZoomIn className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                        </div>
                        <img 
                          src={editingArtisan.avatar} 
                          alt="Profile" 
                          className="w-32 h-32 object-cover rounded-full mx-auto border-2 border-gray-200"
                        />
                      </div>
                    )}

                    {/* GST Certificate */}
                    {editingArtisan.documents.gstCertificate && (
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm">GST Certificate</strong>
                            {editingArtisan.documentVerification?.gstCertificate && (
                              <Badge variant="default">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewDocument({ url: editingArtisan.documents!.gstCertificate!, type: 'image' })}
                            className="h-8"
                          >
                            <ZoomIn className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                        </div>
                        {editingArtisan.documents.gstCertificate.startsWith('data:image') || editingArtisan.documents.gstCertificate.includes('.jpg') || editingArtisan.documents.gstCertificate.includes('.png') ? (
                          <img 
                            src={editingArtisan.documents.gstCertificate} 
                            alt="GST Certificate" 
                            className="w-full max-h-48 object-contain rounded border bg-white"
                          />
                        ) : (
                          <div className="flex items-center justify-center p-8 border rounded bg-gray-50">
                            <FileText className="w-12 h-12 text-gray-400" />
                            <span className="ml-3 text-sm text-gray-600">PDF Document</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Aadhaar Proof */}
                    {editingArtisan.documents.aadhaarProof && (
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm">Aadhaar Proof</strong>
                            {editingArtisan.documentVerification?.aadhaarProof && (
                              <Badge variant="default">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewDocument({ url: editingArtisan.documents!.aadhaarProof!, type: 'image' })}
                            className="h-8"
                          >
                            <ZoomIn className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                        </div>
                        {editingArtisan.documents.aadhaarProof.startsWith('data:image') || editingArtisan.documents.aadhaarProof.includes('.jpg') || editingArtisan.documents.aadhaarProof.includes('.png') ? (
                          <img 
                            src={editingArtisan.documents.aadhaarProof} 
                            alt="Aadhaar Proof" 
                            className="w-full max-h-48 object-contain rounded border bg-white"
                          />
                        ) : (
                          <div className="flex items-center justify-center p-8 border rounded bg-gray-50">
                            <FileText className="w-12 h-12 text-gray-400" />
                            <span className="ml-3 text-sm text-gray-600">PDF Document</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Craft Video */}
                    {editingArtisan.documents.craftVideo && (
                      <div className="border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <strong className="text-sm">Craft Video</strong>
                            {editingArtisan.documentVerification?.craftVideo && (
                              <Badge variant="default">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewDocument({ url: editingArtisan.documents!.craftVideo!, type: 'video' })}
                            className="h-8"
                          >
                            <ZoomIn className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                        </div>
                        <video 
                          src={editingArtisan.documents.craftVideo} 
                          controls 
                          className="w-full max-h-64 rounded border bg-black"
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Document Verification Status */}
              {editingArtisan.documentVerification && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Document Verification Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex items-center gap-2">
                        {editingArtisan.documentVerification.profilePhoto ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className={editingArtisan.documentVerification.profilePhoto ? "text-green-600" : "text-gray-500"}>
                          Profile Photo
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingArtisan.documentVerification.gstCertificate ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className={editingArtisan.documentVerification.gstCertificate ? "text-green-600" : "text-gray-500"}>
                          GST Certificate
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingArtisan.documentVerification.aadhaarProof ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className={editingArtisan.documentVerification.aadhaarProof ? "text-green-600" : "text-gray-500"}>
                          Aadhaar Proof
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingArtisan.documentVerification.craftVideo ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className={editingArtisan.documentVerification.craftVideo ? "text-green-600" : "text-gray-500"}>
                          Craft Video
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingArtisan.documentVerification.productPhotos ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className={editingArtisan.documentVerification.productPhotos ? "text-green-600" : "text-gray-500"}>
                          Product Photos
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingArtisan.documentVerification.bankDetails ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className={editingArtisan.documentVerification.bankDetails ? "text-green-600" : "text-gray-500"}>
                          Bank Details
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Approval Information */}
              {editingArtisan.approvalStatus && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Approval Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-muted-foreground">Status</p>
                      <Badge variant={editingArtisan.approvalStatus === 'approved' ? 'default' : 'secondary'}>
                        {editingArtisan.approvalStatus}
                      </Badge>
                    </div>
                    {editingArtisan.approvedAt && (
                      <div>
                        <p className="font-semibold text-muted-foreground">Approved At</p>
                        <p>{new Date(editingArtisan.approvedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                    {editingArtisan.approvalNotes && (
                      <div className="col-span-2">
                        <p className="font-semibold text-muted-foreground">Approval Notes</p>
                        <p>{editingArtisan.approvalNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Pending Changes — shown when artisan edited their profile after approval */}
              {editingArtisan.pendingChanges?.hasChanges && (
                <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2 text-orange-800 dark:text-orange-200">
                      <Bell className="w-5 h-5" />
                      Artisan Changed Details After Approval
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Modified fields</p>
                      <div className="flex flex-wrap gap-2">
                        {editingArtisan.pendingChanges.changedFields.map((field) => (
                          <Badge key={field} variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {editingArtisan.pendingChanges.changedAt && (
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        Last changed: {new Date(editingArtisan.pendingChanges.changedAt).toLocaleString()}
                      </p>
                    )}
                    {editingArtisan.pendingChanges.changes && Object.keys(editingArtisan.pendingChanges.changes).length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">New values submitted</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(editingArtisan.pendingChanges.changes).map(([key, value]) => (
                            <div key={key} className="bg-white dark:bg-gray-900 rounded p-2 border border-orange-200">
                              <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}: </span>
                              <span className="text-muted-foreground">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-400 text-orange-700 hover:bg-orange-100"
                      onClick={() => handleAcknowledgeChanges(editingArtisan)}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark as Reviewed
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Verification Dialog */}
      <Dialog open={isVerificationDialogOpen} onOpenChange={(open) => {
        setIsVerificationDialogOpen(open);
        if (!open) {
          setEditingArtisan(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Document Verification</DialogTitle>
            <DialogDescription>
              Update verification status for {editingArtisan?.name}'s documents
            </DialogDescription>
          </DialogHeader>
          
          {editingArtisan && (
            <div className="space-y-4 py-4">
              <div className="space-y-4">
                {/* Profile Photo */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {verificationData.profilePhoto ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">Profile Photo</p>
                      <p className="text-sm text-muted-foreground">Artisan's profile picture</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verificationData.profilePhoto}
                      onChange={(e) => setVerificationData({
                        ...verificationData,
                        profilePhoto: e.target.checked
                      })}
                      className="form-checkbox h-5 w-5"
                    />
                    <span className="text-sm">
                      {verificationData.profilePhoto ? 'Verified' : 'Not Verified'}
                    </span>
                  </label>
                </div>

                {/* GST Certificate */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {verificationData.gstCertificate ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">GST Certificate</p>
                      <p className="text-sm text-muted-foreground">Business GST registration</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verificationData.gstCertificate}
                      onChange={(e) => setVerificationData({
                        ...verificationData,
                        gstCertificate: e.target.checked
                      })}
                      className="form-checkbox h-5 w-5"
                    />
                    <span className="text-sm">
                      {verificationData.gstCertificate ? 'Verified' : 'Not Verified'}
                    </span>
                  </label>
                </div>

                {/* Aadhaar Proof */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {verificationData.aadhaarProof ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">Aadhaar Proof</p>
                      <p className="text-sm text-muted-foreground">Identity verification document</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verificationData.aadhaarProof}
                      onChange={(e) => setVerificationData({
                        ...verificationData,
                        aadhaarProof: e.target.checked
                      })}
                      className="form-checkbox h-5 w-5"
                    />
                    <span className="text-sm">
                      {verificationData.aadhaarProof ? 'Verified' : 'Not Verified'}
                    </span>
                  </label>
                </div>

                {/* Craft Video */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {verificationData.craftVideo ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">Craft Video</p>
                      <p className="text-sm text-muted-foreground">Video demonstrating craft skills</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verificationData.craftVideo}
                      onChange={(e) => setVerificationData({
                        ...verificationData,
                        craftVideo: e.target.checked
                      })}
                      className="form-checkbox h-5 w-5"
                    />
                    <span className="text-sm">
                      {verificationData.craftVideo ? 'Verified' : 'Not Verified'}
                    </span>
                  </label>
                </div>

                {/* Product Photos */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {verificationData.productPhotos ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">Product Photos</p>
                      <p className="text-sm text-muted-foreground">Sample product images</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verificationData.productPhotos}
                      onChange={(e) => setVerificationData({
                        ...verificationData,
                        productPhotos: e.target.checked
                      })}
                      className="form-checkbox h-5 w-5"
                    />
                    <span className="text-sm">
                      {verificationData.productPhotos ? 'Verified' : 'Not Verified'}
                    </span>
                  </label>
                </div>

                {/* Bank Details */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {verificationData.bankDetails ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium">Bank Details</p>
                      <p className="text-sm text-muted-foreground">Account information for payments</p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verificationData.bankDetails}
                      onChange={(e) => setVerificationData({
                        ...verificationData,
                        bankDetails: e.target.checked
                      })}
                      className="form-checkbox h-5 w-5"
                    />
                    <span className="text-sm">
                      {verificationData.bankDetails ? 'Verified' : 'Not Verified'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-4 mt-4 space-y-4">
                <p className="text-sm text-muted-foreground mb-2">Verification Summary:</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {[verificationData.profilePhoto, verificationData.gstCertificate, verificationData.aadhaarProof, verificationData.craftVideo, verificationData.productPhotos, verificationData.bankDetails].filter(Boolean).length} of 6 documents verified
                  </span>
                </div>

                {/* Overall verified toggle */}
                <div className={`flex items-center justify-between p-3 border-2 rounded-lg ${
                  verificationData.isVerified ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-gray-200'
                }`}>
                  <div className="flex items-center gap-3">
                    {verificationData.isVerified ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-semibold">Mark Artisan as Verified</p>
                      <p className="text-xs text-muted-foreground">
                        Controls the ✓/✗ badge shown next to the artisan's name
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verificationData.isVerified}
                      onChange={(e) => setVerificationData({ ...verificationData, isVerified: e.target.checked })}
                      className="form-checkbox h-5 w-5"
                    />
                    <span className="text-sm font-medium">
                      {verificationData.isVerified ? 'Verified' : 'Not Verified'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVerificationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateVerification}>
              <Shield className="w-4 h-4 mr-2" />
              Update Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      {previewDocument && (
        <DocumentPreview
          url={previewDocument.url}
          type={previewDocument.type}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
}