import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, TrendingUp, ShoppingCart } from "lucide-react";

interface SalesDataPoint {
  date: string;
  sales: number;
  orders: number;
}

interface ProductAnalytics {
  _id: string;
  name: string;
  sales: number;
  revenue: number;
  quantity: number;
}

/** Renders a single sales bar, setting --bar-width via a DOM ref to avoid inline styles. */
function SalesBarItem({ pct }: { pct: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    barRef.current?.style.setProperty('--bar-width', `${pct}%`);
  }, [pct]);
  return (
    <div ref={barRef} className="h-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded bar-width-dynamic" />
  );
}

export function SellerAnalytics() {
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30days');
  const { toast } = useToast();

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const getToken = () => {
    return localStorage.getItem('admin_token') || localStorage.getItem('auth_token') || localStorage.getItem('firebase_id_token');
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const token = getToken();

      // Load sales analytics
      const salesResponse = await fetch(`/api/seller/analytics/sales?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Load product analytics
      const productsResponse = await fetch('/api/seller/analytics/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!salesResponse.ok || !productsResponse.ok) {
        throw new Error('Failed to load analytics');
      }

      const salesDataRes = await salesResponse.json();
      const productDataRes = await productsResponse.json();

      setSalesData(salesDataRes.data || []);
      setProductAnalytics(productDataRes.products || []);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const totalSales = salesData.reduce((sum, item) => sum + item.sales, 0);
  const totalOrders = salesData.reduce((sum, item) => sum + item.orders, 0);
  const totalProductSales = productAnalytics.reduce((sum, item) => sum + item.sales, 0);
  const totalProductRevenue = productAnalytics.reduce((sum, item) => sum + item.revenue, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Analytics</h2>
        <p className="text-muted-foreground">Track your sales and product performance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Sales (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalProductRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">30-day revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Units Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProductSales}</div>
            <p className="text-xs text-muted-foreground">Items sold (30d)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">30-day orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{totalOrders > 0 ? Math.round(totalProductRevenue / totalOrders) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Average per order</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Chart (Text-based) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sales Trend</CardTitle>
              <CardDescription>Daily sales over the past 30 days</CardDescription>
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="Select time period"
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {salesData.length > 0 ? (
            <div className="space-y-3">
              {salesData.slice(0, 10).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground w-24">{item.date}</span>
                  <div className="flex-1 mx-4">
                    <SalesBarItem pct={Math.max((item.sales / Math.max(...salesData.map(d => d.sales)) * 100), 5)} />
                  </div>
                  <div className="text-right w-24">
                    <p className="text-sm font-medium">₹{item.sales}</p>
                    <p className="text-xs text-muted-foreground">{item.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No sales data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Products</CardTitle>
          <CardDescription>Your best-selling products by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {productAnalytics.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Units Sold</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead className="text-right">Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productAnalytics.map((product) => {
                    const revenuePercentage = (product.revenue / totalProductRevenue * 100).toFixed(1);
                    return (
                      <TableRow key={product._id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell>₹{product.revenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{revenuePercentage}% of total</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <ShoppingCart className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No product data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
