import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductManagement } from "@/components/dashboard/ProductManagement";
import { ArtisanManagement } from "@/components/dashboard/ArtisanManagement";
import { OrderManagement } from "@/components/admin/OrderManagement";
import { UserManagement } from "@/components/admin/UserManagement";
import { BlogManagement } from "@/components/admin/BlogManagement";
import { AnalyticsOverview } from "@/components/admin/AnalyticsOverview";
import { ApprovalManagement } from "@/components/admin/ApprovalManagement";
import { ReportsAndInvoices } from "@/components/admin/ReportsAndInvoices";
import { PaymentsManagement } from "@/components/admin/PaymentsManagement";
import { AuthManagement } from "@/components/admin/AuthManagement";
import { AlertsAndAnnouncements } from "@/components/admin/AlertsAndAnnouncements";
import { CustomerSupport } from "@/components/admin/CustomerSupport";
import { SellerAlerts } from "@/components/admin/SellerAlerts";
import { ActivitiesAndNotifications } from "@/components/admin/ActivitiesAndNotifications";
import AdminUpiVerification from "@/components/admin/AdminUpiVerification";
import { AdminSettlementManagement } from "@/components/admin/AdminSettlementManagement";
import { AdminInvoiceView } from "@/components/admin/AdminInvoiceView";
import { AdminLogin } from "@/components/AdminLogin";
import { PageContentManagement } from "@/components/admin/PageContentManagement";
import { CategoriesManagement } from "@/components/admin/CategoriesManagement";
import { AuditLogManagement } from "@/components/admin/AuditLogManagement";
import { EmailTemplateManagement } from "@/components/admin/EmailTemplateManagement";
import { adminService } from "@/services/adminService";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Package,
  ShoppingCart,
  UserCheck,
  FileText,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  XCircle,
  FileBarChart,
  CreditCard,
  Shield,
  Bell,
  HeadphonesIcon,
  AlertCircle,
  Activity,
  Settings,
  Wallet,
  Receipt,
  Mail
} from "lucide-react";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeArtisans: 0,
    todayOrders: 0,
    totalUsers: 150,
    totalRevenue: 245000,
    averageOrderValue: 2800,
    pendingApprovals: { products: 0, artisans: 0 }
  });
  const [loading, setLoading] = useState(false); // Don't show loading initially
  const { toast } = useToast();

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // Only load stats when authenticated
      loadStats();
      // Set up real-time polling every 30 seconds
      const interval = setInterval(() => {
        loadStats();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const checkAuthentication = () => {
    setCheckingAuth(true);
    const authenticated = adminService.isAuthenticated();
    setIsAuthenticated(authenticated);
    setCheckingAuth(false);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    adminService.logout();
    setIsAuthenticated(false);
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  const loadStats = async () => {
    // Don't set loading to true to avoid blocking the UI
    try {
      const response = await adminService.getStats();
      setStats(response.stats);
    } catch (error) {
      console.warn('Failed to load admin statistics:', error);
      // Keep default stats on error
    } finally {
      // Don't set loading to false since we don't show loading initially
    }
  };

  const statsCards = [
    {
      label: "Total Products",
      value: stats.totalProducts.toLocaleString(),
      icon: Package,
      trend: "+12%",
      color: "text-blue-600"
    },
    {
      label: "Active Artisans",
      value: stats.activeArtisans.toString(),
      icon: Users,
      trend: "+8%",
      color: "text-green-600"
    },
    {
      label: "Orders Today",
      value: stats.todayOrders.toString(),
      icon: ShoppingCart,
      trend: "+15%",
      color: "text-purple-600"
    },
    {
      label: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      icon: UserCheck,
      trend: "+5%",
      color: "text-orange-600"
    },
  ];

  const alerts = [
    {
      type: "warning",
      message: `${stats.pendingApprovals.products} products pending approval`,
      severity: "medium"
    },
    {
      type: "info",
      message: `${stats.pendingApprovals.artisans} artisan applications pending`,
      severity: "low"
    },
    {
      type: "error",
      message: "Payment gateway maintenance scheduled",
      severity: "high"
    },
  ];

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "approvals", label: "Approvals", icon: CheckCircle },
    { id: "products", label: "Products", icon: Package },
    { id: "artisans", label: "Artisans", icon: Users },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "users", label: "Users", icon: UserCheck },
    { id: "blog", label: "Blog", icon: FileText },
    { id: "page-content", label: "Page Content", icon: FileText },
    { id: "categories", label: "Categories", icon: Package },
    { id: "audit-logs", label: "Audit Logs", icon: Activity },
    { id: "email-templates", label: "Email Templates", icon: Mail },
    { id: "reports", label: "Reports", icon: FileBarChart },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "upi-verification", label: "UPI Verification", icon: CheckCircle },
    { id: "settlements", label: "Settlements", icon: Wallet },
    { id: "invoices", label: "Invoices", icon: Receipt },
    { id: "auth", label: "Auth Management", icon: Shield },
    { id: "alerts", label: "Alerts & Announcements", icon: Bell },
    { id: "support", label: "Customer Support", icon: HeadphonesIcon },
    { id: "seller-alerts", label: "Seller Alerts", icon: AlertCircle },
    { id: "activities", label: "Activities", icon: Activity },
  ];

  // Temporarily remove loading check for immediate access
  // if (loading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center">
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
  //         <p>Loading admin panel...</p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border min-h-screen">
          <div className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-6">Admin Panel</h2>
            <nav className="space-y-2">
              {sidebarItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab(item.id)}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage your marketplace data and operations</p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Logout
            </Button>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsCards.map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{stat.label}</p>
                          <p className="text-2xl font-bold text-foreground">
                            {loading ? "..." : stat.value}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <TrendingUp className="w-3 h-3 text-green-500" />
                            <span className="text-xs text-green-500">{stat.trend}</span>
                          </div>
                        </div>
                        <stat.icon className={`w-8 h-8 ${stat.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <AnalyticsOverview />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Alerts & Notifications
                    </CardTitle>
                    <CardDescription>Items requiring your attention</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {alerts.map((alert, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <div className={`w-2 h-2 rounded-full mt-2 ${alert.severity === 'high' ? 'bg-red-500' :
                            alert.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`} />
                        <div className="flex-1">
                          <p className="text-sm text-foreground">{alert.message}</p>
                          <Badge variant={
                            alert.severity === 'high' ? 'destructive' :
                              alert.severity === 'medium' ? 'secondary' : 'outline'
                          } className="mt-1">
                            {alert.severity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "approvals" && <ApprovalManagement />}
          {activeTab === "products" && <ProductManagement />}
          {activeTab === "artisans" && <ArtisanManagement />}
          {activeTab === "orders" && <OrderManagement />}
          {activeTab === "users" && <UserManagement />}
          {activeTab === "blog" && <BlogManagement />}
          {activeTab === "page-content" && <PageContentManagement />}
          {activeTab === "categories" && <CategoriesManagement />}
          {activeTab === "audit-logs" && <AuditLogManagement />}
          {activeTab === "email-templates" && <EmailTemplateManagement />}
          {activeTab === "reports" && <ReportsAndInvoices />}
          {activeTab === "payments" && <PaymentsManagement />}
          {activeTab === "upi-verification" && <AdminUpiVerification />}
          {activeTab === "settlements" && <AdminSettlementManagement />}
          {activeTab === "invoices" && <AdminInvoiceView />}
          {activeTab === "auth" && <AuthManagement />}
          {activeTab === "alerts" && <AlertsAndAnnouncements />}
          {activeTab === "support" && <CustomerSupport />}
          {activeTab === "seller-alerts" && <SellerAlerts />}
          {activeTab === "activities" && <ActivitiesAndNotifications />}
        </div>
      </div>
    </div>
  );
}