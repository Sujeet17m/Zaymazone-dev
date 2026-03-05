import { useState, useRef, useMemo, useEffect, useLayoutEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Heart, Share2, Star, MapPin, Truck, Shield, RotateCcw, ArrowLeft, ShoppingCart, ShoppingBag, FileText, Settings, MessageSquare, Play, Ruler, Box, Pause, ZoomIn, ZoomOut, RotateCcw as ResetIcon, RotateCw } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProduct } from "@/hooks/useProducts";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { getImageUrl, Product } from "@/lib/api";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics";
import SocialShare from "@/components/SocialShare";
import SEO from "@/components/SEO";
import { ProductVideoPlayer } from "@/components/ProductVideoPlayer";
import { MaterialCareGuide } from "@/components/MaterialCareGuide";
import { parseVideoUrl } from "@/lib/videoUtils";
import { VideoEmbed } from "@/components/VideoEmbed";

const RATING_BARS = [
  { pct: 'w-[82%]', count: 42 },
  { pct: 'w-[65%]', count: 28 },
  { pct: 'w-[38%]', count: 12 },
  { pct: 'w-[20%]', count: 8 },
  { pct: 'w-[10%]', count: 4 },
];

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const zoomImgRef = useRef<HTMLImageElement>(null);
  // Set CSS custom properties for zoom via DOM ref — avoids inline style prop
  useLayoutEffect(() => {
    if (!zoomImgRef.current) return;
    zoomImgRef.current.style.setProperty(
      '--zoom-transform',
      isHovering ? 'scale(2)' : `scale(${zoomLevel})`
    );
    zoomImgRef.current.style.setProperty(
      '--zoom-origin',
      isHovering ? `${mousePosition.x}% ${mousePosition.y}%` : 'center center'
    );
  }, [isHovering, mousePosition.x, mousePosition.y, zoomLevel]);

  // Mock product for Paytm testing
  const mockProduct = useMemo<Product | null>(() => {
    if (id === 'mock-paytm-test-product') {
      return {
        id: "mock-paytm-test-product",
        name: "🧪 TEST PRODUCT - Paytm Payment Gateway",
        description: "This is a test product for demonstrating the Paytm payment gateway integration. Click to test the complete payment flow without real money. Features mock payment simulation.",
        price: 1, // Very low price to indicate it's a test
        images: ["/placeholder.svg"],
        category: "test",
        subcategory: "payment-testing",
        materials: ["test"],
        dimensions: "N/A",
        weight: "0kg",
        colors: ["test"],
        inStock: true,
        stockCount: 999,
        artisan: {
          id: "test-artisan",
          name: "Payment Test Team",
          location: "Online",
          bio: "Specialized in testing payment integrations",
          avatar: "/placeholder.svg",
          rating: 5.0,
          totalProducts: 1
        },
        rating: 5.0,
        reviewCount: 100,
        tags: ["test", "mock", "paytm", "payment", "demo"],
        isHandmade: false,
        shippingTime: "Instant (test)",
        featured: true, // Make it featured so it stands out
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return null;
  }, [id]);

  const { data: apiProduct, isLoading, error } = useProduct(id || '');
  const { addToCart, isLoading: cartLoading } = useCart();
  const { isAuthenticated } = useAuth();

  // Use mock product if available, otherwise use API product
  const product = mockProduct || apiProduct;

  // Track product view - moved to top before any conditional returns
  useEffect(() => {
    if (product) {
      analytics.viewProduct({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price
      });
    }
  }, [product]);

  // Combine images and videos into a single media array for unified display
  const combinedMedia = product ? [
    ...(product.images || []).map((image, index) => ({
      type: 'image' as const,
      url: image,
      thumbnail: image,
      index: index,
      alt: `${product.name} view ${index + 1}`
    })),
    ...(product.videos || []).map((video, index) => ({
      type: 'video' as const,
      url: video.url,
      thumbnail: video.thumbnail || video.url,
      index: (product.images || []).length + index,
      alt: video.title || `${product.name} video ${index + 1}`,
      title: video.title,
      duration: video.duration
    }))
  ] : [];

  // Auto-spin functionality
  useEffect(() => {
    if (isAutoSpinning && combinedMedia.length > 1) {
      const interval = setInterval(() => {
        setSelectedMediaIndex((prev) => (prev + 1) % combinedMedia.length);
      }, 2000); // Change media every 2 seconds
      spinIntervalRef.current = interval;
      return () => clearInterval(interval);
    } else {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
    }
  }, [isAutoSpinning, combinedMedia.length]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
      }
    };
  }, []);

  const handleAddToCart = async () => {
    // For mock products, skip cart and show success message
    if (product?.id === 'mock-paytm-test-product') {
      toast.success('Mock product added to cart (test mode)');
      return;
    }

    if (!isAuthenticated) {
      toast.error('Please sign in to add items to cart');
      return;
    }

    if (!product?.inStock || product?.stockCount === 0) {
      toast.error('This item is out of stock');
      return;
    }

    try {
      await addToCart(product.id, quantity);
      // Track add to cart event
      analytics.addToCart({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price
      }, quantity);
    } catch (error) {
      // Error is already handled in the cart context
    }
  };

  const handleBuyNow = async () => {
    // For mock products, go directly to checkout
    if (product?.id === 'mock-paytm-test-product') {
      navigate('/checkout', {
        state: {
          directPurchase: true,
          product: product,
          quantity: quantity
        }
      });
      return;
    }

    if (!isAuthenticated) {
      toast.error('Please sign in to purchase');
      navigate('/sign-in');
      return;
    }

    if (!product?.inStock || product?.stockCount === 0) {
      toast.error('This item is out of stock');
      return;
    }

    // Add to cart first, then redirect to checkout
    try {
      await addToCart(product.id, quantity);
      navigate('/checkout');
    } catch (error) {
      // Error is already handled in the cart context
    }
  };

  const toggleAutoSpin = () => {
    setIsAutoSpinning(!isAutoSpinning);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3)); // Max zoom 3x
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5)); // Min zoom 0.5x
  };

  const resetZoom = () => {
    setZoomLevel(1);
  };

  const handleMouseEnter = () => {
    if (combinedMedia[selectedMediaIndex]?.type === 'image') {
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mediaContainerRef.current) return;

    const rect = mediaContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setMousePosition({ x, y });
  };

  const handleMediaClick = (index: number) => {
    setSelectedMediaIndex(index);
    // Stop auto-spin when user manually selects media
    if (isAutoSpinning) {
      setIsAutoSpinning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            {error ? 'Error loading product' : 'Product not found'}
          </h1>
          <p className="text-muted-foreground mb-6">
            {error instanceof Error ? error.message : 'The product you\'re looking for doesn\'t exist.'}
          </p>
          <Link to="/shop">
            <Button>Back to Shop</Button>
          </Link>
        </div>
      </div>
    );
  }

  const discountPercentage = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {product && (
        <SEO
          title={`${product.name} - Zaymazone`}
          description={product.description || `Buy authentic ${product.name} handcrafted by skilled artisans. ${product.category} from Zaymazone.`}
          keywords={`${product.name}, ${product.category}, handcrafted, artisan, ${product.tags?.join(', ') || ''}`}
          image={getImageUrl(product.images[0])}
          type="product"
          structuredData={{
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.name,
            "description": product.description,
            "image": product.images.map(img => getImageUrl(img)),
            "brand": {
              "@type": "Brand",
              "name": "Zaymazone"
            },
            "offers": {
              "@type": "Offer",
              "price": product.price,
              "priceCurrency": "INR",
              "availability": product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              "seller": {
                "@type": "Organization",
                "name": "Zaymazone"
              }
            },
            "aggregateRating": product.rating ? {
              "@type": "AggregateRating",
              "ratingValue": product.rating,
              "reviewCount": product.reviewCount || 0
            } : undefined
          }}
        />
      )}
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 mobile-product-detail">
        {/* Breadcrumb - Hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-primary">Shop</Link>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </div>

        {/* Back Button */}
        <Link to="/shop" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4 sm:mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </Link>

        <div className="grid lg:grid-cols-2 gap-6 lg:gap-12">
          {/* Product Images and Videos */}
          <div className="w-full">
            {/* Main Media Display with Controls */}
            <div
              ref={mediaContainerRef}
              className="relative aspect-square bg-card rounded-xl sm:rounded-2xl overflow-hidden mb-3 sm:mb-4 max-w-full group cursor-zoom-in"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onMouseMove={handleMouseMove}
            >
              {combinedMedia[selectedMediaIndex]?.type === 'video' ? (
                <VideoEmbed
                  url={combinedMedia[selectedMediaIndex].url}
                  title={combinedMedia[selectedMediaIndex].title || combinedMedia[selectedMediaIndex].alt}
                  thumbnail={combinedMedia[selectedMediaIndex].thumbnail}
                  className="w-full h-full object-cover object-center"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center'
                  }}
                  onPlay={() => setIsAutoSpinning(false)} // Stop auto-spin when video plays
                />
              ) : (
                <img
                  ref={zoomImgRef}
                  src={getImageUrl(combinedMedia[selectedMediaIndex]?.url)}
                  alt={combinedMedia[selectedMediaIndex]?.alt}
                  className="w-full h-full object-cover object-center transition-transform duration-300 ease-in-out img-zoom-dynamic"
                />
              )}

              {/* Media Controls Overlay */}
              <div className={`absolute top-3 right-3 flex flex-col gap-2 transition-opacity duration-200 ${isHovering ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                {/* Auto-spin Control */}
                {combinedMedia.length > 1 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={toggleAutoSpin}
                    className="w-10 h-10 p-0 bg-black/50 hover:bg-black/70 border-0 text-white backdrop-blur-sm"
                    title={isAutoSpinning ? "Stop auto-spin" : "Start auto-spin"}
                  >
                    {isAutoSpinning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                )}

                {/* Zoom Controls - Only show for images */}
                {combinedMedia[selectedMediaIndex]?.type === 'image' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleZoomIn}
                      disabled={zoomLevel >= 3}
                      className="w-10 h-10 p-0 bg-black/50 hover:bg-black/70 border-0 text-white backdrop-blur-sm disabled:opacity-50"
                      title="Zoom in"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleZoomOut}
                      disabled={zoomLevel <= 0.5}
                      className="w-10 h-10 p-0 bg-black/50 hover:bg-black/70 border-0 text-white backdrop-blur-sm disabled:opacity-50"
                      title="Zoom out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={resetZoom}
                      disabled={zoomLevel === 1}
                      className="w-10 h-10 p-0 bg-black/50 hover:bg-black/70 border-0 text-white backdrop-blur-sm disabled:opacity-50"
                      title="Reset zoom"
                    >
                      <ResetIcon className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Zoom Indicator */}
              {combinedMedia[selectedMediaIndex]?.type === 'image' && !isHovering && (
                <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <ZoomIn className="w-3 h-3" />
                  Hover to zoom
                </div>
              )}

              {/* Zoom Level Indicator */}
              {combinedMedia[selectedMediaIndex]?.type === 'image' && isHovering && (
                <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
                  <ZoomIn className="w-3 h-3" />
                  Zoomed
                </div>
              )}

              {/* Video Indicator */}
              {combinedMedia[selectedMediaIndex]?.type === 'video' && (
                <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
                  <Play className="w-3 h-3" />
                  Video
                </div>
              )}
            </div>

            {/* Thumbnail Images and Videos */}
            {combinedMedia.length > 1 && (
              <div className="grid grid-cols-4 gap-2 max-w-full overflow-hidden">
                {combinedMedia.map((media, index) => (
                  <button
                    key={index}
                    onClick={() => handleMediaClick(index)}
                    aria-label={`View ${media.alt}`}
                    className={`relative aspect-square rounded-md sm:rounded-lg overflow-hidden border-2 transition-colors max-w-full ${
                      selectedMediaIndex === index
                        ? 'border-primary'
                        : 'border-transparent hover:border-primary/50'
                    }`}
                  >
                    {media.type === 'video' ? (
                      <>
                        <img
                          src={media.thumbnail}
                          alt={media.alt}
                          className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/50 rounded-full p-1">
                            <Play className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <img
                        src={media.url}
                        alt={media.alt}
                        className="w-full h-full object-cover object-center"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="w-full min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
              {product.featured && (
                <Badge className="bg-primary text-primary-foreground text-xs sm:text-sm">Featured</Badge>
              )}
              {product.isHandmade && (
                <Badge variant="secondary" className="bg-accent text-accent-foreground text-xs sm:text-sm">
                  Handmade
                </Badge>
              )}
              {discountPercentage > 0 && (
                <Badge variant="destructive" className="text-xs sm:text-sm">{discountPercentage}% OFF</Badge>
              )}
            </div>

            {/* Title and Rating */}
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4 leading-tight break-words">{product.name}</h1>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 sm:w-4 sm:h-4 ${
                        i < Math.floor(product.rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-medium text-sm sm:text-base">{product.rating}</span>
                <span className="text-muted-foreground text-xs sm:text-sm">({product.reviewCount} reviews)</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <span className="text-2xl sm:text-4xl font-bold text-foreground">
                ₹{product.price.toLocaleString()}
              </span>
              {product.originalPrice && (
                <span className="text-lg sm:text-xl text-muted-foreground line-through">
                  ₹{product.originalPrice.toLocaleString()}
                </span>
              )}
            </div>

            {/* Stock Status */}
            <div className="mb-4 sm:mb-6">
              {product.inStock ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-green-600">In Stock</span>
                  {product.stockCount <= 5 && (
                    <span className="text-destructive">
                      Only {product.stockCount} left!
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-red-600">Out of Stock</span>
                </div>
              )}
            </div>

            {/* Quantity and Purchase Actions */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              {/* Quantity Selector */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border border-input rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease quantity"
                    className="px-2 sm:px-3 py-2 hover:bg-accent text-sm sm:text-base"
                    disabled={quantity <= 1}
                  >
                    -
                  </button>
                  <span className="px-3 sm:px-4 py-2 border-x border-input text-sm sm:text-base">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label="Increase quantity"
                    className="px-2 sm:px-3 py-2 hover:bg-accent text-sm sm:text-base"
                    disabled={quantity >= product.stockCount}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  className="flex-1 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-sm sm:text-base"
                  disabled={!product.inStock || cartLoading}
                  onClick={handleBuyNow}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  {!product.inStock ? 'Out of Stock' : 'Buy Now'}
                </Button>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1 text-sm sm:text-base"
                    disabled={!product.inStock || cartLoading}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {cartLoading ? 'Adding...' : 'Add to Cart'}
                  </Button>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <Heart className="w-4 h-4" />
                  </Button>
                  <SocialShare
                    title={`${product.name} - Zaymazone`}
                    description={product.description}
                    hashtags={["handcrafted", product.category.toLowerCase()]}
                    size="sm"
                    className="ml-2"
                  />
                </div>
              </div>
            </div>

            {/* Artisan Info */}
            {product.artisan && (
              <div className="bg-card rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
                <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Meet the Artisan</h3>
                <div className="flex items-start gap-3 sm:gap-4">
                  <Avatar className="w-10 h-10 sm:w-12 sm:h-12 shrink-0">
                    <AvatarImage src={product.artisan.avatar} />
                    <AvatarFallback>{product.artisan.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm sm:text-base break-words">{product.artisan.name}</h4>
                    <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground mb-2">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="break-words">{product.artisan.location}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 break-words">{product.artisan.bio}</p>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0" />
                        <span>{product.artisan.rating}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {product.artisan.totalProducts} products
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Shipping Info */}
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 sm:gap-3">
                <Truck className="w-4 h-4 text-primary shrink-0" />
                <span className="break-words">Free shipping on orders above ₹999</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <RotateCcw className="w-4 h-4 text-primary shrink-0" />
                <span className="break-words">7-day return policy</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <span className="break-words">100% authentic handcrafted products</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mt-8 sm:mt-16">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 h-auto p-1 bg-muted/50 rounded-xl border border-border/50">
              <TabsTrigger value="description" className="flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-3 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border hover:bg-background/80 hover:text-foreground hover:shadow-sm transition-all duration-200 ease-in-out text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Description</span>
                <span className="sm:hidden">Desc</span>
              </TabsTrigger>
              <TabsTrigger value="specifications" className="flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-3 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border hover:bg-background/80 hover:text-foreground hover:shadow-sm transition-all duration-200 ease-in-out text-muted-foreground">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Specs</span>
                <span className="sm:hidden">Specs</span>
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-3 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border hover:bg-background/80 hover:text-foreground hover:shadow-sm transition-all duration-200 ease-in-out text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Reviews</span>
                <span className="sm:hidden">Reviews</span>
              </TabsTrigger>
              {product.model3d && (
                <TabsTrigger value="3dmodel" className="flex items-center gap-2 text-xs sm:text-sm px-2 sm:px-3 py-3 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-2 data-[state=active]:border-purple-500/50 hover:bg-background/80 hover:text-foreground hover:shadow-sm hover:border-purple-500/30 transition-all duration-200 ease-in-out text-muted-foreground border border-purple-500/20">
                  <Box className="w-4 h-4 text-purple-500" />
                  <span className="hidden sm:inline">3D Model</span>
                  <span className="sm:hidden">3D</span>
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="description" className="mt-4 sm:mt-6">
              <div className="prose max-w-none">
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed break-words">
                  {product.description}
                </p>
                
                <h4 className="font-semibold mt-4 sm:mt-6 mb-3 text-sm sm:text-base">Materials & Craftsmanship</h4>
                <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-muted-foreground">
                  {product.materials.map((material, index) => (
                    <li key={index} className="break-words">{material}</li>
                  ))}
                </ul>

                <h4 className="font-semibold mt-4 sm:mt-6 mb-3 text-sm sm:text-base">Care Instructions</h4>
                <p className="text-xs sm:text-sm text-muted-foreground break-words">
                  Handle with care. Clean with a soft, dry cloth. Avoid exposure to direct sunlight for extended periods.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="specifications" className="mt-4 sm:mt-6">
              <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
                <div className="min-w-0">
                  <h4 className="font-semibold mb-3 text-sm sm:text-base">Product Details</h4>
                  <dl className="space-y-2">
                    <div className="flex justify-between flex-wrap">
                      <dt className="text-xs sm:text-sm text-muted-foreground">Dimensions:</dt>
                      <dd className="text-xs sm:text-sm break-words">{product.dimensions}</dd>
                    </div>
                    <div className="flex justify-between flex-wrap">
                      <dt className="text-xs sm:text-sm text-muted-foreground">Weight:</dt>
                      <dd className="text-xs sm:text-sm break-words">{product.weight}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Materials:</dt>
                      <dd>{product.materials.join(", ")}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Colors:</dt>
                      <dd>{product.colors.join(", ")}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Shipping & Returns</h4>
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Shipping Time:</dt>
                      <dd>{product.shippingTime}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Return Policy:</dt>
                      <dd>7 days</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Warranty:</dt>
                      <dd>1 year</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="reviews" className="mt-6">
              <div className="space-y-6">
                {/* Review Summary */}
                <div className="flex items-center gap-8 p-6 bg-card rounded-xl">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-foreground mb-1">{product.rating}</div>
                    <div className="flex items-center gap-1 mb-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(product.rating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">{product.reviewCount} reviews</div>
                  </div>
                  
                  <div className="flex-1">
                    {[5, 4, 3, 2, 1].map((rating, i) => (
                      <div key={rating} className="flex items-center gap-2 mb-1">
                        <span className="text-sm w-2">{rating}</span>
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div className={`bg-yellow-400 h-2 rounded-full ${RATING_BARS[i].pct}`}></div>
                        </div>
                        <span className="text-sm text-muted-foreground w-8">
                          {RATING_BARS[i].count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample Reviews */}
                <div className="space-y-4">
                  {[
                    {
                      name: "Priya M.",
                      rating: 5,
                      date: "2 weeks ago",
                      comment: "Absolutely beautiful craftsmanship! The attention to detail is incredible and it arrived perfectly packaged.",
                      verified: true
                    },
                    {
                      name: "Rajesh K.",
                      rating: 4,
                      date: "1 month ago", 
                      comment: "Great quality product. Shipping was fast and the artisan's work is truly impressive.",
                      verified: true
                    },
                    {
                      name: "Sarah L.",
                      rating: 5,
                      date: "3 weeks ago",
                      comment: "This piece adds such character to my home. Love supporting traditional artisans!",
                      verified: false
                    }
                  ].map((review, index) => (
                    <div key={index} className="border-b border-border pb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{review.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{review.name}</span>
                            {review.verified && (
                              <Badge variant="secondary" className="text-xs">Verified Purchase</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < review.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">{review.date}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground ml-11">{review.comment}</p>
                    </div>
                  ))}
                </div>

                <Button variant="outline" className="w-full">
                  Write a Review
                </Button>
              </div>
            </TabsContent>

            {/* 3D Model Tab */}
            {product.model3d && (
              <TabsContent value="3dmodel" className="mt-4 sm:mt-6">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">{product.model3d.title}</h3>
                      <p className="text-gray-600">{product.model3d.description}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                      <model-viewer
                        src={product.model3d.url}
                        alt={product.model3d.title}
                        camera-controls
                        auto-rotate
                        ar
                        ar-modes="webxr scene-viewer quick-look"
                        class="model-viewer w-full h-[500px]"
                      >
                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                          🖱️ Drag to rotate • 🔍 Scroll to zoom • 👆 Tap for AR
                        </div>
                        <div slot="progress-bar" className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                          <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-gray-600">
                            Loading 3D model...
                          </div>
                        </div>
                      </model-viewer>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-500">
                        Interactive 3D model - Rotate, zoom, and view in augmented reality
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductDetail;