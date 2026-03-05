import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, AlertCircle, Eye, MoreHorizontal, Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/api';

interface Artisan {
  _id: string;
  name: string;
  businessInfo?: {
    businessName: string;
    contact?: {
      email: string;
      phone: string;
      address: string;
    };
  };
  specialties?: string[];
  experience?: number;
  bio?: string;
  avatar?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalNotes?: string;
  rejectionReason?: string;
  createdAt: string;
  approvedAt?: string;
  userId?: {
    email: string;
    firebaseUID: string;
    createdAt: string;
  };
  pendingChanges?: {
    hasChanges: boolean;
    changedAt?: string;
    changedFields: string[];
    changes?: any;
  };
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function AdminArtisanApprovals() {
  const { toast } = useToast();
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  const fetchArtisans = async (status: string, page: number = 1) => {
    setIsLoading(true);
    try {
      const response = await apiRequest(
        `/api/admin-approvals/pending-artisans?status=${status}&page=${page}&limit=${pagination.limit}`,
        {
          method: 'GET',
          auth: true
        }
      ) as any;

      if (response?.success) {
        console.log('Fetched artisans:', response.artisans);
        console.log('Artisans with pending changes:', response.artisans.filter((a: any) => a.pendingChanges?.hasChanges));
        setArtisans(response.artisans || []);
        setPagination({
          page: response.page,
          limit: pagination.limit,
          total: response.total,
          pages: response.pages,
        });
      }
    } catch (error) {
      console.error('Error fetching artisans:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch artisans',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArtisans(activeTab, pagination.page);
  }, [activeTab]);

  const handleApprove = async () => {
    if (!selectedArtisan) return;

    setIsProcessing(true);
    try {
      const response = await apiRequest(
        `/api/admin-approvals/approve-artisan/${selectedArtisan._id}`,
        {
          method: 'PATCH',
          body: {
            approvalNotes: actionReason,
          },
          auth: true
        }
      ) as { success: boolean; message: string };

      if (response?.success) {
        toast({
          title: 'Success',
          description: `${selectedArtisan.name} has been approved`,
        });
        setShowActionDialog(false);
        setActionReason('');
        fetchArtisans(activeTab, pagination.page);
      }
    } catch (error) {
      console.error('Error approving artisan:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve artisan',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedArtisan || !actionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a rejection reason',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiRequest(
        `/api/admin-approvals/reject-artisan/${selectedArtisan._id}`,
        {
          method: 'PATCH',
          body: {
            rejectionReason: actionReason,
          },
          auth: true
        }
      ) as { success: boolean; message: string };

      if (response?.success) {
        toast({
          title: 'Success',
          description: `${selectedArtisan.name} has been rejected`,
        });
        setShowActionDialog(false);
        setActionReason('');
        fetchArtisans(activeTab, pagination.page);
      }
    } catch (error) {
      console.error('Error rejecting artisan:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject artisan',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Artisan Applications</h2>
        <p className="text-muted-foreground mt-2">Review and manage artisan onboarding applications</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            Pending
            {pagination.total > 0 && activeTab === 'pending' && (
              <Badge variant="secondary" className="ml-2">
                {pagination.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Artisan Applications</CardTitle>
              <CardDescription>
                {pagination.total} artisans awaiting approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : artisans.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending applications</p>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artisan Name</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {artisans.map((artisan) => (
                        <TableRow key={artisan._id}>
                          <TableCell className="font-medium">{artisan.name}</TableCell>
                          <TableCell>{artisan.businessInfo?.businessName || 'N/A'}</TableCell>
                          <TableCell>{artisan.userId?.email || 'N/A'}</TableCell>
                          <TableCell className="text-sm">
                            {new Date(artisan.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedArtisan(artisan);
                                    setShowDetailDialog(true);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedArtisan(artisan);
                                    setActionType('approve');
                                    setActionReason('');
                                    setShowActionDialog(true);
                                  }}
                                  className="text-green-600"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedArtisan(artisan);
                                    setActionType('reject');
                                    setActionReason('');
                                    setShowActionDialog(true);
                                  }}
                                  className="text-red-600"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Approved Artisans</CardTitle>
              <CardDescription>Successfully onboarded artisans</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : artisans.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No approved artisans</p>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artisan Name</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Approved Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {artisans.map((artisan) => (
                        <TableRow 
                          key={artisan._id}
                          className={artisan.pendingChanges?.hasChanges ? 'bg-orange-50 dark:bg-orange-950/20 border-l-4 border-l-orange-500' : ''}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {artisan.name}
                              {artisan.pendingChanges?.hasChanges && (
                                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                                  <Bell className="w-3 h-3 mr-1" />
                                  Changed
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {artisan.businessInfo?.businessName || 'N/A'}
                              {artisan.pendingChanges?.hasChanges && (
                                <p className="text-xs text-orange-600 mt-1">
                                  Modified: {artisan.pendingChanges.changedFields.join(', ')}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {artisan.approvedAt
                              ? new Date(artisan.approvedAt).toLocaleDateString()
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedArtisan(artisan);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rejected Artisans</CardTitle>
              <CardDescription>Applications that were rejected</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : artisans.length === 0 ? (
                <div className="text-center py-8">
                  <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No rejected artisans</p>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Artisan Name</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Rejection Reason</TableHead>
                        <TableHead>Rejected Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {artisans.map((artisan) => (
                        <TableRow key={artisan._id}>
                          <TableCell className="font-medium">{artisan.name}</TableCell>
                          <TableCell>{artisan.businessInfo?.businessName || 'N/A'}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">
                            {artisan.rejectionReason || 'No reason provided'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {artisan.approvedAt
                              ? new Date(artisan.approvedAt).toLocaleDateString()
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedArtisan(artisan);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedArtisan?.name}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                {getStatusIcon(selectedArtisan?.approvalStatus || '')}
                <Badge className={getStatusColor(selectedArtisan?.approvalStatus || '')}>
                  {selectedArtisan?.approvalStatus?.toUpperCase()}
                </Badge>
              </div>
            </DialogDescription>
          </DialogHeader>

          {selectedArtisan && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {/* Pending Changes Alert */}
                {selectedArtisan.pendingChanges?.hasChanges && (
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Bell className="w-5 h-5 text-orange-600 dark:text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-1">
                          Artisan Changed Details After Approval
                        </h3>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {selectedArtisan.pendingChanges.changedFields.map((field) => (
                            <span
                              key={field}
                              className="inline-block bg-orange-100 text-orange-700 border border-orange-300 rounded px-2 py-0.5 text-xs font-medium"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                        {selectedArtisan.pendingChanges.changes &&
                          Object.keys(selectedArtisan.pendingChanges.changes).length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-semibold text-orange-800 dark:text-orange-200">New values:</p>
                            {Object.entries(selectedArtisan.pendingChanges.changes).map(([key, value]) => (
                              <p key={key} className="text-xs text-orange-700 dark:text-orange-300">
                                <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}: </span>
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </p>
                            ))}
                          </div>
                        )}
                        {selectedArtisan.pendingChanges.changedAt && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                            Changed on: {new Date(selectedArtisan.pendingChanges.changedAt).toLocaleString()}
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 border-orange-400 text-orange-700 hover:bg-orange-100"
                          onClick={async () => {
                            try {
                              await apiRequest(
                                `/api/admin/artisans/${selectedArtisan._id}/acknowledge-changes`,
                                { method: 'PATCH', auth: true }
                              );
                              toast({ title: 'Changes marked as reviewed' });
                              setShowDetailDialog(false);
                              fetchArtisans(activeTab, pagination.page);
                            } catch {
                              toast({ title: 'Error', description: 'Could not mark changes as reviewed', variant: 'destructive' });
                            }
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark as Reviewed
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Basic Information */}
                <div>
                  <h3 className="font-semibold mb-3">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{selectedArtisan.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedArtisan.userId?.email || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Business Information */}
                {selectedArtisan.businessInfo && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-3">Business Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Business Name</p>
                          <p className="font-medium">
                            {selectedArtisan.businessInfo.businessName || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="font-medium">
                            {selectedArtisan.businessInfo.contact?.phone || 'N/A'}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Address</p>
                          <p className="font-medium">
                            {selectedArtisan.businessInfo.contact?.address || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />
                  </>
                )}

                {/* Experience & Specialties */}
                <div>
                  <h3 className="font-semibold mb-3">Experience & Specialties</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Years of Experience</p>
                      <p className="font-medium">{selectedArtisan.experience || 'N/A'} years</p>
                    </div>
                    {selectedArtisan.specialties && selectedArtisan.specialties.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Specialties</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedArtisan.specialties.map((specialty, idx) => (
                            <Badge key={idx} variant="secondary">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Bio */}
                {selectedArtisan.bio && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-3">Bio</h3>
                      <p className="text-sm">{selectedArtisan.bio}</p>
                    </div>

                    <Separator />
                  </>
                )}

                {/* Approval Notes */}
                {selectedArtisan.approvalNotes && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-3 text-green-600">Approval Notes</h3>
                      <p className="text-sm">{selectedArtisan.approvalNotes}</p>
                    </div>

                    <Separator />
                  </>
                )}

                {/* Rejection Reason */}
                {selectedArtisan.rejectionReason && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-3 text-red-600">Rejection Reason</h3>
                      <p className="text-sm">{selectedArtisan.rejectionReason}</p>
                    </div>

                    <Separator />
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Artisan' : 'Reject Artisan'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? `Are you sure you want to approve ${selectedArtisan?.name}?`
                : `Are you sure you want to reject ${selectedArtisan?.name}?`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">
                {actionType === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason (Required)'}
              </Label>
              <Textarea
                id="reason"
                placeholder={
                  actionType === 'approve'
                    ? 'Add any approval notes...'
                    : 'Please provide a reason for rejection...'
                }
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowActionDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={actionType === 'approve' ? handleApprove : handleReject}
              disabled={isProcessing || (actionType === 'reject' && !actionReason.trim())}
              variant={actionType === 'approve' ? 'default' : 'destructive'}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : actionType === 'approve' ? (
                'Approve'
              ) : (
                'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
