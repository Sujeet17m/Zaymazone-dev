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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Plus,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Package,
  Trash2,
  Star,
  RefreshCw,
  Filter,
  TrendingUp,
  MoreVertical
} from "lucide-react";
import { adminService } from "@/services/adminService";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from '@/components/ImageUpload';
import { VideoManager } from '@/components/VideoManager';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  videos?: Array<{
    type: 'demonstration' | 'making-of' | 'usage';
    title: string;
    url: string;
    thumbnail: string;
    duration: number;
  }>;
  category: string;
  subcategory?: string;
  artisan?: {
    name: string;
    _id: string;
  };
  inStock: boolean;
  stock: number; // Changed from stockCount to match database
  rating?: number;
  reviewCount?: number;
  isActive?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  salesCount?: number; // Changed from totalSales to match database
  viewCount?: number; // Changed from views to match database
  isFeatured?: boolean; // Changed from featured to match database
  materials?: string[];
  dimensions?: string;
  weight?: string;
  colors?: string[];
  tags?: string[];
  isHandmade?: boolean;
  shippingTime?: string;
}

interface Artisan {
  _id: string;
  name: string;
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
  totalSales: number;
  verification: {
    isVerified: boolean;
    verifiedAt?: Date;
  };
  isActive: boolean;
  joinedDate: Date;
}

interface RawApiProduct {
  artisanId?: { _id?: string; name?: string } | string;
  [key: string]: unknown;
}

interface RawApiArtisan {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  bio?: string;
  location?: string;
  avatar?: string;
  image?: string;
  specialty?: string;
  experience?: string | number;
  rating?: number;
  reviews?: number;
  products?: number;
  productCount?: number;
  [key: string]: unknown;
}

