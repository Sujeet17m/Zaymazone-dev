import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import MobileBottomNav from "@/components/MobileBottomNav";
import ScrollRestoration from "@/components/ScrollRestoration";
import RouteProgressBar from "@/components/RouteProgressBar";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { Suspense, lazy } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { attachGlobalHandlers } from "@/lib/monitoring";

// Module 15: register global unhandled-error and unhandledrejection monitors once
attachGlobalHandlers();

// Lazy load all page components for code splitting
const Index = lazy(() => import("./pages/Index"));
const Shop = lazy(() => import("./pages/Shop"));
const ShopWithBackend = lazy(() => import("./pages/ShopWithBackend"));
const Artisans = lazy(() => import("./pages/Artisans"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Categories = lazy(() => import("./pages/Categories"));
const Profile = lazy(() => import("./pages/Profile"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Help = lazy(() => import("./pages/Help"));
const Sustainability = lazy(() => import("./pages/Sustainability"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const StartSelling = lazy(() => import("./pages/StartSelling"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const SellerSuccess = lazy(() => import("./pages/SellerSuccess"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const Checkout = lazy(() => import("./pages/Checkout"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const SellerOnboarding = lazy(() => import("./pages/SellerOnboarding"));
const ArtisanDetail = lazy(() => import("./pages/ArtisanDetail"));
const ArtisanDetailWithBackend = lazy(() => import("./pages/ArtisanDetailWithBackend"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const APITestPage = lazy(() => import("./pages/APITestPage"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const SignInArtisan = lazy(() => import("./pages/SignInArtisan"));
const SignUpArtisan = lazy(() => import("./pages/SignUpArtisan"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ArtisanDashboard = lazy(() => import("./pages/ArtisanDashboard"));
const ArtisanProducts = lazy(() => import("./pages/ArtisanProducts"));
const ArtisanOrders = lazy(() => import("./pages/ArtisanOrders"));
const ArtisanProfile = lazy(() => import("./pages/ArtisanProfile"));
const MockPayment = lazy(() => import("./pages/MockPayment"));
const MockPaytmPayment = lazy(() => import("./pages/MockPaytmPayment"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Addresses = lazy(() => import("./pages/Addresses"));
const ArtisanAnalytics = lazy(() => import("./pages/ArtisanAnalytics"));
const ArtisanCustomers = lazy(() => import("./pages/ArtisanCustomers"));
const ArtisanReviews = lazy(() => import("./pages/ArtisanReviews"));
const ArtisanMessages = lazy(() => import("./pages/ArtisanMessages"));
const AwaitingPayment = lazy(() => import("./pages/AwaitingPayment"));
const PaymentVerified = lazy(() => import("./pages/PaymentVerified"));
const UpiPayment = lazy(() => import("./pages/UpiPayment"));
const SellerSettlement = lazy(() => import("./pages/SellerSettlement"));
const OrderInvoice = lazy(() => import("./pages/OrderInvoice"));
const InvoiceViewer = lazy(() => import("./pages/InvoiceViewer"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const AdminRoute = lazy(() => import("./components/AdminRoute").then(module => ({ default: module.AdminRoute })));
const RoleGuard = lazy(() => import("./components/RoleGuard").then(module => ({ default: module.RoleGuard })));



const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <GoogleAnalytics />
              <BrowserRouter>
                {/* Module 14: Global keyboard skip-navigation link */}
                <a href="#main-content" className="skip-link">Skip to main content</a>
                <RouteProgressBar />
                <ScrollRestoration />
                <MobileBottomNav />
                {/* Module 14: Main content landmark target for skip link */}
                <div id="main-content">
                <Suspense fallback={
                  <div className="min-h-screen flex flex-col">
                    <div className="h-16 border-b bg-background" />
                    <div className="flex-1 flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full animate-pulse">
                      <div className="h-8 bg-muted rounded-lg w-1/3" />
                      <div className="h-64 bg-muted rounded-xl" />
                      <div className="grid grid-cols-3 gap-4">
                        <div className="h-32 bg-muted rounded-lg" />
                        <div className="h-32 bg-muted rounded-lg" />
                        <div className="h-32 bg-muted rounded-lg" />
                      </div>
                    </div>
                  </div>
                }>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/shop" element={<ShopWithBackend />} />
                    <Route path="/shop-mock" element={<Shop />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/artisans" element={<Artisans />} />
                    <Route path="/artisan/:id" element={<ArtisanDetailWithBackend />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/:id" element={<BlogPost />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/sustainability" element={<Sustainability />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/start-selling" element={<StartSelling />} />
                    <Route path="/seller-success" element={<SellerSuccess />} />
                    <Route path="/seller-onboarding" element={<SellerOnboarding />} />
                    {/* Protected seller dashboard — artisan role required */}
                    <Route path="/seller-dashboard" element={<RoleGuard allow={['artisan']}><SellerDashboard /></RoleGuard>} />
                    <Route path="/account" element={<RoleGuard allow={['user', 'artisan']}><UserDashboard /></RoleGuard>} />
                    <Route path="/account/orders" element={<RoleGuard allow={['user', 'artisan']}><UserDashboard /></RoleGuard>} />
                    <Route path="/orders" element={<RoleGuard allow={['user', 'artisan']}><Orders /></RoleGuard>} />
                    <Route path="/checkout" element={<RoleGuard allow={['user', 'artisan']}><Checkout /></RoleGuard>} />
                    <Route path="/payment-success" element={<PaymentSuccess />} />
                    <Route path="/awaiting-payment" element={<AwaitingPayment />} />
                    <Route path="/payment-verified" element={<PaymentVerified />} />
                    <Route path="/upi-payment/:orderId" element={<UpiPayment />} />
                    <Route path="/order/:orderId/invoice" element={<OrderInvoice />} />
                    <Route path="/invoice/:invoiceId" element={<InvoiceViewer />} />
                    <Route path="/order-success" element={<OrderSuccess />} />

                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/admin" element={
                      <AdminRoute>
                        <Admin />
                      </AdminRoute>
                    } />
                    <Route path="/api-test" element={<APITestPage />} />
                    <Route path="/mock-payment" element={<MockPayment />} />
                    <Route path="/mock-payment/paytm" element={<MockPaytmPayment />} />

                    {/* Authentication Routes */}
                    <Route path="/sign-in" element={<SignIn />} />
                    <Route path="/sign-up" element={<SignUp />} />
                    <Route path="/sign-in-artisan" element={<SignInArtisan />} />
                    <Route path="/sign-up-artisan" element={<SellerOnboarding />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    {/* Dashboard Routes — role-gated */}
                    <Route path="/dashboard" element={<RoleGuard allow={['user', 'artisan']}><Dashboard /></RoleGuard>} />
                    <Route path="/artisan-dashboard" element={<RoleGuard allow={['artisan']}><ArtisanDashboard /></RoleGuard>} />
                    <Route path="/artisan/products" element={<RoleGuard allow={['artisan']}><ArtisanProducts /></RoleGuard>} />
                    <Route path="/artisan/orders" element={<RoleGuard allow={['artisan']}><ArtisanOrders /></RoleGuard>} />
                    <Route path="/artisan/profile" element={<RoleGuard allow={['artisan']}><ArtisanProfile /></RoleGuard>} />
                    <Route path="/artisan/analytics" element={<RoleGuard allow={['artisan']}><ArtisanAnalytics /></RoleGuard>} />
                    <Route path="/artisan/customers" element={<RoleGuard allow={['artisan']}><ArtisanCustomers /></RoleGuard>} />
                    <Route path="/artisan/reviews" element={<RoleGuard allow={['artisan']}><ArtisanReviews /></RoleGuard>} />
                    <Route path="/artisan/messages" element={<RoleGuard allow={['artisan']}><ArtisanMessages /></RoleGuard>} />
                    <Route path="/artisan/settlements" element={<RoleGuard allow={['artisan']}><SellerSettlement /></RoleGuard>} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/addresses" element={<Addresses />} />

                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    {/* ── Redirects for moved/legacy routes ───────────────── */}
                    <Route path="/artisan/products/new" element={<Navigate to="/artisan/products" replace />} />
                    <Route path="/artisan-detail/:id" element={<Navigate to="/artisan/:id" replace />} />
                    <Route path="/artisan-terms" element={<Navigate to="/terms" replace />} />
                    <Route path="/success-stories" element={<Navigate to="/artisans" replace />} />
                    <Route path="/cookies" element={<Navigate to="/privacy" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                </div>
              </BrowserRouter>
            </TooltipProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
