import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Eye, Package, Users, UserCheck, Clock } from "lucide-react";
import { adminService } from "@/services/adminService";
import { useToast } from "@/hooks/use-toast";

export function ApprovalManagement() {
  const [activeTab, setActiveTab] = useState("products");
  const [selectedItem, setSelectedItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [pendingArtisans, setPendingArtisans] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    if (adminService.isAuthenticated()) {
      loadPendingApprovals();
    }
  }, []);

  const loadPendingApprovals = async () => {
    setLoading(true);
    try {
      const [productsRes, artisansRes, usersRes] = await Promise.all([
        adminService.getPendingProducts(),
        adminService.getPendingArtisans(),
        adminService.getPendingUsers()
      ]);
      
      setPendingProducts(productsRes.products || []);
      setPendingArtisans(artisansRes.artisans || []);
      setPendingUsers(usersRes.users || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load pending approvals",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (type, id) => {
    try {
      if (type === 'product') {
        await adminService.approveProduct(id);
        setPendingProducts(prev => prev.filter(p => p._id !== id));
      } else if (type === 'artisan') {
        await adminService.approveArtisan(id);
        setPendingArtisans(prev => prev.filter(a => a._id !== id));
      }
      
      toast({
        title: "Success",
        description: `${type} approved successfully`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to approve ${type}`,
        variant: "destructive"
      });
    }
  };

  const handleReject = async (type, id) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive"
      });
      return;
    }
    
    try {
      if (type === 'product') {
        await adminService.rejectProduct(id, rejectionReason);
        setPendingProducts(prev => prev.filter(p => p._id !== id));
      } else if (type === 'artisan') {
        await adminService.rejectArtisan(id, rejectionReason);
        setPendingArtisans(prev => prev.filter(a => a._id !== id));
      }
      
      toast({
        title: "Success",
        description: `${type} rejected successfully`
      });
      setRejectionReason("");
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to reject ${type}`,
        variant: "destructive"
      });
    }
  };

  const ProductApprovalCard = ({ product }) => (
    <Card className="mb-4">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={product.images?.[0] || "/placeholder.svg"} />
            <AvatarFallback><Package className="w-6 h-6" /></AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-sm text-muted-foreground">by {product.artisanId?.name || product.artisan?.name || 'Unknown Artisan'}</p>
                <Badge variant="outline" className="mt-1">{product.category}</Badge>
              </div>
              <div className="text-right">
                <p className="font-semibold">₹{product.price}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(product.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <p className="text-sm mt-2">{product.description}</p>
            <div className="flex gap-2 mt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{product.name}</DialogTitle>
                    <DialogDescription>Product details for approval</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Artisan</label>
                        <p>{product.artisanId?.name || product.artisan?.name || 'Unknown'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Category</label>
                        <p>{product.category}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Price</label>
                        <p>₹{product.price}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Submitted</label>
                        <p>{new Date(product.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <p>{product.description}</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                size="sm"
                onClick={() => handleApprove('product', product._id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject Product</DialogTitle>
                    <DialogDescription>Please provide a reason for rejection</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    placeholder="Reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectionReason("")}>Cancel</Button>
                    <Button variant="destructive" onClick={() => handleReject('product', product._id)}>
                      Reject Product
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ArtisanApprovalCard = ({ artisan }) => (
    <Card className="mb-4">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={artisan.avatar} />
            <AvatarFallback>{artisan.name?.split(' ').map(n => n[0]).join('') || 'A'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{artisan.name}</h3>
                <p className="text-sm text-muted-foreground">{artisan.businessInfo?.businessName || 'Business name not provided'}</p>
                <p className="text-sm text-muted-foreground">{artisan.location?.city}, {artisan.location?.state}</p>
                <Badge variant="outline" className="mt-1">{artisan.specialties?.[0] || 'No specialty'}</Badge>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{artisan.experience || 'N/A'} years experience</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(artisan.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm"><strong>Bio:</strong> {artisan.bio || 'No bio provided'}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{artisan.name}</DialogTitle>
                    <DialogDescription>Artisan application details</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Business Name</label>
                        <p>{artisan.businessInfo?.businessName || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Contact Email</label>
                        <p>{artisan.businessInfo?.contact?.email || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Phone</label>
                        <p>{artisan.businessInfo?.contact?.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Location</label>
                        <p>{artisan.location?.city}, {artisan.location?.state}, {artisan.location?.country}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Specialties</label>
                        <p>{artisan.specialties?.join(', ') || 'Not specified'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Experience</label>
                        <p>{artisan.experience ? `${artisan.experience} years` : 'Not specified'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">GST Number</label>
                        <p>{artisan.businessInfo?.gstNumber || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Applied</label>
                        <p>{new Date(artisan.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Bio</label>
                      <p>{artisan.bio || 'No bio provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Product Description</label>
                      <p>{artisan.productInfo?.description || 'Not provided'}</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                size="sm"
                onClick={() => handleApprove('artisan', artisan._id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject Artisan Application</DialogTitle>
                    <DialogDescription>Please provide a reason for rejection</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    placeholder="Reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectionReason("")}>Cancel</Button>
                    <Button variant="destructive" onClick={() => handleReject('artisan', artisan._id)}>
                      Reject Application
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const UserApprovalCard = ({ user }) => (
    <Card className="mb-4">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src={user.avatar} />
              <AvatarFallback>{user.name?.split(' ').map(n => n[0]).join('') || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-sm text-muted-foreground">{user.phone || 'No phone'}</p>
              <Badge variant="outline" className="mt-1">{user.emailVerified ? 'Email Verified' : 'Email Pending'}</Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => handleApprove('user', user._id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject User</DialogTitle>
                    <DialogDescription>Please provide a reason for rejection</DialogDescription>
                  </DialogHeader>
                  <Textarea
                    placeholder="Reason for rejection..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRejectionReason("")}>Cancel</Button>
                    <Button variant="destructive" onClick={() => handleReject('user', user._id)}>
                      Reject User
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-6 h-6" />
        <h2 className="text-2xl font-bold">Approval Management</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Products ({pendingProducts.length})
          </TabsTrigger>
          <TabsTrigger value="artisans" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Artisans ({pendingArtisans.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Users ({pendingUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Pending Product Approvals
              </CardTitle>
              <CardDescription>
                Review and approve new products submitted by artisans
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingProducts.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No products pending approval</p>
                </div>
              ) : (
                pendingProducts.map(product => (
                  <ProductApprovalCard key={product._id} product={product} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artisans" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Pending Artisan Approvals
              </CardTitle>
              <CardDescription>
                Review and approve new artisan applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingArtisans.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No artisans pending approval</p>
                </div>
              ) : (
                pendingArtisans.map(artisan => (
                  <ArtisanApprovalCard key={artisan._id} artisan={artisan} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Pending User Approvals
              </CardTitle>
              <CardDescription>
                Review and approve new user registrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingUsers.length === 0 ? (
                <div className="text-center py-8">
                  <UserCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No users pending approval</p>
                </div>
              ) : (
                pendingUsers.map(user => (
                  <UserApprovalCard key={user._id} user={user} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}