export function ProductManagement() {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    stock: '', // Changed from stockCount
    category: '',
    subcategory: '',
    materials: '',
    dimensions: '',
    weight: '',
    colors: '',
    tags: '',
    isHandmade: true,
    shippingTime: '',
    isFeatured: false, // Changed from featured
    artisanId: '',
    images: [] as string[],
    videos: [] as Array<{
      type: 'demonstration' | 'making-of' | 'usage';
      title: string;
      url: string;
      thumbnail: string;
      duration: number;
    }>
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    stock: '', // Changed from stockCount
    category: '',
    subcategory: '',
    materials: '',
    dimensions: '',
    weight: '',
    colors: '',
    tags: '',
    isHandmade: true,
    shippingTime: '',
    isFeatured: false, // Changed from featured
    artisanId: '',
    images: [] as string[],
    videos: [] as Array<{
      type: 'demonstration' | 'making-of' | 'usage';
      title: string;
      url: string;
      thumbnail: string;
      duration: number;
    }>
  });
  const { toast } = useToast();

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [approvedResponse, pendingResponse] = await Promise.all([
        adminService.getProducts(), // Get all products, not just approved
        adminService.getPendingProducts()
      ]);

      // Transform products to match frontend interface
      const transformedProducts = (approvedResponse.products || []).map((product: RawApiProduct) => ({
        ...product,
        artisan: product.artisanId ? {
          _id: (product.artisanId as { _id?: string; name?: string })._id || String(product.artisanId),
          name: (product.artisanId as { _id?: string; name?: string }).name || 'Unknown'
        } : undefined
      }));

      const transformedPendingProducts = (pendingResponse.products || []).map((product: RawApiProduct) => ({
        ...product,
        artisan: product.artisanId ? {
          _id: (product.artisanId as { _id?: string; name?: string })._id || String(product.artisanId),
          name: (product.artisanId as { _id?: string; name?: string }).name || 'Unknown'
        } : undefined
      }));

      setProducts(transformedProducts as Product[]);
      setPendingProducts(transformedPendingProducts as Product[]);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadArtisans = useCallback(async () => {
    try {
      const response = await adminService.getArtisans();
      setArtisans(response.artisans || []);
    } catch (error) {
      console.error('Error loading artisans:', error);
      // Try fallback: get artisans from public API
      try {
        const { api } = await import('@/lib/api');
        const publicResponse = await api.getArtisans() as unknown as RawApiArtisan[];
        // Transform public artisans to match our interface
        const transformedArtisans = publicResponse.map((artisan) => ({
          _id: artisan.id || artisan._id || '',
          name: artisan.name,
          bio: artisan.description || artisan.bio || '',
          location: {
            city: artisan.location?.split(',')[0]?.trim() || '',
            state: artisan.location?.split(',')[1]?.trim() || '',
            country: 'India'
          },
          avatar: artisan.avatar || artisan.image || '',
          coverImage: artisan.image || '',
          specialties: [artisan.specialty || 'Artisan'],
          experience: parseInt(String(artisan.experience)) || 0,
          rating: artisan.rating || 0,
          totalRatings: artisan.reviews || 0,
          totalProducts: artisan.products || artisan.productCount || 0,
          totalSales: 0,
          verification: {
            isVerified: true,
            verifiedAt: new Date()
          },
          isActive: true,
          joinedDate: new Date()
        }));
        setArtisans(transformedArtisans as Artisan[]);
      } catch (fallbackError) {
        console.error('Fallback artisan loading also failed:', fallbackError);
        toast({
          title: "Error",
          description: "Failed to load artisans. Please ensure you're logged in as admin.",
          variant: "destructive"
        });
      }
    }
  }, [toast]);

  useEffect(() => {
    loadProducts();
    loadArtisans();
  }, [loadProducts, loadArtisans]);

  const handleApprove = async (productId: string) => {
    try {
      await adminService.approveProduct(productId);
      toast({
        title: "Success",
        description: "Product approved successfully",
      });
      loadProducts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve product",
        variant: "destructive"
      });
    }
  };

  const handleReject = async (productId: string, reason: string) => {
    try {
      await adminService.rejectProduct(productId, reason);
      toast({
        title: "Success",
        description: "Product rejected",
      });
      loadProducts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject product",
        variant: "destructive"
      });
    }
  };

  const handleCreateProduct = async () => {
    if (!createFormData.name || !createFormData.price || !createFormData.stock || !createFormData.category) {
      toast({
        title: "Validation Error",
        description: "Please fill name, price, stock, and category fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreating(true);
      const productData = {
        name: createFormData.name,
        description: createFormData.description,
        price: parseFloat(createFormData.price),
        originalPrice: createFormData.originalPrice ? parseFloat(createFormData.originalPrice) : undefined,
        stock: parseInt(createFormData.stock), // Changed from stockCount
        category: createFormData.category,
        subcategory: createFormData.subcategory || undefined,
        materials: createFormData.materials ? createFormData.materials.split(',').map(m => m.trim()).filter(m => m) : [],
        dimensions: createFormData.dimensions || undefined,
        weight: createFormData.weight || undefined,
        colors: createFormData.colors ? createFormData.colors.split(',').map(c => c.trim()).filter(c => c) : [],
        tags: createFormData.tags ? createFormData.tags.split(',').map(t => t.trim()).filter(t => t) : [],
        isHandmade: createFormData.isHandmade,
        shippingTime: createFormData.shippingTime || undefined,
        isFeatured: createFormData.isFeatured, // Changed from featured
        artisanId: createFormData.artisanId,
        images: createFormData.images,
        videos: createFormData.videos
      };

      await adminService.createProduct(productData);
      toast({
        title: "Success",
        description: "Product created successfully",
      });
      // Invalidate public product queries to sync with frontend
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreateDialogOpen(false);
      setCreateFormData({
        name: '',
        description: '',
        price: '',
        originalPrice: '',
        stock: '', // Changed from stockCount
        category: '',
        subcategory: '',
        materials: '',
        dimensions: '',
        weight: '',
        colors: '',
        tags: '',
        isHandmade: true,
        shippingTime: '',
        isFeatured: false, // Changed from featured
        artisanId: '',
        images: [],
        videos: []
      });
      loadProducts();
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: "Error",
        description: "Failed to create product",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEditProduct = async () => {
    if (!editingProduct) {
      return;
    }

    if (!editFormData.name || !editFormData.price || !editFormData.category) {
      toast({
        title: "Validation Error",
        description: "Please fill name, price, and category fields",
        variant: "destructive"
      });
      return;
    }

    try {
      setUpdating(true);
      const productData = {
        name: editFormData.name,
        description: editFormData.description,
        price: parseFloat(editFormData.price),
        originalPrice: editFormData.originalPrice ? parseFloat(editFormData.originalPrice) : undefined,
        stock: parseInt(editFormData.stock), // Changed from stockCount
        category: editFormData.category,
        subcategory: editFormData.subcategory || undefined,
        materials: editFormData.materials ? editFormData.materials.split(',').map(m => m.trim()).filter(m => m) : [],
        dimensions: editFormData.dimensions || undefined,
        weight: editFormData.weight || undefined,
        colors: editFormData.colors ? editFormData.colors.split(',').map(c => c.trim()).filter(c => c) : [],
        tags: editFormData.tags ? editFormData.tags.split(',').map(t => t.trim()).filter(t => t) : [],
        isHandmade: editFormData.isHandmade,
        shippingTime: editFormData.shippingTime || undefined,
        isFeatured: editFormData.isFeatured, // Changed from featured
        artisanId: editFormData.artisanId,
        images: editFormData.images,
        videos: editFormData.videos
      };

      await adminService.updateProduct(editingProduct._id, productData);
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      // Invalidate public product queries to sync with frontend
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsEditDialogOpen(false);
      setEditingProduct(null);
      loadProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setEditFormData({
      name: product.name || '',
      description: product.description || '',
      price: (product.price != null ? product.price.toString() : ''),
      originalPrice: (product.originalPrice != null ? product.originalPrice.toString() : ''),
      stock: (product.stock != null ? product.stock.toString() : ''), // Changed from stockCount
      category: product.category || '',
      subcategory: product.subcategory || '',
      materials: product.materials?.join(', ') || '',
      dimensions: product.dimensions || '',
      weight: product.weight || '',
      colors: product.colors?.join(', ') || '',
      tags: product.tags?.join(', ') || '',
      isHandmade: product.isHandmade !== false,
      shippingTime: product.shippingTime || '',
      isFeatured: product.isFeatured || false, // Changed from featured
      artisanId: product.artisan?._id || '',
      images: product.images || [],
      videos: product.videos || []
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (productId: string) => {
    try {
      await adminService.deleteProduct(productId);
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      // Invalidate public product queries to sync with frontend
      queryClient.invalidateQueries({ queryKey: ['products'] });
      loadProducts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive"
      });
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || product.approvalStatus === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredPendingProducts = pendingProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Product Management</h2>
          <p className="text-muted-foreground">Manage all products from the shop with full CRUD operations</p>
        </div>
        <Button onClick={loadProducts} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="approved" className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="approved">All Products ({products.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending Approval ({pendingProducts.length})</TabsTrigger>
          </TabsList>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Product
          </Button>
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="jewelry">Jewelry</SelectItem>
              <SelectItem value="home-decor">Home Decor</SelectItem>
              <SelectItem value="clothing">Clothing</SelectItem>
              <SelectItem value="art">Art</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="approved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Products</CardTitle>
              <CardDescription>All products available in the shop. You can view, edit, and delete any product.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Artisan</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={product.images[0] || '/placeholder-product.jpg'}
                            alt={product.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {product.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{product.artisan?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{product.category}</Badge>
                      </TableCell>
                      <TableCell>${product.price}</TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? "default" : "secondary"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setViewingProduct(product);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(product._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Products</CardTitle>
              <CardDescription>Products awaiting admin approval</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Artisan</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPendingProducts.map((product) => (
                    <TableRow key={product._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={product.images[0] || '/placeholder-product.jpg'}
                            alt={product.name}
                            className="h-10 w-10 rounded object-cover"
                          />
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {product.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{product.artisan?.name || 'Unknown'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{product.category}</Badge>
                      </TableCell>
                      <TableCell>${product.price}</TableCell>
                      <TableCell>
                        {new Date(product.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setViewingProduct(product);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(product._id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReject(product._id, "Not approved by admin")}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <img
                  src={viewingProduct.images[0] || '/placeholder-product.jpg'}
                  alt={viewingProduct.name}
                  className="w-full h-48 object-cover rounded"
                />
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{viewingProduct.name}</h3>
                  <p className="text-muted-foreground">{viewingProduct.description}</p>
                  <p className="font-medium">${viewingProduct.price}</p>
                  <p>Category: {viewingProduct.category}</p>
                  <p>Artisan: {viewingProduct.artisan?.name}</p>
                  <p>Stock: {viewingProduct.stock}</p>
                  <p>Rating: {viewingProduct.rating} ({viewingProduct.reviewCount} reviews)</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingProduct(null);
          setEditFormData({
            name: '',
            description: '',
            price: '',
            originalPrice: '',
            stock: '', // Changed from stockCount
            category: '',
            subcategory: '',
            materials: '',
            dimensions: '',
            weight: '',
            colors: '',
            tags: '',
            isHandmade: true,
            shippingTime: '',
            isFeatured: false, // Changed from featured
            artisanId: '',
            images: [],
            videos: []
          });
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update product information. Changes will be reflected immediately on the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="Product name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Category *</Label>
                  <Select value={editFormData.category} onValueChange={(value) => setEditFormData({ ...editFormData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pottery">Pottery</SelectItem>
                      <SelectItem value="textiles">Textiles</SelectItem>
                      <SelectItem value="jewelry">Jewelry</SelectItem>
                      <SelectItem value="woodwork">Woodwork</SelectItem>
                      <SelectItem value="metalwork">Metalwork</SelectItem>
                      <SelectItem value="paintings">Paintings</SelectItem>
                      <SelectItem value="crafts">Crafts</SelectItem>
                      <SelectItem value="toys">Toys</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-artisan">Artisan *</Label>
                <Select value={editFormData.artisanId} onValueChange={(value) => setEditFormData({ ...editFormData, artisanId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select artisan" />
                  </SelectTrigger>
                  <SelectContent>
                    {artisans.map((artisan) => (
                      <SelectItem key={artisan._id} value={artisan._id}>
                        {artisan.name} - {artisan.location.city}, {artisan.location.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Product description"
                  rows={3}
                />
              </div>
            </div>

            {/* Product Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Product Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-subcategory">Subcategory</Label>
                  <Input
                    id="edit-subcategory"
                    value={editFormData.subcategory}
                    onChange={(e) => setEditFormData({ ...editFormData, subcategory: e.target.value })}
                    placeholder="e.g., Vases, Tableware"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-materials">Materials</Label>
                  <Input
                    id="edit-materials"
                    value={editFormData.materials}
                    onChange={(e) => setEditFormData({ ...editFormData, materials: e.target.value })}
                    placeholder="e.g., Clay, Cotton, Wood (comma separated)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-colors">Colors</Label>
                  <Input
                    id="edit-colors"
                    value={editFormData.colors}
                    onChange={(e) => setEditFormData({ ...editFormData, colors: e.target.value })}
                    placeholder="e.g., Red, Blue, Green (comma separated)"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-tags">Tags</Label>
                  <Input
                    id="edit-tags"
                    value={editFormData.tags}
                    onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                    placeholder="e.g., handmade, traditional, eco-friendly (comma separated)"
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Inventory */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Pricing & Inventory</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit-price">Price *</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-original-price">Original Price</Label>
                  <Input
                    id="edit-original-price"
                    type="number"
                    step="0.01"
                    value={editFormData.originalPrice}
                    onChange={(e) => setEditFormData({ ...editFormData, originalPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-stock">Stock Count *</Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    value={editFormData.stock}
                    onChange={(e) => setEditFormData({ ...editFormData, stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Physical Properties */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Physical Properties</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-dimensions">Dimensions</Label>
                  <Input
                    id="edit-dimensions"
                    value={editFormData.dimensions}
                    onChange={(e) => setEditFormData({ ...editFormData, dimensions: e.target.value })}
                    placeholder="e.g., 10x5x8 inches"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-weight">Weight</Label>
                  <Input
                    id="edit-weight"
                    value={editFormData.weight}
                    onChange={(e) => setEditFormData({ ...editFormData, weight: e.target.value })}
                    placeholder="e.g., 2.5 kg"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-shipping-time">Shipping Time</Label>
                <Input
                  id="edit-shipping-time"
                  value={editFormData.shippingTime}
                  onChange={(e) => setEditFormData({ ...editFormData, shippingTime: e.target.value })}
                  placeholder="e.g., 3-5 business days"
                />
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Settings</h3>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-handmade"
                    aria-label="Handmade"
                    checked={editFormData.isHandmade}
                    onChange={(e) => setEditFormData({ ...editFormData, isHandmade: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="edit-handmade">Handmade</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit-featured"
                    aria-label="Featured Product"
                    checked={editFormData.isFeatured}
                    onChange={(e) => setEditFormData({ ...editFormData, isFeatured: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="edit-featured">Featured Product</Label>
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Product Images</h3>
              <ImageUpload
                images={editFormData.images}
                onImagesChange={(images) => {
                  setEditFormData({ ...editFormData, images });
                }}
                maxImages={5}
                category="products"
              />
            </div>

            {/* Videos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Product Videos</h3>
              <VideoManager
                videos={editFormData.videos}
                onChange={(videos) => setEditFormData({ ...editFormData, videos })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditProduct} disabled={updating}>
              {updating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Update Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Product Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
            <DialogDescription>
              Add a new product to the platform. It will be automatically approved and made available for sale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-name">Name *</Label>
                  <Input
                    id="create-name"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                    placeholder="Product name"
                  />
                </div>
                <div>
                  <Label htmlFor="create-category">Category *</Label>
                  <Select value={createFormData.category} onValueChange={(value) => setCreateFormData({ ...createFormData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pottery">Pottery</SelectItem>
                      <SelectItem value="textiles">Textiles</SelectItem>
                      <SelectItem value="jewelry">Jewelry</SelectItem>
                      <SelectItem value="woodwork">Woodwork</SelectItem>
                      <SelectItem value="metalwork">Metalwork</SelectItem>
                      <SelectItem value="paintings">Paintings</SelectItem>
                      <SelectItem value="crafts">Crafts</SelectItem>
                      <SelectItem value="toys">Toys</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="create-artisan">Artisan *</Label>
                <Select value={createFormData.artisanId} onValueChange={(value) => setCreateFormData({ ...createFormData, artisanId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select artisan" />
                  </SelectTrigger>
                  <SelectContent>
                    {artisans.map((artisan) => (
                      <SelectItem key={artisan._id} value={artisan._id}>
                        {artisan.name} - {artisan.location.city}, {artisan.location.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="create-description">Description</Label>
                <Textarea
                  id="create-description"
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  placeholder="Product description"
                  rows={3}
                />
              </div>
            </div>

            {/* Product Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Product Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-subcategory">Subcategory</Label>
                  <Input
                    id="create-subcategory"
                    value={createFormData.subcategory}
                    onChange={(e) => setCreateFormData({ ...createFormData, subcategory: e.target.value })}
                    placeholder="e.g., Vases, Tableware"
                  />
                </div>
                <div>
                  <Label htmlFor="create-materials">Materials</Label>
                  <Input
                    id="create-materials"
                    value={createFormData.materials}
                    onChange={(e) => setCreateFormData({ ...createFormData, materials: e.target.value })}
                    placeholder="e.g., Clay, Cotton, Wood (comma separated)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-colors">Colors</Label>
                  <Input
                    id="create-colors"
                    value={createFormData.colors}
                    onChange={(e) => setCreateFormData({ ...createFormData, colors: e.target.value })}
                    placeholder="e.g., Red, Blue, Green (comma separated)"
                  />
                </div>
                <div>
                  <Label htmlFor="create-tags">Tags</Label>
                  <Input
                    id="create-tags"
                    value={createFormData.tags}
                    onChange={(e) => setCreateFormData({ ...createFormData, tags: e.target.value })}
                    placeholder="e.g., handmade, traditional, eco-friendly (comma separated)"
                  />
                </div>
              </div>
            </div>

            {/* Pricing & Inventory */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Pricing & Inventory</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="create-price">Price *</Label>
                  <Input
                    id="create-price"
                    type="number"
                    step="0.01"
                    value={createFormData.price}
                    onChange={(e) => setCreateFormData({ ...createFormData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="create-original-price">Original Price</Label>
                  <Input
                    id="create-original-price"
                    type="number"
                    step="0.01"
                    value={createFormData.originalPrice}
                    onChange={(e) => setCreateFormData({ ...createFormData, originalPrice: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="create-stock">Stock Count *</Label>
                  <Input
                    id="create-stock"
                    type="number"
                    value={createFormData.stock}
                    onChange={(e) => setCreateFormData({ ...createFormData, stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Physical Properties */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Physical Properties</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-dimensions">Dimensions</Label>
                  <Input
                    id="create-dimensions"
                    value={createFormData.dimensions}
                    onChange={(e) => setCreateFormData({ ...createFormData, dimensions: e.target.value })}
                    placeholder="e.g., 10x5x8 inches"
                  />
                </div>
                <div>
                  <Label htmlFor="create-weight">Weight</Label>
                  <Input
                    id="create-weight"
                    value={createFormData.weight}
                    onChange={(e) => setCreateFormData({ ...createFormData, weight: e.target.value })}
                    placeholder="e.g., 2.5 kg"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="create-shipping-time">Shipping Time</Label>
                <Input
                  id="create-shipping-time"
                  value={createFormData.shippingTime}
                  onChange={(e) => setCreateFormData({ ...createFormData, shippingTime: e.target.value })}
                  placeholder="e.g., 3-5 business days"
                />
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Settings</h3>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="create-handmade"
                    aria-label="Handmade"
                    checked={createFormData.isHandmade}
                    onChange={(e) => setCreateFormData({ ...createFormData, isHandmade: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="create-handmade">Handmade</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="create-featured"
                    aria-label="Featured Product"
                    checked={createFormData.isFeatured}
                    onChange={(e) => setCreateFormData({ ...createFormData, isFeatured: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="create-featured">Featured Product</Label>
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Product Images</h3>
              <ImageUpload
                images={createFormData.images}
                onImagesChange={(images) => setCreateFormData({ ...createFormData, images })}
                maxImages={5}
                category="products"
              />
            </div>

            {/* Videos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Product Videos</h3>
              <VideoManager
                videos={createFormData.videos}
                onChange={(videos) => setCreateFormData({ ...createFormData, videos })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProduct} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}