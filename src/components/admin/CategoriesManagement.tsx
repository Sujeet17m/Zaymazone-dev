import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Eye, Star, Package, Users, Loader2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SingleImageUpload } from "./ImageUpload";
import { adminService } from "@/services/adminService";

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : 'https://zaymazone-backend.onrender.com');

interface Category {
  id: string;
  _id?: string;
  name: string;
  slug?: string;
  description: string;
  image: string[];
  icon: string;
  productCount: number;
  subcategories: string[];
  featured: boolean;
  artisanCount: number;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

const iconOptions = [
  { value: "Palette", label: "Palette" },
  { value: "Lightbulb", label: "Lightbulb" },
  { value: "ShirtIcon", label: "Shirt" },
  { value: "Gift", label: "Gift" },
  { value: "Sparkles", label: "Sparkles" },
  { value: "Scissors", label: "Scissors" },
  { value: "Hammer", label: "Hammer" },
  { value: "Crown", label: "Crown" }
];

export const CategoriesManagement = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCategory, setPreviewCategory] = useState<Category | null>(null);
  const [newSubcategory, setNewSubcategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFeatured, setFilterFeatured] = useState("all");
  const { toast } = useToast();

  // Filter categories based on search and filters
  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         category.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         category.subcategories.some(sub => sub.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFeatured = filterFeatured === "all" ||
                           (filterFeatured === "featured" && category.featured) ||
                           (filterFeatured === "not-featured" && !category.featured);

    return matchesSearch && matchesFeatured;
  });

  useEffect(() => {
    loadCategories();
  }, []);

  // Reload when search or filter changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadCategories();
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, filterFeatured]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await adminService.getCategories({ 
        limit: 50,
        search: searchTerm || undefined,
        featured: filterFeatured === "all" ? undefined : filterFeatured === "featured"
      });
      // Convert image strings to arrays for consistency
      const processedCategories = (data.categories || []).map(cat => ({
        ...cat,
        image: Array.isArray(cat.image) ? cat.image : (cat.image ? [cat.image] : [])
      }));
      setCategories(processedCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast({
        title: "Error Loading Categories",
        description: "Failed to load categories. Please check your connection and try again.",
        variant: "destructive",
      });
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    const newCategory: Category = {
      id: `category-${Date.now()}`,
      name: "",
      description: "",
      image: [],
      icon: "Palette",
      productCount: 0,
      subcategories: [],
      featured: false,
      artisanCount: 0
    };
    setEditingCategory(newCategory);
    setIsDialogOpen(true);
  };

  const handleEdit = (category: Category) => {
    setEditingCategory({ ...category });
    setIsDialogOpen(true);
  };

  const handleDelete = async (categoryId: string) => {
    try {
      setDeletingId(categoryId);
      await adminService.deleteCategory(categoryId);
      
      // Refresh the categories list to get updated data
      await loadCategories();
      
      toast({
        title: "Category Deleted",
        description: "The category has been removed successfully.",
      });
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete category. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async () => {
    if (!editingCategory) return;

    if (!editingCategory.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required.",
        variant: "destructive",
      });
      return;
    }

    if (categories.find(cat => cat.id !== editingCategory.id && cat.name === editingCategory.name)) {
      toast({
        title: "Validation Error",
        description: "A category with this name already exists.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const isNew = editingCategory.id.startsWith('category-');
      
      const categoryData = {
        name: editingCategory.name,
        description: editingCategory.description,
        image: editingCategory.image[0] || "",
        icon: editingCategory.icon,
        subcategories: editingCategory.subcategories,
        featured: editingCategory.featured
      };

      let data;
      if (isNew) {
        data = await adminService.createCategory(categoryData);
      } else {
        data = await adminService.updateCategory(editingCategory.id, categoryData);
      }

      // Refresh the categories list to get updated data
      await loadCategories();

      setIsDialogOpen(false);
      setEditingCategory(null);
      setNewSubcategory("");

      toast({
        title: "Category Saved",
        description: `${editingCategory.name} has been ${isNew ? 'added' : 'updated'} successfully.`,
      });
    } catch (error) {
      console.error('Failed to save category:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingCategory(null);
    setIsDialogOpen(false);
    setNewSubcategory("");
  };

  const handlePreview = (category: Category) => {
    setPreviewCategory(category);
    setIsPreviewOpen(true);
  };

  const addSubcategory = () => {
    if (!editingCategory || !newSubcategory.trim()) return;

    setEditingCategory({
      ...editingCategory,
      subcategories: [...editingCategory.subcategories, newSubcategory.trim()]
    });
    setNewSubcategory("");
  };

  const removeSubcategory = (index: number) => {
    if (!editingCategory) return;

    setEditingCategory({
      ...editingCategory,
      subcategories: editingCategory.subcategories.filter((_, i) => i !== index)
    });
  };

  const handleSelectCategory = (categoryId: string, checked: boolean) => {
    setSelectedCategories(prev =>
      checked
        ? [...prev, categoryId]
        : prev.filter(id => id !== categoryId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedCategories(checked ? filteredCategories.map(cat => cat.id) : []);
  };

  const handleBulkDelete = async () => {
    if (selectedCategories.length === 0) return;

    try {
      setSaving(true);
      const deletePromises = selectedCategories.map(id =>
        fetch(`${API_BASE}/api/admin/categories/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
          }
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const successfulDeletes = results.filter(result => result.status === 'fulfilled').length;
      const failedDeletes = results.length - successfulDeletes;

      setCategories(prev => prev.filter(cat => !selectedCategories.includes(cat.id)));
      setSelectedCategories([]);

      toast({
        title: "Bulk Delete Completed",
        description: `Successfully deleted ${successfulDeletes} categories${failedDeletes > 0 ? `, ${failedDeletes} failed` : ''}.`,
        variant: failedDeletes > 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error('Failed to bulk delete categories:', error);
      toast({
        title: "Error",
        description: "Failed to delete categories. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkFeatureToggle = async (featured: boolean) => {
    if (selectedCategories.length === 0) return;

    try {
      setSaving(true);
      const updatePromises = selectedCategories.map(id => {
        const category = categories.find(cat => cat.id === id);
        if (!category) return Promise.resolve();

        return fetch(`${API_BASE}/api/admin/categories/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
          },
          body: JSON.stringify({
            ...category,
            featured
          })
        });
      });

      const results = await Promise.allSettled(updatePromises);
      const successfulUpdates = results.filter(result => result.status === 'fulfilled').length;

      // Update local state
      setCategories(prev => prev.map(cat =>
        selectedCategories.includes(cat.id)
          ? { ...cat, featured }
          : cat
      ));

      setSelectedCategories([]);

      toast({
        title: "Bulk Update Completed",
        description: `Successfully ${featured ? 'featured' : 'unfeatured'} ${successfulUpdates} categories.`,
      });
    } catch (error) {
      console.error('Failed to bulk update categories:', error);
      toast({
        title: "Error",
        description: "Failed to update categories. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading categories...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Categories Management</h2>
          <p className="text-muted-foreground">Manage product categories displayed on the categories page</p>
        </div>
        <div className="flex gap-2">
          {selectedCategories.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => handleBulkFeatureToggle(true)}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Star className="w-4 h-4" />
                Feature ({selectedCategories.length})
              </Button>
              <Button
                variant="outline"
                onClick={() => handleBulkFeatureToggle(false)}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Star className="w-4 h-4 opacity-50" />
                Unfeature ({selectedCategories.length})
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedCategories.length})
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={loadCategories}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button onClick={handleAdd} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Categories</p>
                <p className="text-2xl font-bold">{categories.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Featured</p>
                <p className="text-2xl font-bold">{categories.filter(c => c.featured).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Artisans</p>
                <p className="text-2xl font-bold">{categories.reduce((sum, c) => sum + c.artisanCount, 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{categories.reduce((sum, c) => sum + c.productCount, 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  placeholder="Search categories by name, description, or subcategories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterFeatured} onValueChange={setFilterFeatured}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="featured">Featured Only</SelectItem>
                <SelectItem value="not-featured">Not Featured</SelectItem>
              </SelectContent>
            </Select>
            {(searchTerm || filterFeatured !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setFilterFeatured("all");
                }}
                className="flex items-center gap-2"
              >
                Clear Filters
              </Button>
            )}
          </div>
          {(searchTerm || filterFeatured !== "all") && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredCategories.length} of {categories.length} categories
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {/* Select All Checkbox */}
        {filteredCategories.length > 0 && (
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg">
            <Checkbox
              checked={selectedCategories.length === filteredCategories.length && filteredCategories.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm font-medium">
              Select All ({selectedCategories.length} of {filteredCategories.length} selected)
            </span>
          </div>
        )}

        {filteredCategories.map((category) => (
          <Card key={category.id} className={selectedCategories.includes(category.id) ? 'ring-2 ring-primary' : ''}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={(checked) => handleSelectCategory(category.id, checked as boolean)}
                  />
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {category.name}
                      {category.featured && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                    </CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(category)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(category)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === category.id}
                      >
                        {deletingId === category.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                          Delete Category
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{category.name}"? This action cannot be undone.
                          All products in this category will be affected.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(category.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Category
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span>{category.productCount} products</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{category.artisanCount} artisans</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Icon:</span> {category.icon}
                </div>
                <div>
                  <span className="text-muted-foreground">Featured:</span>{" "}
                  <Badge variant={category.featured ? "default" : "secondary"}>
                    {category.featured ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-muted-foreground">Subcategories:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {category.subcategories.map((sub, index) => (
                    <Badge key={index} variant="outline">{sub}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCategory?.id.startsWith('category-') ? 'Add' : 'Edit'} Category</DialogTitle>
            <DialogDescription>
              {editingCategory?.id.startsWith('category-') ? 'Create a new category' : 'Update category information'}
            </DialogDescription>
          </DialogHeader>

          {editingCategory && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    placeholder="Category name"
                  />
                </div>
                <div>
                  <Label htmlFor="icon">Icon</Label>
                  <Select
                    value={editingCategory.icon}
                    onValueChange={(value) => setEditingCategory({ ...editingCategory, icon: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingCategory.description}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Category description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category Image</Label>
                  <SingleImageUpload
                    value={editingCategory?.image?.[0] || ""}
                    onChange={(url) => {
                      setEditingCategory({ ...editingCategory, image: [url] });
                    }}
                    placeholder="Upload category image"
                  />
                  {editingCategory.image[0] && (
                    <div className="mt-2">
                      <img
                        src={editingCategory.image[0]}
                        alt="Category preview"
                        className="w-20 h-20 object-cover rounded border"
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="featured"
                    checked={editingCategory.featured}
                    onCheckedChange={(checked) => setEditingCategory({ ...editingCategory, featured: !!checked })}
                  />
                  <Label htmlFor="featured">Featured Category</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="productCount">Product Count</Label>
                  <Input
                    id="productCount"
                    type="number"
                    value={editingCategory.productCount}
                    onChange={(e) => setEditingCategory({ ...editingCategory, productCount: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="artisanCount">Artisan Count</Label>
                  <Input
                    id="artisanCount"
                    type="number"
                    value={editingCategory.artisanCount}
                    onChange={(e) => setEditingCategory({ ...editingCategory, artisanCount: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <Label>Subcategories</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newSubcategory}
                    onChange={(e) => setNewSubcategory(e.target.value)}
                    placeholder="Add subcategory"
                    onKeyPress={(e) => e.key === 'Enter' && addSubcategory()}
                  />
                  <Button type="button" variant="outline" onClick={addSubcategory}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {editingCategory.subcategories.map((sub, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeSubcategory(index)}>
                      {sub} ×
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {saving ? "Saving..." : "Save Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: {previewCategory?.name}</DialogTitle>
            <DialogDescription>
              How the category will appear on the categories page
            </DialogDescription>
          </DialogHeader>

          {previewCategory && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{previewCategory.name}</h3>
                  {previewCategory.featured && <Star className="w-4 h-4 text-yellow-500 fill-current" />}
                </div>
                <p className="text-muted-foreground mb-3">{previewCategory.description}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{previewCategory.productCount} products</span>
                  <span>{previewCategory.artisanCount} artisans</span>
                </div>
                <div className="mt-3">
                  <span className="text-sm font-medium">Subcategories:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {previewCategory.subcategories.map((sub, index) => (
                      <Badge key={index} variant="outline" className="text-xs">{sub}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Categories</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCategories.length} selected categories?
              This action cannot be undone and will permanently remove these categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Delete {selectedCategories.length} Categories
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};