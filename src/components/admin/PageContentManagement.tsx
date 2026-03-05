import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Edit, Save, X, Eye, Loader2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : 'https://zaymazone-backend.onrender.com');

interface PageContent {
  id: string;
  page: string;
  title: string;
  description: string;
  lastUpdated: string;
  updatedBy: string;
}

export const PageContentManagement = () => {
  const [pageContents, setPageContents] = useState<PageContent[]>([]);
  const [editingContent, setEditingContent] = useState<PageContent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Filter page contents based on search
  const filteredPageContents = pageContents.filter(content =>
    content.page.toLowerCase().includes(searchTerm.toLowerCase()) ||
    content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    content.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadPageContents();
  }, []);

  const loadPageContents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/admin/page-content`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch page contents');
      }

      const data = await response.json();
      setPageContents(data.pageContents);
    } catch (error) {
      console.error('Failed to load page contents:', error);
      toast({
        title: "Error Loading Content",
        description: "Failed to load page contents. Using default content.",
        variant: "destructive",
      });
      // Set default content if API fails
      setPageContents([
        {
          id: "shop",
          page: "Shop",
          title: "Shop Artisan Crafts",
          description: "Discover authentic handcrafted treasures from skilled artisans across India",
          lastUpdated: new Date().toISOString().split('T')[0],
          updatedBy: "System"
        },
        {
          id: "artisans",
          page: "Artisans",
          title: "Meet Our Artisans",
          description: "Discover the talented craftspeople behind our beautiful products. Each artisan brings decades of experience and passion to their craft, preserving ancient traditions while creating contemporary masterpieces.",
          lastUpdated: new Date().toISOString().split('T')[0],
          updatedBy: "System"
        },
        {
          id: "categories",
          page: "Categories",
          title: "Explore Categories",
          description: "Browse our curated collection of handcrafted products organized by traditional craft categories",
          lastUpdated: new Date().toISOString().split('T')[0],
          updatedBy: "System"
        },
        {
          id: "blog",
          page: "Blog",
          title: "Craft Stories & Insights",
          description: "Read about the stories behind the crafts, artisan journeys, and insights into India's rich craft heritage",
          lastUpdated: new Date().toISOString().split('T')[0],
          updatedBy: "System"
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (content: PageContent) => {
    setEditingContent({ ...content });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingContent) return;

    // Validate input
    if (!editingContent.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (!editingContent.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Description cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmSave = async () => {
    if (!editingContent) return;

    try {
      setSaving(true);
      setShowConfirmDialog(false);

      const response = await fetch(`${API_BASE}/api/admin/page-content/${editingContent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        },
        body: JSON.stringify({
          title: editingContent.title.trim(),
          description: editingContent.description.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update page content');
      }

      const data = await response.json();

      // Update local state
      setPageContents(prev =>
        prev.map(content =>
          content.id === editingContent.id ? data.content : content
        )
      );

      setIsDialogOpen(false);
      setEditingContent(null);

      toast({
        title: "Content Updated",
        description: `${editingContent.page} page content has been updated successfully.`,
      });
    } catch (error) {
      console.error('Failed to save page content:', error);
      toast({
        title: "Error",
        description: "Failed to update page content. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingContent(null);
    setIsDialogOpen(false);
  };

  const handlePreview = (content: PageContent) => {
    setPreviewContent(content);
    setIsPreviewOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading page contents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Page Content Management</h2>
          <p className="text-muted-foreground">Manage headers and descriptions for public pages</p>
        </div>
        <Button
          variant="outline"
          onClick={loadPageContents}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Pages</p>
                <p className="text-2xl font-bold">{filteredPageContents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Pages</p>
                <p className="text-2xl font-bold">{filteredPageContents.filter(p => p.title && p.description).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-sm font-bold">
                  {filteredPageContents.length > 0 ? 
                    new Date(Math.max(...filteredPageContents.map(p => new Date(p.lastUpdated).getTime()))).toLocaleDateString() 
                    : 'Never'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  placeholder="Search pages by name, title, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {searchTerm && (
              <Button
                variant="outline"
                onClick={() => setSearchTerm("")}
                className="flex items-center gap-2"
              >
                Clear Search
              </Button>
            )}
          </div>
          {searchTerm && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredPageContents.length} of {pageContents.length} pages
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {filteredPageContents.map((content) => (
          <Card key={content.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {content.page}
                    <Badge variant="outline">{content.id}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Last updated: {content.lastUpdated} by {content.updatedBy}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(content)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(content)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Title</Label>
                  <p className="text-lg font-semibold mt-1">{content.title}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-muted-foreground mt-1">{content.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {editingContent?.page} Page Content</DialogTitle>
            <DialogDescription>
              Update the title and description for the {editingContent?.page.toLowerCase()} page.
            </DialogDescription>
          </DialogHeader>

          {editingContent && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editingContent.title}
                  onChange={(e) => setEditingContent({ ...editingContent, title: e.target.value })}
                  placeholder="Enter page title"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingContent.description}
                  onChange={(e) => setEditingContent({ ...editingContent, description: e.target.value })}
                  placeholder="Enter page description"
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Confirm Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update the {editingContent?.page} page content?
              This will change how the page appears to all visitors.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm Update"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: {previewContent?.page} Page</DialogTitle>
            <DialogDescription>
              How the content will appear on the public page
            </DialogDescription>
          </DialogHeader>

          {previewContent && (
            <div className="space-y-6">
              <div className="text-center py-8 bg-muted/50 rounded-lg">
                <h1 className="text-3xl font-bold mb-4">{previewContent.title}</h1>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  {previewContent.description}
                </p>
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
    </div>
  );
};