import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Star, MapPin, BarChart3, ShoppingCart, ShoppingBag, Check, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/lib/api";
import { getImageUrl } from "@/lib/api";
import { QuickViewDialog } from "./QuickViewDialog";
import { LazyImage } from "./LazyImage";
import { MobileOptimizedImage } from "./MobileOptimizedImage";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  onAddToComparison?: (product: Product) => void;
}

export const ProductCard = ({ product, onQuickView, onAddToComparison }: ProductCardProps) => {
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const { addToCart, isLoading: cartLoading } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist, isLoading: wishlistLoading } = useWishlist();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const inWishlist = useMemo(() => {
    try {
      return isInWishlist(product.id);
    } catch {
      return false;
    }
  }, [isInWishlist, product.id]);

  if (!product) return null;

  const resolvedStockCount: number | null =
    product.stockCount != null ? product.stockCount
    : (product as { stock?: number }).stock != null ? (product as { stock?: number }).stock as number
    : null;

  const isOutOfStock =
    product.inStock === false ||
    (resolvedStockCount !== null && resolvedStockCount === 0);

  const safeProduct = {
    ...product,
    images: product.images && product.images.length > 0 ? product.images : ['/placeholder.svg'],
    name: product.name || 'Unknown Product',
    price: product.price || 0,
    rating: product.rating || 0,
    stockCount: resolvedStockCount ?? 1,
    originalPrice: product.originalPrice,
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) { toast.error('Please sign in to add items to cart'); return; }
    if (isOutOfStock) { toast.error('This item is out of stock'); return; }
    try {
      await addToCart(safeProduct.id, 1);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      toast.success('Added to cart!');
    } catch { /* swallow — toast already shown on individual failures */ }
  };

  const handleBuyNow = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isAuthenticated) { toast.error('Please sign in to purchase'); navigate('/sign-in'); return; }
    if (isOutOfStock) { toast.error('This item is out of stock'); return; }
    navigate('/checkout', { state: { directPurchase: true, product: safeProduct, quantity: 1 } });
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) { toast.error('Please sign in to manage wishlist'); return; }
    try {
      inWishlist ? await removeFromWishlist(safeProduct.id) : await addToWishlist(safeProduct.id);
    } catch { /* swallow — context handles toast notifications */ }
  };

  const discountPercentage = safeProduct.originalPrice
    ? Math.round(((safeProduct.originalPrice - safeProduct.price) / safeProduct.originalPrice) * 100)
    : 0;

  const isMockProduct = safeProduct.id === 'mock-paytm-test-product';

  return (
    <motion.div
      className="group relative bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm hover:shadow-xl transition-shadow duration-300 w-full min-w-0 flex flex-col"
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* ── Image Container ─────────────────────────────────────── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/30">

        {/* Image — zooms on hover via CSS */}
        <div className="w-full h-full transition-transform duration-500 ease-out group-hover:scale-105">
          {isMockProduct ? (
            <div onClick={() => handleBuyNow()} className="w-full h-full cursor-pointer">
              <LazyImage
                src={getImageUrl(safeProduct.images[0])}
                alt={safeProduct.name}
                className="w-full h-full object-cover object-center"
              />
            </div>
          ) : (
            <>
              <Link to={`/product/${safeProduct.id}`} className="hidden md:block w-full h-full">
                <LazyImage
                  src={getImageUrl(safeProduct.images[0])}
                  alt={safeProduct.name}
                  className="w-full h-full object-cover object-center"
                />
              </Link>
              <div
                className="md:hidden w-full h-full cursor-pointer"
                onClick={() => setShowMobileActions(!showMobileActions)}
              >
                <MobileOptimizedImage
                  src={getImageUrl(safeProduct.images[0])}
                  alt={safeProduct.name}
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </>
          )}
        </div>

        {/* Out-of-stock dim overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1 rounded-full shadow">
              Out of Stock
            </span>
          </div>
        )}

        {/* Desktop hover overlay — Quick View / Compare */}
        <AnimatePresence>
          {isHovered && !isOutOfStock && (
            <motion.div
              className="hidden md:flex absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent py-3 px-3 items-end justify-center gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22 }}
            >
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs font-medium bg-white/90 hover:bg-white text-gray-900 shadow"
                onClick={() => setIsQuickViewOpen(true)}
              >
                <Eye className="w-3 h-3 mr-1" />
                Quick View
              </Button>
              {onAddToComparison && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs font-medium bg-white/90 hover:bg-white text-gray-900 shadow"
                  onClick={() => onAddToComparison(product)}
                >
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Compare
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Action Panel */}
        <AnimatePresence>
          {showMobileActions && (
            <motion.div
              className="md:hidden absolute inset-0 bg-black/30 flex items-center justify-end pr-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setShowMobileActions(false)}
            >
              <motion.div
                className="flex flex-col gap-2 p-1 rounded-xl bg-black/30 backdrop-blur-sm"
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
              >
                {[
                  {
                    icon: <Heart className={`w-5 h-5 ${inWishlist ? 'fill-red-500 text-red-500' : 'text-white'}`} />,
                    handler: handleWishlistToggle,
                    disabled: wishlistLoading,
                  },
                  {
                    icon: showSuccess
                      ? <Check className="w-5 h-5 text-green-400" />
                      : <ShoppingCart className={`w-5 h-5 text-white ${cartLoading ? 'animate-pulse' : ''}`} />,
                    handler: handleAddToCart,
                    disabled: isOutOfStock || cartLoading,
                  },
                  {
                    icon: <ShoppingBag className="w-5 h-5 text-white" />,
                    handler: (e: React.MouseEvent) => { handleBuyNow(e); setShowMobileActions(false); },
                    disabled: isOutOfStock,
                  },
                  {
                    icon: <Eye className="w-5 h-5 text-white" />,
                    handler: (_e: React.MouseEvent) => { setIsQuickViewOpen(true); setShowMobileActions(false); },
                    disabled: false,
                  },
                ].map((action, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-full hover:scale-105 transition-transform"
                    onClick={(e) => action.handler(e)}
                    disabled={action.disabled}
                  >
                    {action.icon}
                  </Button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top-left badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 pointer-events-none">
          {product.featured && (
            <Badge className="text-[10px] px-2 py-0.5 bg-primary text-primary-foreground shadow-sm">Featured</Badge>
          )}
          {discountPercentage > 0 && (
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 shadow-sm">{discountPercentage}% OFF</Badge>
          )}
          {product.isHandmade && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-800 shadow-sm">Handmade</Badge>
          )}
        </div>

        {/* Top-right: Wishlist — visible on all screens */}
        <div className="flex absolute top-2.5 right-2.5">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: isHovered ? 1 : 0.7 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow-sm hover:scale-110 transition-all duration-200 ${inWishlist ? 'text-red-500' : 'text-gray-500'}`}
              title={inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
              disabled={wishlistLoading}
              onClick={handleWishlistToggle}
            >
              <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} />
            </Button>
          </motion.div>
        </div>
      </div>

      {/* ── Product Info ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 px-3.5 pt-3 pb-3.5 space-y-2">

        {/* Artisan / location */}
        {product.artisan && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="w-3 h-3 flex-shrink-0 text-primary/60" />
            <span className="truncate">{product.artisan.name}</span>
          </div>
        )}

        {/* Product name */}
        {isMockProduct ? (
          <h3
            className="font-semibold text-foreground leading-snug line-clamp-2 text-sm cursor-pointer hover:text-primary transition-colors"
            onClick={() => handleBuyNow()}
          >
            {safeProduct.name}
          </h3>
        ) : (
          <Link to={`/product/${product.id}`}>
            <h3 className="font-semibold text-foreground leading-snug line-clamp-2 text-sm hover:text-primary transition-colors cursor-pointer">
              {safeProduct.name}
            </h3>
          </Link>
        )}

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-3 h-3 ${
                  star <= Math.round(safeProduct.rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-200 fill-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-medium text-foreground/80">{safeProduct.rating.toFixed(1)}</span>
          {product.reviewCount != null && (
            <span className="text-[11px] text-muted-foreground">({product.reviewCount})</span>
          )}
        </div>

        {/* Price row */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-base font-bold text-foreground">
            ₹{safeProduct.price.toLocaleString()}
          </span>
          {safeProduct.originalPrice && safeProduct.originalPrice > safeProduct.price && (
            <span className="text-xs text-muted-foreground line-through">
              ₹{safeProduct.originalPrice.toLocaleString()}
            </span>
          )}
          {discountPercentage > 0 && (
            <span className="text-xs font-semibold text-green-600">
              {discountPercentage}% off
            </span>
          )}
        </div>

        {/* Low stock warning */}
        {!isOutOfStock && resolvedStockCount !== null && resolvedStockCount > 0 && resolvedStockCount <= 5 && (
          <p className="text-[11px] text-destructive font-medium">
            Only {resolvedStockCount} left!
          </p>
        )}

        {/* CTA buttons — pushed to bottom */}
        <div className="flex gap-2 pt-1 mt-auto">
          {/* Add to Cart */}
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-11 sm:h-9 text-xs font-medium border-primary/40 text-primary hover:bg-primary/5 transition-all duration-200"
            disabled={isOutOfStock || cartLoading}
            onClick={handleAddToCart}
          >
            <AnimatePresence mode="wait">
              {showSuccess ? (
                <motion.span
                  key="ok"
                  className="flex items-center gap-1"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                >
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  Added
                </motion.span>
              ) : (
                <motion.span
                  key="cart"
                  className="flex items-center gap-1"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                >
                  <ShoppingCart className={`w-3.5 h-3.5 ${cartLoading ? 'animate-pulse' : ''}`} />
                  Cart
                </motion.span>
              )}
            </AnimatePresence>
          </Button>

          {/* Buy Now */}
          <Button
            size="sm"
            className="flex-1 h-11 sm:h-9 text-xs font-semibold bg-gradient-primary hover:shadow-md hover:shadow-primary/25 transition-all duration-200"
            disabled={isOutOfStock}
            onClick={handleBuyNow}
          >
            <ShoppingBag className="w-3.5 h-3.5 mr-1" />
            {isOutOfStock ? 'Sold Out' : 'Buy Now'}
          </Button>
        </div>
      </div>

      <QuickViewDialog
        product={product}
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
      />
    </motion.div>
  );};