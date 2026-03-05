import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Package, Key, Mail, Bell } from "lucide-react";

export function SellerAlerts() {
  const [activeTab, setActiveTab] = useState("stock");

  // Mock data for seller alerts
  const lowStockAlerts = [
    {
      id: 1,
      artisan: "Rajesh Kumar",
      product: "Handcrafted Wooden Bowl",
      currentStock: 3,
      threshold: 5,
      lastUpdated: "2024-01-15",
      status: "active"
    },
    {
      id: 2,
      artisan: "Priya Sharma",
      product: "Blue Pottery Vase",
      currentStock: 2,
      threshold: 5,
      lastUpdated: "2024-01-14",
      status: "active"
    },
    {
      id: 3,
      artisan: "Amit Patel",
      product: "Dhokra Elephant",
      currentStock: 0,
      threshold: 5,
      lastUpdated: "2024-01-13",
      status: "critical"
    }
  ];

  const passwordResetRequests = [
    {
      id: 1,
      artisan: "Sunita Devi",
      email: "sunita.devi@email.com",
      requestedAt: "2024-01-15 10:30",
      status: "pending",
      resetToken: "RST-2024-001"
    },
    {
      id: 2,
      artisan: "Rajesh Kumar",
      email: "rajesh.kumar@email.com",
      requestedAt: "2024-01-14 16:45",
      status: "completed",
      resetToken: "RST-2024-002"
    }
  ];

  const handleSendStockAlert = (alertId) => {
    // API call to send stock alert to artisan
    console.log(`Sending stock alert for ${alertId}`);
  };

  const handleProcessPasswordReset = (requestId) => {
    // API call to process password reset
    console.log(`Processing password reset for ${requestId}`);
  };

  const handleSendCustomAlert = (artisanId, message) => {
    // API call to send custom alert
    console.log(`Sending custom alert to artisan ${artisanId}: ${message}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-6 h-6" />
        <h2 className="text-2xl font-bold">Seller Alerts</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stock" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Low Stock Alerts
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Password Resets
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Custom Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Low Stock Alerts
              </CardTitle>
              <CardDescription>
                Monitor and alert artisans about low stock products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artisan</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockAlerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">{alert.artisan}</TableCell>
                      <TableCell>{alert.product}</TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          alert.currentStock === 0 ? 'text-red-600' :
                          alert.currentStock <= 2 ? 'text-orange-600' : 'text-yellow-600'
                        }`}>
                          {alert.currentStock}
                        </span>
                      </TableCell>
                      <TableCell>{alert.threshold}</TableCell>
                      <TableCell>
                        <Badge variant={
                          alert.status === 'critical' ? 'destructive' :
                          alert.status === 'active' ? 'default' : 'secondary'
                        }>
                          {alert.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{alert.lastUpdated}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendStockAlert(alert.id)}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Send Alert
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Password Reset Requests
              </CardTitle>
              <CardDescription>
                Manage artisan password reset requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artisan</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {passwordResetRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.artisan}</TableCell>
                      <TableCell>{request.email}</TableCell>
                      <TableCell>{request.requestedAt}</TableCell>
                      <TableCell>
                        <Badge variant={
                          request.status === 'pending' ? 'secondary' :
                          request.status === 'completed' ? 'default' : 'outline'
                        }>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleProcessPasswordReset(request.id)}
                          >
                            Process Reset
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Send Custom Alert
                </CardTitle>
                <CardDescription>
                  Send custom notifications to artisans
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="artisan-select">Select Artisan</Label>
                  <select id="artisan-select" aria-label="Select artisan" className="w-full p-2 border rounded-md">
                    <option value="">Choose an artisan...</option>
                    <option value="rajesh">Rajesh Kumar</option>
                    <option value="priya">Priya Sharma</option>
                    <option value="amit">Amit Patel</option>
                    <option value="sunita">Sunita Devi</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="alert-message">Message</Label>
                  <textarea
                    id="alert-message"
                    className="w-full p-2 border rounded-md"
                    rows={4}
                    placeholder="Enter your alert message..."
                  />
                </div>
                <div>
                  <Label htmlFor="alert-type">Alert Type</Label>
                  <select id="alert-type" aria-label="Alert type" className="w-full p-2 border rounded-md">
                    <option value="info">Information</option>
                    <option value="warning">Warning</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <Button className="w-full" onClick={() => handleSendCustomAlert("selected", "message")}>
                  <Bell className="w-4 h-4 mr-2" />
                  Send Alert
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alert Templates</CardTitle>
                <CardDescription>Common alert templates for quick sending</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <h4 className="font-medium">Payment Reminder</h4>
                    <p className="text-sm text-muted-foreground">Reminder to complete pending payments</p>
                  </div>
                  <div className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <h4 className="font-medium">Profile Update Required</h4>
                    <p className="text-sm text-muted-foreground">Request to update artisan profile information</p>
                  </div>
                  <div className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <h4 className="font-medium">New Order Received</h4>
                    <p className="text-sm text-muted-foreground">Notification about new customer orders</p>
                  </div>
                  <div className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                    <h4 className="font-medium">Quality Check Required</h4>
                    <p className="text-sm text-muted-foreground">Request for product quality verification</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}