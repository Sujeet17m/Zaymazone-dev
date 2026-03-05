import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useToast } from '@/hooks/use-toast';
import { settlementApi, type Settlement, type LedgerEntry, type Pagination } from '@/lib/api';
import {
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  DollarSign,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_COLORS: Record<Settlement['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-200 text-gray-500',
};

function StatusBadge({ status }: { status: Settlement['status'] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}

const LEDGER_ICONS: Record<string, React.ReactNode> = {
  SALE: <ArrowUpRight className="h-4 w-4 text-green-600" />,
  COMMISSION: <ArrowDownLeft className="h-4 w-4 text-red-500" />,
  LOGISTICS: <ArrowDownLeft className="h-4 w-4 text-orange-500" />,
  COD_FEE: <ArrowDownLeft className="h-4 w-4 text-orange-500" />,
  COD_RETURN: <ArrowDownLeft className="h-4 w-4 text-red-500" />,
  UPI_REFUND: <ArrowDownLeft className="h-4 w-4 text-red-500" />,
  SETTLEMENT: <DollarSign className="h-4 w-4 text-blue-600" />,
  ADJUSTMENT: <ArrowUpRight className="h-4 w-4 text-purple-600" />,
};

// ── DisputeModal ─────────────────────────────────────────────────────────────

function DisputeModal({
  settlementId,
  open,
  onClose,
  onSuccess,
}: {
  settlementId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!note.trim()) return;
    setLoading(true);
    try {
      await settlementApi.dispute(settlementId, note.trim());
      toast({ title: 'Dispute raised', description: 'Our team will review your dispute.' });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to raise dispute', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise a Dispute</DialogTitle>
          <DialogDescription>Describe the issue with this settlement. Our support team will review it within 2 business days.</DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Explain the discrepancy (e.g. wrong commission rate, missing order...)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !note.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Dispute
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── SettlementDetailRow ───────────────────────────────────────────────────────

function SettlementDetailRow({
  settlement,
  onDisputeSuccess,
}: {
  settlement: Settlement;
  onDisputeSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const { toast } = useToast();

  const loadDetail = useCallback(async () => {
    if (detail) { setOpen(true); return; }
    setLoading(true);
    try {
      const data = await settlementApi.myDetail(settlement.settlementId);
      setDetail(data);
      setOpen(true);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to load settlement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [detail, settlement.settlementId, toast]);

  const canDispute = ['approved', 'pending'].includes(settlement.status);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={loadDetail}>
        <TableCell>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-mono text-xs">{settlement.settlementId}</TableCell>
        <TableCell>{settlement.weekLabel}</TableCell>
        <TableCell>{formatDate(settlement.periodStart)} – {formatDate(settlement.periodEnd)}</TableCell>
        <TableCell className="text-right">{formatCurrency(settlement.grossRevenue)}</TableCell>
        <TableCell className="text-right text-red-600">−{formatCurrency(settlement.platformCommission)}</TableCell>
        <TableCell className="text-right font-semibold text-green-700">{formatCurrency(settlement.netPayable)}</TableCell>
        <TableCell><StatusBadge status={settlement.status} /></TableCell>
        <TableCell>
          {settlement.status === 'paid' ? (
            <span className="text-xs text-muted-foreground">{settlement.payoutReference ?? '—'}</span>
          ) : canDispute ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 text-xs"
              onClick={(e) => { e.stopPropagation(); setDisputeOpen(true); }}
            >
              <AlertCircle className="mr-1 h-3 w-3" /> Dispute
            </Button>
          ) : null}
        </TableCell>
      </TableRow>

      {/* Inline detail panel */}
      {open && detail && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/30 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <p className="text-muted-foreground text-xs">Gross Revenue</p>
                <p className="font-medium">{formatCurrency(detail.grossRevenue)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Commission ({Math.round(detail.commissionRate * 100)}%)</p>
                <p className="font-medium text-red-600">−{formatCurrency(detail.platformCommission)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Logistics Cost</p>
                <p className="font-medium text-red-600">−{formatCurrency(detail.logisticsCost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">COD Returns Deducted</p>
                <p className="font-medium text-red-600">−{formatCurrency(detail.codReturnsDeducted)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">UPI Refunds Deducted</p>
                <p className="font-medium text-red-600">−{formatCurrency(detail.upiRefundsDeducted)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Adjustments</p>
                <p className="font-medium text-purple-700">{formatCurrency(detail.totalAdjustments)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Orders</p>
                <p className="font-medium">{detail.orderCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-semibold">Net Payable</p>
                <p className="font-bold text-green-700 text-base">{formatCurrency(detail.netPayable)}</p>
              </div>
            </div>

            {detail.adjustments.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium mb-1 text-muted-foreground">Manual Adjustments</p>
                <ul className="space-y-1">
                  {detail.adjustments.map((adj, i) => (
                    <li key={i} className="text-xs flex justify-between">
                      <span>{adj.label}{adj.note ? <span className="text-muted-foreground ml-1">({adj.note})</span> : null}</span>
                      <span className={adj.amount >= 0 ? 'text-green-700' : 'text-red-600'}>{formatCurrency(adj.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detail.disputeNote && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription><span className="font-medium">Dispute:</span> {detail.disputeNote}</AlertDescription>
              </Alert>
            )}
          </TableCell>
        </TableRow>
      )}

      <DisputeModal
        settlementId={settlement.settlementId}
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        onSuccess={onDisputeSuccess}
      />
    </>
  );
}

// ── LedgerTab ────────────────────────────────────────────────────────────────

function LedgerTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryType, setEntryType] = useState<LedgerEntry['entryType'] | 'ALL'>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settlementApi.myLedger({
        page,
        limit: 20,
        entryType: entryType === 'ALL' ? undefined : entryType,
        from: from || undefined,
        to: to || undefined,
      });
      setEntries(res.entries);
      setPagination(res.pagination);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to load ledger', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, entryType, from, to, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-44">
          <Select value={entryType} onValueChange={(v) => { setEntryType(v as typeof entryType); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Entry type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {(['SALE','COMMISSION','LOGISTICS','COD_FEE','COD_RETURN','UPI_REFUND','SETTLEMENT','ADJUSTMENT'] as const).map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 items-center">
          <Input id="seller-settle-from" name="settleFrom" type="date" autoComplete="off" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-36 text-xs" placeholder="From" />
          <span className="text-muted-foreground text-xs">–</span>
          <Input id="seller-settle-to" name="settleTo" type="date" autoComplete="off" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-36 text-xs" placeholder="To" />
        </div>
        <Button variant="outline" size="sm" onClick={() => load()}>
          <RefreshCw className="h-3 w-3 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
          <Receipt className="h-10 w-10 opacity-30" />
          <p className="text-sm">No ledger entries found</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell>{LEDGER_ICONS[e.entryType] ?? null}</TableCell>
                    <TableCell><span className="font-mono text-xs">{e.entryType}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.account}</TableCell>
                    <TableCell className="text-sm">{e.description}{e.note ? <span className="block text-xs text-muted-foreground">{e.note}</span> : null}</TableCell>
                    <TableCell className={`text-right font-medium text-sm ${e.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {e.amount >= 0 ? '+' : ''}{formatCurrency(e.amount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(e.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-muted-foreground">Page {pagination.page} of {pagination.pages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!pagination.hasPrev} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SellerSettlement() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Settlement['status'] | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  // Summary metrics
  const pendingPayout = settlements.filter(s => ['approved', 'pending'].includes(s.status)).reduce((sum, s) => sum + s.netPayable, 0);
  const lastPaid = [...settlements].filter(s => s.status === 'paid').sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  const loadSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settlementApi.myList({
        page,
        limit: 10,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setSettlements(res.settlements);
      setPagination(res.pagination);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to load settlements', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => { loadSettlements(); }, [loadSettlements]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Settlements & Payouts</h1>
            <p className="text-muted-foreground text-sm mt-1">Weekly earnings breakdown and ledger</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSettlements} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Pending Payout</CardDescription>
              <CardTitle className="text-2xl text-green-700">{formatCurrency(pendingPayout)}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">Approved but not yet transferred</p></CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Last Paid</CardDescription>
              <CardTitle className="text-2xl">{lastPaid ? formatCurrency(lastPaid.netPayable) : '—'}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {lastPaid ? `${lastPaid.weekLabel} · ${lastPaid.payoutReference ?? 'Ref N/A'}` : 'No payments yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4" /> Total Settlements</CardDescription>
              <CardTitle className="text-2xl">{pagination?.total ?? settlements.length}</CardTitle>
            </CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">All-time settlement cycles</p></CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="settlements">
          <TabsList className="mb-4">
            <TabsTrigger value="settlements" className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" /> Settlements
            </TabsTrigger>
            <TabsTrigger value="ledger" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Ledger
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settlements">
            {/* Filter bar */}
            <div className="flex gap-3 mb-4 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {(['draft','pending','approved','paid','disputed','cancelled'] as const).map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : settlements.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
                <Wallet className="h-12 w-12 opacity-30" />
                <p className="text-sm">No settlements found</p>
                <p className="text-xs">Settlements are generated every Monday for the previous week.</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Week</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                        <TableHead className="text-right">Net Payable</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlements.map((s) => (
                        <SettlementDetailRow
                          key={s._id}
                          settlement={s}
                          onDisputeSuccess={loadSettlements}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {pagination && pagination.pages > 1 && (
                  <div className="flex justify-between items-center text-sm mt-4">
                    <span className="text-muted-foreground">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={!pagination.hasPrev} onClick={() => setPage(p => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="ledger">
            <LedgerTab />
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
