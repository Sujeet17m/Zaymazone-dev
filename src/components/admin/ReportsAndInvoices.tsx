import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileBarChart, Download, Calendar, TrendingUp, DollarSign, FileText, Receipt } from "lucide-react";
import { adminService } from "@/services/adminService";
import { useToast } from "@/hooks/use-toast";

export function ReportsAndInvoices() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("reports");
  const [dateRange, setDateRange] = useState("30days");
  const [reportType, setReportType] = useState("sales");
  const [loading, setLoading] = useState(true);
  const [salesReport, setSalesReport] = useState(null);
  const [artisanReport, setArtisanReport] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async () => {
    setLoading(true);
    try {
      const [salesData, artisanData, invoicesData] = await Promise.all([
        adminService.getSalesReport(dateRange),
        adminService.getArtisanReport(),
        adminService.getInvoices()
      ]);

      setSalesReport(salesData);
      setArtisanReport(artisanData);
      setInvoices(invoicesData.invoices || []);
    } catch (error) {
      console.error('Error loading reports data:', error);
      toast({
        title: "Error",
        description: "Failed to load reports data",
        variant: "destructive"
      });
      
      // Set fallback data
      setSalesReport({
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        topProducts: [],
        monthlyData: []
      });
      setArtisanReport({
        totalArtisans: 0,
        activeArtisans: 0,
        newArtisans: 0,
        topArtisans: []
      });
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = () => {
    toast({
      title: "Generating report…",
      description: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report for ${dateRange} is being prepared.`,
    });
  };

  const handleViewInvoice = (orderId: string) => {
    if (!orderId) return;
    navigate(`/order/${orderId}/invoice?admin=true`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <FileBarChart className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Reports & Invoices</h2>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileBarChart className="w-6 h-6" />
        <h2 className="text-2xl font-bold">Reports & Invoices</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileBarChart className="w-4 h-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Invoices ({invoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">₹{salesReport?.totalRevenue?.toLocaleString() || 0}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Orders</p>
                    <p className="text-2xl font-bold">{salesReport?.totalOrders || 0}</p>
                  </div>
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Order Value</p>
                    <p className="text-2xl font-bold">₹{salesReport?.averageOrderValue || 0}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Artisans</p>
                    <p className="text-2xl font-bold">{artisanReport?.activeArtisans || 0}</p>
                  </div>
                  <FileBarChart className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Report Generator</CardTitle>
                <CardDescription>Generate custom reports for your marketplace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Report Type</label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sales">Sales Report</SelectItem>
                        <SelectItem value="artisans">Artisan Report</SelectItem>
                        <SelectItem value="products">Product Report</SelectItem>
                        <SelectItem value="customers">Customer Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date Range</label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7days">Last 7 days</SelectItem>
                        <SelectItem value="30days">Last 30 days</SelectItem>
                        <SelectItem value="90days">Last 90 days</SelectItem>
                        <SelectItem value="1year">Last year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleGenerateReport} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
                <CardDescription>Best performing products this month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {salesReport?.topProducts?.length > 0 ? (
                    salesReport.topProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.sales} sales</p>
                        </div>
                        <p className="font-semibold">₹{product.revenue?.toLocaleString() || 0}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      No top products data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Monthly Performance</CardTitle>
              <CardDescription>Revenue and order trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Avg Order Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesReport?.monthlyData?.length > 0 ? (
                    salesReport.monthlyData.map((data, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{data.month}</TableCell>
                        <TableCell>₹{data.revenue?.toLocaleString() || 0}</TableCell>
                        <TableCell>{data.orders || 0}</TableCell>
                        <TableCell>₹{data.orders > 0 ? Math.round(data.revenue / data.orders) : 0}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        No monthly data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Invoice Management
              </CardTitle>
              <CardDescription>
                View and manage customer invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                        No invoices found
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.id}</TableCell>
                        <TableCell>{invoice.orderId}</TableCell>
                        <TableCell>{invoice.customer}</TableCell>
                        <TableCell>₹{invoice.amount}</TableCell>
                        <TableCell>
                          <Badge variant={
                            invoice.status === 'paid' ? 'default' :
                            invoice.status === 'pending' ? 'secondary' : 'destructive'
                          }>
                            {invoice.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewInvoice(invoice.orderId)}
                            title="View Invoice"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
