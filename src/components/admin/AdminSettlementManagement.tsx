import { useState, useEffect, useCallback } from 'react';
import { settlementApi, type Settlement, type LedgerEntry, type PlatformSummary, type Pagination } from '../../lib/api';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Loader2, RefreshCw, CheckCircle2, DollarSign, TrendingUp,
  AlertCircle, Filter, Receipt, ArrowDownLeft, ArrowUpRight,
  Wallet, Play, BarChart3,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_COLOR: Record<Settlement['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-200 text-gray-500',
};

function StatusBadge({ status }: { status: Settlement['status'] }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[status]}`}>
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

// ── MarkPaidModal ─────────────────────────────────────────────────────────────

function MarkPaidModal({
  settlement,
  open,
  onClose,
  onSuccess,
}: {
  settlement: Settlement | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [ref, setRef] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (open) setRef(''); }, [open]);

  if (!settlement) return null;

  const handleSubmit = async () => {
    if (!ref.trim()) return;
    setLoading(true);
    try {
      await settlementApi.markPaid(settlement.settlementId, ref.trim());
      toast({ title: 'Marked as Paid', description: `Settlement ${settlement.settlementId} marked paid.` });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Settlement as Paid</DialogTitle>
          <DialogDescription>{settlement.settlementId} · {fmt(settlement.netPayable)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="payout-ref">Payout Reference / UTR / Transaction ID</Label>
          <Input id="payout-ref" name="payoutRef" autoComplete="off" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. UTR1234567890" />
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !ref.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Mark Paid
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── RefundModal ───────────────────────────────────────────────────────────────

function RefundModal({
  type,
  open,
  onClose,
  onSuccess,
}: {
  type: 'upi' | 'cod';
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (open) { setOrderId(''); setAmount(''); setReason(''); } }, [open]);

  const handleSubmit = async () => {
    if (!orderId.trim()) return;
    setLoading(true);
    try {
      if (type === 'upi') {
        await settlementApi.processUpiRefund({
          orderId: orderId.trim(),
          refundAmount: amount ? parseFloat(amount) : undefined,
          reason: reason || undefined,
        });
      } else {
        await settlementApi.processCodReturn({ orderId: orderId.trim(), reason: reason || undefined });
      }
      toast({ title: `${type.toUpperCase()} ${type === 'upi' ? 'Refund' : 'Return'} processed`, description: 'Settlement updated.' });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Process {type === 'upi' ? 'UPI Refund' : 'COD Return'}</DialogTitle>
          <DialogDescription>This will deduct the amount from the artisan's current draft settlement.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="refund-order-id">Order ID</Label>
            <Input id="refund-order-id" name="orderId" autoComplete="off" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="MongoDB _id of the order" />
          </div>
          {type === 'upi' && (
            <div>
              <Label htmlFor="refund-amount">Refund Amount (leave blank for full amount)</Label>
              <Input id="refund-amount" name="refundAmount" type="number" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 499.00" />
            </div>
          )}
          <div>
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Optional reason..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !orderId.trim()} variant="destructive">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Process {type === 'upi' ? 'Refund' : 'Return'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── PlatformSummaryTab ────────────────────────────────────────────────────────

function PlatformSummaryTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settlementApi.platformSummary(from || undefined, to || undefined);
      setData(res);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [from, to, toast]);

  useEffect(() => { load(); }, [load]);

  const ACCOUNT_LABELS: Record<string, string> = {
    platform_revenue: 'Platform Revenue',
    seller_payable: 'Seller Payable',
    logistics_payable: 'Logistics Payable',
    buyer_receivable: 'Buyer Receivable',
    refund_payable: 'Refund Payable',
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex gap-2 items-center">
          <Input id="ledger-from" name="ledgerFrom" type="date" autoComplete="off" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 text-xs" />
          <span className="text-muted-foreground text-xs">—</span>
          <Input id="ledger-to" name="ledgerTo" type="date" autoComplete="off" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 text-xs" />
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : data ? (
        <>
          {/* Account totals */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(data.totals).map(([account, total]) => (
              <Card key={account}>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs">{ACCOUNT_LABELS[account] ?? account}</CardDescription>
                  <CardTitle className={`text-xl ${total >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(total)}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailed Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Entry Type</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Entries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.summary.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{ACCOUNT_LABELS[row._id.account] ?? row._id.account}</TableCell>
                      <TableCell>{LEDGER_ICONS[row._id.entryType] ?? null} <span className="ml-1 font-mono text-xs">{row._id.entryType}</span></TableCell>
                      <TableCell className={`text-right font-medium ${row.total >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(row.total)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

// ── AdminLedgerTab ────────────────────────────────────────────────────────────

function AdminLedgerTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryType, setEntryType] = useState<LedgerEntry['entryType'] | 'ALL'>('ALL');
  const [account, setAccount] = useState<LedgerEntry['account'] | 'ALL'>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await settlementApi.adminLedger({
        page, limit: 25,
        entryType: entryType === 'ALL' ? undefined : entryType,
        account: account === 'ALL' ? undefined : account,
        from: from || undefined,
        to: to || undefined,
      });
      setEntries(res.entries);
      setPagination(res.pagination);
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, entryType, account, from, to, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <Select value={entryType} onValueChange={(v) => { setEntryType(v as typeof entryType); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Entry type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {(['SALE','COMMISSION','LOGISTICS','COD_FEE','COD_RETURN','UPI_REFUND','SETTLEMENT','ADJUSTMENT'] as const).map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={account} onValueChange={(v) => { setAccount(v as typeof account); setPage(1); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Account" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All accounts</SelectItem>
            {(['platform_revenue','seller_payable','logistics_payable','buyer_receivable','refund_payable'] as const).map(a => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 items-center">
          <Input id="settle-from" name="settleFrom" type="date" autoComplete="off" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-36 text-xs" />
          <span className="text-muted-foreground text-xs">—</span>
          <Input id="settle-to" name="settleTo" type="date" autoComplete="off" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-36 text-xs" />
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3 w-3 mr-1" /> Refresh</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
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
                      {e.amount >= 0 ? '+' : ''}{fmt(e.amount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(e.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-between items-center text-sm">
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

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminSettlementManagement() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Settlement['status'] | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [markPaidTarget, setMarkPaidTarget] = useState<Settlement | null>(null);
  const [refundType, setRefundType] = useState<'upi' | 'cod' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadSettlements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await settlementApi.adminList({
        page, limit: 15,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setSettlements(res.settlements);
      setPagination(res.pagination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load settlements';
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => { loadSettlements(); }, [loadSettlements]);

  const handleGenerateWeekly = async () => {
    setGenerating(true);
    try {
      const res = await settlementApi.generateWeekly();
      toast({ title: 'Settlements generated', description: `${res.generated} settlement(s) created/updated.` });
      loadSettlements();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async (s: Settlement) => {
    try {
      await settlementApi.approve(s.settlementId);
      toast({ title: 'Approved', description: `${s.settlementId} approved.` });
      loadSettlements();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    }
  };

  // Totals
  const totalNetPayable = settlements.reduce((sum, s) => sum + s.netPayable, 0);
  const approvedCount = settlements.filter(s => s.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Settlement Management</h2>
          <p className="text-muted-foreground text-sm">Manage weekly artisan payouts and accounting</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setRefundType('upi')}>
            <ArrowDownLeft className="mr-1 h-4 w-4" /> UPI Refund
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefundType('cod')}>
            <ArrowDownLeft className="mr-1 h-4 w-4" /> COD Return
          </Button>
          <Button size="sm" onClick={handleGenerateWeekly} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Generate Weekly
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1"><Wallet className="h-3 w-3" /> Total Loaded</CardDescription>
            <CardTitle className="text-xl">{pagination?.total ?? settlements.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Approved (current)</CardDescription>
            <CardTitle className="text-xl text-blue-700">{approvedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Net Payable (loaded)</CardDescription>
            <CardTitle className="text-xl text-green-700">{fmt(totalNetPayable)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Disputed (loaded)</CardDescription>
            <CardTitle className="text-xl text-red-700">{settlements.filter(s => s.status === 'disputed').length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="settlements">
        <TabsList>
          <TabsTrigger value="settlements" className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4" /> Settlements
          </TabsTrigger>
          <TabsTrigger value="platform" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" /> P&amp;L Summary
          </TabsTrigger>
          <TabsTrigger value="ledger" className="flex items-center gap-1.5">
            <Receipt className="h-4 w-4" /> Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settlements" className="mt-4">
          {/* Filters */}
          <div className="flex gap-3 mb-4 items-center">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {(['draft','pending','approved','paid','disputed','cancelled'] as const).map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadSettlements} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : settlements.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <Wallet className="h-12 w-12 opacity-30" />
              <p className="text-sm">No settlements found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Week</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Net Payable</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlements.map((s) => (
                      <TableRow key={s._id}>
                        <TableCell className="font-mono text-xs">{s.settlementId}</TableCell>
                        <TableCell>{s.weekLabel}</TableCell>
                        <TableCell className="text-xs">{fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}</TableCell>
                        <TableCell className="text-right">{fmt(s.grossRevenue)}</TableCell>
                        <TableCell className="text-right text-red-600">−{fmt(s.platformCommission)}</TableCell>
                        <TableCell className="text-right font-semibold text-green-700">{fmt(s.netPayable)}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(s.status === 'pending' || s.status === 'draft') && (
                              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleApprove(s)}>
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                              </Button>
                            )}
                            {s.status === 'approved' && (
                              <Button variant="default" size="sm" className="text-xs h-7" onClick={() => setMarkPaidTarget(s)}>
                                <DollarSign className="mr-1 h-3 w-3" /> Mark Paid
                              </Button>
                            )}
                            {s.status === 'disputed' && (
                              <Badge className="bg-red-100 text-red-700 text-xs">Under Review</Badge>
                            )}
                            {s.status === 'paid' && (
                              <span className="text-xs text-muted-foreground">{s.payoutReference}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {pagination && pagination.pages > 1 && (
                <div className="flex justify-between items-center text-sm mt-4">
                  <span className="text-muted-foreground">Page {pagination.page} of {pagination.pages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={!pagination.hasPrev} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="platform" className="mt-4">
          <PlatformSummaryTab />
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <AdminLedgerTab />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <MarkPaidModal settlement={markPaidTarget} open={!!markPaidTarget} onClose={() => setMarkPaidTarget(null)} onSuccess={loadSettlements} />
      <RefundModal type={refundType ?? 'upi'} open={!!refundType} onClose={() => setRefundType(null)} onSuccess={loadSettlements} />
    </div>
  );
}

export default AdminSettlementManagement;
