import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search, MapPin, Star, Award, Users, Palette } from "lucide-react";
import { Link } from "react-router-dom";
import { api, type Artisan } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
// Module 11
import { VerifiedBadge } from "@/components/trust/VerifiedBadge";

const ArtisansWithBackend = () => {
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Fetch artisans from backend
  useEffect(() => {
    const fetchArtisans = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getArtisans();
        setArtisans(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load artisans";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchArtisans();
  }, [toast]);

  // Filter artisans based on search query
  const filteredArtisans = artisans.filter(artisan =>
    artisan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    artisan.specialties.some(specialty => 
      specialty.toLowerCase().includes(searchQuery.toLowerCase())
    ) ||
    artisan.location.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    artisan.location.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading artisans...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <p>Failed to load artisans. Please make sure the backend server is running.</p>
              <p className="text-sm text-muted-foreground mt-2">Error: {error}</p>
            </div>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const totalArtisans = artisans.length;
  const verifiedArtisans = artisans.filter(a => a.verification.isVerified).length;
  const totalProducts = artisans.reduce((sum, a) => sum + a.totalProducts, 0);
  const averageExperience = Math.round(artisans.reduce((sum, a) => sum + a.experience, 0) / totalArtisans);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            Meet Our Artisans
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Discover the talented craftspeople behind every unique creation. Each artisan brings 
            years of tradition, skill, and passion to their handmade works.
          </p>

          {/* Search */}
          <div className="max-w-md mx-auto relative mb-8">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search artisans by name, craft, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">{totalArtisans}</div>
            <div className="text-sm text-muted-foreground">Master Artisans</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">{verifiedArtisans}</div>
            <div className="text-sm text-muted-foreground">Verified Artists</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">{totalProducts}</div>
            <div className="text-sm text-muted-foreground">Unique Products</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">{averageExperience}+</div>
            <div className="text-sm text-muted-foreground">Avg. Experience</div>
          </div>
        </div>

        {/* Results Count */}
        {searchQuery && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              Found {filteredArtisans.length} artisan{filteredArtisans.length !== 1 ? 's' : ''} 
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        )}

        {/* Artisans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
          {filteredArtisans.map((artisan) => (
            <Card key={artisan._id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
              <CardHeader className="p-0">
                <div className="relative">
                  <div className="h-48 bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center">
                    <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
                      <AvatarImage src={artisan.avatar} alt={artisan.name} />
                      <AvatarFallback className="text-lg font-semibold">
                        {artisan.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {artisan.verification.isVerified && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-green-100 text-green-800 border-green-300">
                        <Award className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <h3 className="text-xl font-semibold">{artisan.name}</h3>
                    <VerifiedBadge
                      verified={artisan.verification.isVerified}
                      verifiedAt={artisan.verification.verifiedAt}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-2">
                    <MapPin className="w-3 h-3" />
                    {artisan.location.city}, {artisan.location.state}
                  </div>
                  <div className="flex items-center justify-center gap-1 mb-3">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{artisan.rating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">
                      ({artisan.totalRatings} reviews)
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Specialties */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Palette className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Specialties</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {artisan.specialties.slice(0, 3).map(specialty => (
                        <Badge key={specialty} variant="secondary" className="text-xs capitalize">
                          {specialty}
                        </Badge>
                      ))}
                      {artisan.specialties.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{artisan.specialties.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div className="text-center">
                      <div className="text-sm font-semibold text-primary">{artisan.experience}+ years</div>
                      <div className="text-xs text-muted-foreground">Experience</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-primary">{artisan.totalProducts}</div>
                      <div className="text-xs text-muted-foreground">Products</div>
                    </div>
                  </div>

                  {/* Bio preview */}
                  {artisan.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-3">
                      {artisan.bio}
                    </p>
                  )}
                </div>

                <div className="mt-6">
                  <Button asChild className="w-full" variant="outline">
                    <Link to={`/artisan/${artisan._id}`}>
                      View Profile
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No results */}
        {filteredArtisans.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No artisans found</h3>
            <p className="text-muted-foreground mb-4">
              Try searching with different keywords or browse all artisans.
            </p>
            <Button onClick={() => setSearchQuery("")} variant="outline">
              Clear Search
            </Button>
          </div>
        )}

        {/* CTA Section */}
        <div className="bg-primary/5 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-4">
            Want to Join Our Artisan Community?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            If you're a skilled craftsperson looking to share your creations with the world, 
            we'd love to hear from you. Join our community of artisans and reach customers globally.
          </p>
          <Button className="btn-hero" asChild>
            <Link to="/sign-up-artisan">
              Apply to Become an Artisan
            </Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ArtisansWithBackend;