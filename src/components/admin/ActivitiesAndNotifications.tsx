import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Bell, User, Package, CreditCard, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { adminService } from "@/services/adminService";
import { useToast } from "@/hooks/use-toast";

interface Activity {
  id: number;
  type: string;
  action: string;
  details: string;
  timestamp: string;
  user: string;
  icon: string;
  color: string;
}

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export function ActivitiesAndNotifications() {
  const [activeTab, setActiveTab] = useState("activities");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [activitiesResponse, notificationsResponse] = await Promise.all([
        adminService.getActivities(),
        adminService.getNotifications()
      ]);
      
      setActivities(activitiesResponse.activities || []);
      setNotifications(notificationsResponse.notifications || []);
    } catch (error) {
      console.error('Error loading activities and notifications:', error);
      toast({
        title: "Error",
        description: "Failed to load activities and notifications",
        variant: "destructive"
      });
      
      // Set fallback data
      setActivities([
        {
          id: 1,
          type: "system",
          action: "System initialized",
          details: "Admin panel activities loaded",
          timestamp: new Date().toISOString(),
          user: "System",
          icon: "Activity",
          color: "text-gray-600"
        }
      ]);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
    
    // Set up real-time polling every 45 seconds for activities
    const interval = setInterval(() => {
      loadData();
    }, 45000);
    
    return () => clearInterval(interval);
  }, [loadData]);

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'User': return User;
      case 'Package': return Package;
      case 'CreditCard': return CreditCard;
      case 'CheckCircle': return CheckCircle;
      case 'XCircle': return XCircle;
      case 'AlertTriangle': return AlertTriangle;
      default: return Activity;
    }
  };

  const getActivityIcon = (activity) => {
    const IconComponent = getIcon(activity.icon);
    return <IconComponent className={`w-5 h-5 ${activity.color}`} />;
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'system':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'approval':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'payment':
        return <CreditCard className="w-5 h-5 text-purple-600" />;
      case 'inventory':
        return <Package className="w-5 h-5 text-orange-600" />;
      default:
        return <Bell className="w-5 h-5 text-blue-600" />;
    }
  };

  const handleMarkAsRead = (_notificationId: number) => {
    // API call to mark notification as read would go here
  };

  const handleClearAll = () => {
    // API call to clear all notifications would go here
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6" />
          <h2 className="text-2xl font-bold">Activities & Notifications</h2>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="w-6 h-6" />
        <h2 className="text-2xl font-bold">Activities & Notifications</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity Log ({activities.length})
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications ({notifications.filter(n => !n.read).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                System Activity Log
              </CardTitle>
              <CardDescription>
                Track all system activities and administrative actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {activities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No activities found
                    </div>
                  ) : (
                    activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          {getActivityIcon(activity)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{activity.action}</h4>
                            <span className="text-sm text-muted-foreground">
                              {new Date(activity.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{activity.details}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{activity.type}</Badge>
                            <span className="text-xs text-muted-foreground">by {activity.user}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Notifications</h3>
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              Clear All
            </Button>
          </div>

          <div className="space-y-4">
            {notifications.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  No notifications
                </CardContent>
              </Card>
            ) : (
              notifications.map((notification) => (
                <Card key={notification.id} className={notification.read ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{notification.title}</h4>
                          {!notification.read && (
                            <Badge variant="destructive" className="text-xs">New</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(notification.timestamp).toLocaleString()}
                          </span>
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                            >
                              Mark as Read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
