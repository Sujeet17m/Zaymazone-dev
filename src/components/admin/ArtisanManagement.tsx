import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Star,
  Award,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { adminService } from "@/services/adminService";
import { useToast } from "@/hooks/use-toast";

export function ArtisanManagement() {
  const [artisans, setArtisans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    bio: "",
    speciality: "",
    experience: "",
    location: {
      city: "",
      state: "",
      country: "India"
    },
    avatar: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadArtisans();
    
    // Set up real-time polling every 60 seconds
    const interval = setInterval(() => {
      loadArtisans();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const loadArtisans = async () => {
    try {
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
      // Set fallback data
      setArtisans([
        {
          id: 1,
          name: "Priya Sharma",
          email: "priya@example.com",
          location: "Jaipur, Rajasthan",
          speciality: "Blue Pottery",
          experience: "15+ years",
          rating: 4.9,
          products: 24,
          totalSales: 89,
          revenue: "₹2,45,000",
          status: "Active",
          joinDate: "2022-03-15",
          avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face"
        },
        {
          id: 2,
          name: "Rajesh Kumar",
          email: "rajesh@example.com",
          location: "Moradabad, UP",
          speciality: "Brass Work",
          experience: "20+ years",
          rating: 4.8,
          products: 18,
          totalSales: 156,
          revenue: "₹3,78,000",
          status: "Active",
          joinDate: "2021-11-08",
          avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

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
      email: "",
      bio: "",
      speciality: "",
      experience: "",
      location: {
        city: "",
        state: "",
        country: "India"
      },
      avatar: ""
    });
  };

  const handleCreateArtisan = async () => {
    try {
      const artisanData = {
        name: formData.name,
        email: formData.email,
        bio: formData.bio,
        speciality: formData.speciality,
        experience: formData.experience,
        location: formData.location,
        avatar: formData.avatar || undefined,
        isActive: true,
        verification: {
          isVerified: false,
          documents: []
        }
      };

      await adminService.createArtisan(artisanData);
      toast({
        title: "Success",
        description: "Artisan created successfully"
      });
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

  const handleApprove = async (artisanId: number) => {
    try {
      await adminService.approveArtisan(artisanId.toString());
      toast({
        title: "Success",
        description: "Artisan approved successfully"
      });
      loadArtisans();
    } catch (error) {
      console.error('Error approving artisan:', error);
      toast({
        title: "Error",
        description: "Failed to approve artisan",
        variant: "destructive"
      });
    }
  };

  const handleReject = async (artisanId: number) => {
    try {
      const reason = prompt("Please provide a reason for rejection:");
      if (reason === null) return; // User cancelled
      
      await adminService.rejectArtisan(artisanId.toString(), reason);
      toast({
        title: "Success",
        description: "Artisan rejected"
      });
      loadArtisans();
    } catch (error) {
      console.error('Error rejecting artisan:', error);
      toast({
        title: "Error",
        description: "Failed to reject artisan",
        variant: "destructive"
      });
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Active": return "default";
      case "Pending": return "secondary";
      case "Suspended": return "destructive";
      default: return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Active": return <CheckCircle className="w-3 h-3" />;
      case "Suspended": return <XCircle className="w-3 h-3" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading artisans...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Artisan Management</CardTitle>
          <CardDescription>Manage artisan profiles and applications</CardDescription>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Artisan
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search artisans..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
          </div>
          <Button variant="outline" onClick={handleSearch}>
            Search
          </Button>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            aria-label="Filter artisans by status"
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {artisans.map((artisan) => (
            <Card key={artisan.id} className="relative">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={artisan.avatar} alt={artisan.name} />
                      <AvatarFallback>{artisan.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{artisan.name}</h3>
                      <p className="text-sm text-muted-foreground">{artisan.email}</p>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(artisan.status)} className="flex items-center gap-1">
                    {getStatusIcon(artisan.status)}
                    {artisan.status}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{artisan.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="w-4 h-4 text-muted-foreground" />
                    <span>{artisan.speciality}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-muted-foreground" />
                    <span>{artisan.rating} rating • {artisan.experience}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{artisan.products}</p>
                    <p className="text-xs text-muted-foreground">Products</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{artisan.totalSales}</p>
                    <p className="text-xs text-muted-foreground">Sales</p>
                  </div>
                </div>

                <div className="text-center mb-4">
                  <p className="text-lg font-semibold text-green-600">{artisan.revenue}</p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>

                <div className="flex gap-2">
                  {artisan.status === "Pending" && (
                    <>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleApprove(artisan.id)}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleReject(artisan.id)}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  {artisan.status === "Active" && (
                    <>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </>
                  )}
                  {artisan.status === "Suspended" && (
                    <Button size="sm" className="w-full">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Reactivate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
