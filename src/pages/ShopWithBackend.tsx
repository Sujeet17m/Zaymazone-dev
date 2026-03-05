import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, Filter, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { ProductComparison } from "@/components/ProductComparison";
import { ComparisonFloatingButton } from "@/components/ComparisonFloatingButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useProductComparison } from "@/hooks/useProductComparison";
import { productsApi, Product } from "@/lib/api";
import { artisanAnimations } from "@/lib/animations";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { pageContentApi } from "@/services/api";

import { SkeletonGrid } from "@/components/SkeletonCard";

const ShopWithBackend = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [pageContent, setPageContent] = useState({ title: "Shop Artisan Crafts", description: "Discover authentic handcrafted treasures from skilled artisans across India" });
  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  const {
    comparisonProducts,
    isComparisonOpen,
    addToComparison,
    removeFromComparison,
    clearComparison,
    openComparison,
    closeComparison,
    comparisonCount
  } = useProductComparison();

  // Pull-to-refresh functionality
  const handleRefresh = async () => {
    await refetch();
  };

  const { containerRef, isRefreshing, pullProgress, handlers } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
  });

  // Fetch page content
  useEffect(() => {
    const fetchPageContent = async () => {
      try {
        const content = await pageContentApi.getPageContent('shop');
        setPageContent(content);
      } catch (error) {
        console.warn('Failed to fetch shop page content:', error);
        // Keep default content
      }
    };

    fetchPageContent();
  }, []);

  // Use backend API instead of mock data
  const { data: productsData, isLoading, error, refetch } = useQuery({
    queryKey: ['products', { 
      page, 
      limit, 
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      q: searchQuery || undefined,
      minPrice: priceRange.min,
      maxPrice: priceRange.max
    }],
    queryFn: () => productsApi.getAll({
      page,
      limit,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      q: searchQuery || undefined,
      minPrice: priceRange.min,
      maxPrice: priceRange.max
    }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mock product for Paytm testing
  const mockProduct: Product = {
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

  // Combine mock product with backend products
  const allProducts = useMemo(() => {
    // Always include mock product at the beginning
    const mockProducts = [mockProduct];

    if (productsData && productsData.products) {
      return [...mockProducts, ...productsData.products];
    }

    return mockProducts;
  }, [productsData, mockProduct]);  const categories = [
    "pottery", "textiles", "jewelry", "woodwork", 
    "metalwork", "paintings", "crafts", "toys"
  ];

  const priceRanges = [
    { label: "Under ₹1,000", min: 0, max: 999 },
    { label: "₹1,000 - ₹5,000", min: 1000, max: 5000 },
    { label: "₹5,000 - ₹10,000", min: 5000, max: 10000 },
    { label: "Above ₹10,000", min: 10001, max: undefined },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  const handlePriceFilter = (min?: number, max?: number) => {
    setPriceRange({ min, max });
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setPriceRange({});
    setPage(1);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="text-red-600 mb-4">
            <p>Failed to load products. Please make sure the backend server is running.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Error: {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
          <Button onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 overflow-hidden">
        {/* Header */}
        <div className="mb-6 text-center px-2">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            {pageContent.title}
          </h1>
          <p className="text-sm sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            {pageContent.description}
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products, artisans, or materials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          {/* Enhanced Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters Button */}
            <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Clear Filters
            </Button>
          </div>

          {/* Price Range Filters */}
          <div className="flex flex-wrap gap-2">
            {priceRanges.map((range, index) => (
              <Button
                key={index}
                variant={
                  priceRange.min === range.min && priceRange.max === range.max
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => handlePriceFilter(range.min, range.max)}
              >
                {range.label}
              </Button>
            ))}
          </div>

          {/* Active Filters Display */}
          {(categoryFilter !== "all" || Object.keys(priceRange).length > 0 || searchQuery) && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {categoryFilter !== "all" && (
                <Badge variant="secondary" className="gap-1">
                  Category: {categoryFilter}
                  <button onClick={() => setCategoryFilter("all")} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              )}
              {Object.keys(priceRange).length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  Price: ₹{priceRange.min?.toLocaleString()} - ₹{priceRange.max?.toLocaleString()}
                  <button onClick={() => setPriceRange({})} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  Search: {searchQuery}
                  <button onClick={() => setSearchQuery("")} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="mb-6 flex justify-between items-center">
          <p className="text-muted-foreground">
            {isLoading ? (
              "Loading products..."
            ) : (
              `Showing ${allProducts.length} products${productsData ? ` (${productsData.pagination.total} from backend + 1 test product)` : ' (test product only - backend not available)'}`
            )}
          </p>

          {/* Active Filters */}
          <div className="flex gap-2">
            {categoryFilter && categoryFilter !== 'all' && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setCategoryFilter("all")}>
                Category: {categoryFilter} ✕
              </Badge>
            )}
            {(priceRange.min || priceRange.max) && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setPriceRange({})}>
                Price: ₹{priceRange.min || 0} - ₹{priceRange.max || '∞'} ✕
              </Badge>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <SkeletonGrid count={8} />
        )}

        {/* Product Grid - Always show products */}
        {!isLoading && allProducts.length > 0 && (
          <div
            ref={containerRef}
            {...handlers}
            className="relative"
          >
            {/* Pull-to-refresh indicator */}
            {isRefreshing && (
              <div className="mobile-pull-refresh refreshing">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Refreshing...
              </div>
            )}

            <motion.div
              className="shop-products-grid grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5 xl:gap-6 mb-8 px-2 sm:px-0"
              variants={artisanAnimations.container}
              initial="hidden"
              animate="visible"
              style={{
                transform: pullProgress > 0 ? `translateY(${pullProgress * 60}px)` : 'none',
                transition: isRefreshing ? 'none' : 'transform 0.2s ease-out'
              }}
            >
              {allProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  variants={artisanAnimations.gridItem}
                  custom={index}
                >
                  <ProductCard
                    product={product}
                    onAddToComparison={addToComparison}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Pagination - only show if we have backend data */}
            {productsData && productsData.pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!productsData.pagination.hasPrev}
                >
                  Previous
                </Button>

                <div className="flex items-center gap-2">
                  {[...Array(productsData.pagination.totalPages)].map((_, i) => (
                    <Button
                      key={i + 1}
                      variant={page === i + 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!productsData.pagination.hasNext}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Error State - Show products anyway */}
        {error && allProducts.length > 0 && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              ⚠️ Backend products couldn't be loaded, but test products are available for testing Paytm payments.
            </p>
          </div>
        )}

        {/* No Results */}
        {!isLoading && allProducts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-muted-foreground mb-4">No products found</p>
            <p className="text-muted-foreground mb-6">
              Try adjusting your filters or search terms
            </p>
            <Button onClick={clearFilters}>Clear All Filters</Button>
          </div>
        )}
      </main>

      {/* Product Comparison */}
      {comparisonCount > 0 && (
        <ComparisonFloatingButton
          count={comparisonCount}
          onOpen={openComparison}
          onClear={clearComparison}
        />
      )}

      <ProductComparison
        products={comparisonProducts}
        isOpen={isComparisonOpen}
        onClose={closeComparison}
        onRemoveProduct={removeFromComparison}
      />

      <Footer />
    </div>
  );
};

export default ShopWithBackend;