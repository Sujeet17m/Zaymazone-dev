import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProductCard } from "@/components/ProductCard";
import { 
  MapPin, 
  Star, 
  Users, 
  Award, 
  Calendar,
  Phone,
  Mail,
  Globe,
  Heart,
  Share2,
  MessageCircle,
  Package,
  Verified,
  Clock,
  ArrowLeft,
  Loader2,
  Instagram,
  Facebook
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, type Artisan, type Product, getImageUrl } from "@/lib/api";
// Module 11
import { TrustIndicators } from "@/components/trust/TrustIndicators";
import { VerifiedBadge } from "@/components/trust/VerifiedBadge";

const ArtisanDetailWithBackend = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (id) {
      loadArtisanData();
    }
  }, [id]);

  const loadArtisanData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch artisan details
      const artisanData = await api.getArtisan(id!);
      setArtisan(artisanData);
      
      // Fetch artisan's products
      setProductsLoading(true);
      const productsResponse = await api.getProducts({ artisanId: id });
      setProducts(productsResponse.products);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load artisan data";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProductsLoading(false);
    }
  };

  const handleFollowToggle = () => {
    setIsFollowing(!isFollowing);
    toast({
      title: isFollowing ? "Unfollowed" : "Following",
      description: isFollowing 
        ? `You are no longer following ${artisan?.name}` 
        : `You are now following ${artisan?.name}`,
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied!",
      description: "Artisan profile link has been copied to your clipboard.",
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading artisan profile...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error || !artisan) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <p>Failed to load artisan profile.</p>
              {error && <p className="text-sm text-muted-foreground mt-2">Error: {error}</p>}
            </div>
            <div className="space-x-4">
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <Link to="/artisans">Back to Artisans</Link>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/artisans">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Artisans
          </Link>
        </Button>

        {/* Artisan Header */}
        <div className="bg-card rounded-xl overflow-hidden mb-8">
          {/* Cover Image */}
          <div className="h-64 bg-gradient-to-r from-primary/20 to-primary/10 relative">
            {artisan.coverImage && (
              <img 
                src={getImageUrl(artisan.coverImage)} 
                alt={`${artisan.name} cover`}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/20"></div>
          </div>

          {/* Profile Info */}
          <div className="relative px-8 pb-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between -mt-16">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 mb-6 lg:mb-0">
                <Avatar className="w-32 h-32 border-4 border-white shadow-xl relative z-10">
                  <AvatarImage src={getImageUrl(artisan.avatar)} alt={artisan.name} />
                  <AvatarFallback className="text-2xl font-bold">
                    {artisan.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
                    <h1 className="text-3xl font-bold text-foreground">{artisan.name}</h1>
                    <VerifiedBadge
                      verified={artisan.verification.isVerified}
                      verifiedAt={artisan.verification.verifiedAt}
                      size="lg"
                    />
                  </div>
                  
                  <div className="flex items-center gap-1 text-muted-foreground mb-2 justify-center sm:justify-start">
                    <MapPin className="w-4 h-4" />
                    <span>{artisan.location.city}, {artisan.location.state}, {artisan.location.country}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm justify-center sm:justify-start">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{artisan.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground">({artisan.totalRatings} reviews)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-muted-foreground">
                        Joined {new Date(artisan.joinedDate).getFullYear()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant={isFollowing ? "outline" : "default"} 
                  onClick={handleFollowToggle}
                  className="min-w-24"
                >
                  <Heart className={`w-4 h-4 mr-2 ${isFollowing ? 'fill-current' : ''}`} />
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
                <Button>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary mb-1">{artisan.experience}+</div>
              <div className="text-sm text-muted-foreground">Years Experience</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary mb-1">{artisan.totalProducts}</div>
              <div className="text-sm text-muted-foreground">Products</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary mb-1">{artisan.totalSales}</div>
              <div className="text-sm text-muted-foreground">Sales</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary mb-1">{artisan.totalRatings}</div>
              <div className="text-sm text-muted-foreground">Reviews</div>
            </CardContent>
          </Card>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({artisan.totalRatings})</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            {productsLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading products...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={{
                      id: product.id,
                      name: product.name,
                      description: product.description,
                      price: product.price,
                      originalPrice: product.originalPrice,
                      images: product.images,
                      category: product.category,
                      subcategory: product.subcategory || '',
                      materials: product.materials,
                      dimensions: product.dimensions ? 
                        `${product.dimensions.length}cm x ${product.dimensions.width}cm x ${product.dimensions.height}cm` : '',
                      weight: product.weight ? `${product.weight}g` : '',
                      colors: product.colors,
                      inStock: product.stock > 0,
                      stockCount: product.stock,
                      artisan: {
                        id: artisan._id,
                        name: artisan.name,
                        location: `${artisan.location.city}, ${artisan.location.state}`,
                        bio: artisan.bio,
                        avatar: artisan.avatar,
                        rating: artisan.rating,
                        totalProducts: artisan.totalProducts
                      },
                      rating: product.rating,
                      reviewCount: product.reviewCount,
                      tags: product.tags,
                      isHandmade: product.isHandmade,
                      shippingTime: product.shippingTime,
                      featured: product.isFeatured
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No products yet</h3>
                <p className="text-muted-foreground">This artisan hasn't listed any products yet.</p>
              </div>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* Story */}
                <Card>
                  <CardHeader>
                    <CardTitle>Artisan Story</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">
                      {artisan.bio || "This artisan hasn't shared their story yet."}
                    </p>
                  </CardContent>
                </Card>

                {/* Specialties */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Specialties</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {artisan.specialties.map((specialty) => (
                        <Badge key={specialty} variant="secondary" className="capitalize">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                {/* Contact Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Get in Touch</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {artisan.socials?.instagram && (
                      <div className="flex items-center gap-3">
                        <Instagram className="w-5 h-5 text-pink-600" />
                        <a 
                          href={artisan.socials.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline"
                        >
                          Instagram
                        </a>
                      </div>
                    )}
                    {artisan.socials?.facebook && (
                      <div className="flex items-center gap-3">
                        <Facebook className="w-5 h-5 text-blue-600" />
                        <a 
                          href={artisan.socials.facebook}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline"
                        >
                          Facebook
                        </a>
                      </div>
                    )}
                    {artisan.socials?.website && (
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-green-600" />
                        <a 
                          href={artisan.socials.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline"
                        >
                          Website
                        </a>
                      </div>
                    )}
                    
                    <Separator />
                    
                    <Button className="w-full">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Send Message
                    </Button>
                  </CardContent>
                </Card>

                {/* Verification + Trust indicators (Module 11) */}
                <TrustIndicators artisan={artisan} />
              </div>
            </div>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews">
            <div className="text-center py-12">
              <Star className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Reviews coming soon</h3>
              <p className="text-muted-foreground">Review system will be implemented in the next update.</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default ArtisanDetailWithBackend;