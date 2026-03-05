import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Send,
  CheckCheck,
  MailOpen,
  X,
  RotateCcw,
  ChevronLeft,
  Inbox,
  Clock,
  CheckCircle,
  Archive,
  User,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────────
type ConversationStatus = 'open' | 'replied' | 'closed';

interface ConversationSummary {
  _id: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  status: ConversationStatus;
  unreadByArtisan: number;
  lastMessageAt: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
}

interface Message {
  _id: string;
  sender: 'customer' | 'artisan';
  content: string;
  readByArtisan: boolean;
  createdAt: string;
}

interface FullConversation {
  _id: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  status: ConversationStatus;
  unreadByArtisan: number;
  lastMessageAt: string;
  createdAt: string;
  thread: Message[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const STATUS_CONFIG: Record<ConversationStatus, { label: string; color: string; icon: React.ElementType }> = {
  open:    { label: 'Open',    color: 'bg-blue-100 text-blue-800',   icon: Clock       },
  replied: { label: 'Replied', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  closed:  { label: 'Closed',  color: 'bg-gray-100 text-gray-600',   icon: Archive     },
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ArtisanMessages = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Inbox state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Thread state
  const [activeConversation, setActiveConversation] = useState<FullConversation | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Mobile: show list or thread
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  const threadEndRef = useRef<HTMLDivElement>(null);

  // ── Load inbox ─────────────────────────────────────────────────────────────
  const loadInbox = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const resp = await api.messages.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchTerm || undefined,
        limit: 50,
      });
      setConversations(resp.conversations);
      setUnreadTotal(resp.unreadTotal);
    } catch (err) {
      if (!silent) {
        toast({ title: 'Error', description: 'Failed to load messages.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchTerm, toast]);

  useEffect(() => {
    if (user) {
      loadInbox();
      const interval = setInterval(() => loadInbox(true), 30_000);
      return () => clearInterval(interval);
    }
  }, [user, loadInbox]);

  // ── Open thread ────────────────────────────────────────────────────────────
  const openThread = async (conv: ConversationSummary) => {
    setLoadingThread(true);
    setMobileView('thread');

    try {
      const resp = await api.messages.get(conv._id);
      setActiveConversation(resp.conversation);
      setReplyText('');

      // Mark as read if there are unread messages
      if (conv.unreadByArtisan > 0) {
        await api.messages.markRead(conv._id);
        setConversations(prev =>
          prev.map(c => c._id === conv._id ? { ...c, unreadByArtisan: 0 } : c)
        );
        setUnreadTotal(prev => Math.max(0, prev - conv.unreadByArtisan));
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load conversation.', variant: 'destructive' });
    } finally {
      setLoadingThread(false);
    }
  };

  // Auto-scroll thread to bottom
  useEffect(() => {
    if (activeConversation) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConversation]);

  // ── Send reply ─────────────────────────────────────────────────────────────
  const handleReply = async () => {
    if (!activeConversation || !replyText.trim()) return;
    setSending(true);

    try {
      const resp = await api.messages.reply(activeConversation._id, replyText.trim());
      // Reload full thread to get proper IDs and timestamps
      const updated = await api.messages.get(activeConversation._id);
      setActiveConversation(updated.conversation);
      setReplyText('');

      // Update inbox summary
      setConversations(prev =>
        prev.map(c =>
          c._id === activeConversation._id
            ? {
                ...c,
                status: 'replied',
                lastMessage: replyText.trim().slice(0, 120),
                lastMessageAt: new Date().toISOString(),
              }
            : c
        )
      );

      toast({ title: 'Reply sent', description: 'Your message was delivered.' });
    } catch (err) {
      toast({
        title: 'Failed to send',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  // ── Close / Reopen ─────────────────────────────────────────────────────────
  const handleToggleClose = async () => {
    if (!activeConversation) return;
    setClosingId(activeConversation._id);

    try {
      if (activeConversation.status === 'closed') {
        await api.messages.reopen(activeConversation._id);
        setActiveConversation(prev => prev ? { ...prev, status: 'open' } : prev);
        setConversations(prev =>
          prev.map(c => c._id === activeConversation._id ? { ...c, status: 'open' } : c)
        );
        toast({ title: 'Conversation reopened' });
      } else {
        await api.messages.close(activeConversation._id);
        setActiveConversation(prev => prev ? { ...prev, status: 'closed' } : prev);
        setConversations(prev =>
          prev.map(c => c._id === activeConversation._id ? { ...c, status: 'closed' } : c)
        );
        toast({ title: 'Conversation closed' });
      }
    } catch {
      toast({ title: 'Error', description: 'Action failed. Try again.', variant: 'destructive' });
    } finally {
      setClosingId(null);
    }
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = conversations.filter(c => {
    const q = searchTerm.toLowerCase();
    return (
      c.customerName.toLowerCase().includes(q) ||
      c.customerEmail.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading messages…</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">Messages</h1>
              {unreadTotal > 0 && (
                <Badge className="bg-orange-500 text-white text-sm px-2 py-0.5">
                  {unreadTotal} unread
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">Manage customer inquiries and conversations</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadInbox()} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Two-panel messaging UI */}
        <div className="flex border rounded-xl overflow-hidden bg-card shadow-sm min-h-[600px]">

          {/* ── Left: Inbox list ───────────────────────────────────────────── */}
          <div
            className={`
              flex flex-col border-r bg-muted/30
              ${mobileView === 'thread' ? 'hidden md:flex' : 'flex'}
              w-full md:w-80 lg:w-96 flex-shrink-0
            `}
          >
            {/* Search + filter */}
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations…"
                  className="pl-9 h-9"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="w-full h-8 text-xs">
                  <TabsTrigger value="all"     className="flex-1 text-xs">All</TabsTrigger>
                  <TabsTrigger value="open"    className="flex-1 text-xs">Open</TabsTrigger>
                  <TabsTrigger value="replied" className="flex-1 text-xs">Replied</TabsTrigger>
                  <TabsTrigger value="closed"  className="flex-1 text-xs">Closed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto divide-y">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                  <Inbox className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {searchTerm ? 'No results found' : 'No messages yet'}
                  </p>
                  {!searchTerm && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Customer inquiries will appear here
                    </p>
                  )}
                </div>
              ) : (
                filtered.map(conv => {
                  const isActive = activeConversation?._id === conv._id;
                  const StatusIcon = STATUS_CONFIG[conv.status].icon;
                  return (
                    <button
                      key={conv._id}
                      onClick={() => openThread(conv)}
                      className={`
                        w-full text-left p-4 transition-colors hover:bg-accent/50 focus-visible:outline-none
                        ${isActive ? 'bg-accent' : ''}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <Avatar className="w-9 h-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {getInitials(conv.customerName)}
                            </AvatarFallback>
                          </Avatar>
                          {conv.unreadByArtisan > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                              {conv.unreadByArtisan}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className={`text-sm truncate ${conv.unreadByArtisan > 0 ? 'font-semibold text-foreground' : 'font-medium'}`}>
                              {conv.customerName}
                            </p>
                            <span className="text-[11px] text-muted-foreground flex-shrink-0">
                              {formatRelativeTime(conv.lastMessageAt)}
                            </span>
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${conv.unreadByArtisan > 0 ? 'text-foreground/80 font-medium' : 'text-muted-foreground'}`}>
                            {conv.subject}
                          </p>
                          <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                            {conv.lastMessage}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CONFIG[conv.status].color}`}>
                              <StatusIcon className="w-2.5 h-2.5" />
                              {STATUS_CONFIG[conv.status].label}
                            </span>
                            {conv.messageCount > 1 && (
                              <span className="text-[11px] text-muted-foreground/60">
                                {conv.messageCount} msgs
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Right: Thread / Empty state ───────────────────────────────── */}
          <div
            className={`
              flex flex-col flex-1 min-w-0
              ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
            `}
          >
            {/* Mobile back button */}
            {mobileView === 'thread' && (
              <div className="md:hidden flex items-center px-4 py-2 border-b">
                <Button variant="ghost" size="sm" onClick={() => setMobileView('list')}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              </div>
            )}

            {!activeConversation && !loadingThread ? (
              /* Empty / No selection */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <MessageSquare className="w-14 h-14 text-muted-foreground/25 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">Select a conversation</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Choose a message from the list to read and reply
                </p>
              </div>
            ) : loadingThread ? (
              /* Loading thread */
              <div className="flex-1 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeConversation ? (
              <>
                {/* Thread header */}
                <div className="flex items-start justify-between gap-4 px-6 py-4 border-b bg-muted/20">
                  <div className="flex items-start gap-3 min-w-0">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getInitials(activeConversation.customerName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{activeConversation.customerName}</p>
                      <p className="text-xs text-muted-foreground truncate">{activeConversation.customerEmail}</p>
                      <p className="text-sm font-medium text-foreground/80 mt-0.5 truncate">{activeConversation.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Status badge */}
                    <Badge
                      className={`text-xs ${STATUS_CONFIG[activeConversation.status].color}`}
                      variant="outline"
                    >
                      {STATUS_CONFIG[activeConversation.status].label}
                    </Badge>
                    {/* Close / Reopen */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleClose}
                      disabled={closingId === activeConversation._id}
                      className="text-xs h-8"
                    >
                      {closingId === activeConversation._id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : activeConversation.status === 'closed' ? (
                        <>
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reopen
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3 mr-1" />
                          Close
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Thread messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {/* Date header */}
                  <p className="text-center text-xs text-muted-foreground/60">
                    {formatFullDate(activeConversation.createdAt)} • {activeConversation.thread.length} message{activeConversation.thread.length !== 1 ? 's' : ''}
                  </p>

                  {activeConversation.thread.map((msg, idx) => {
                    const isArtisan = msg.sender === 'artisan';
                    return (
                      <div
                        key={msg._id ?? idx}
                        className={`flex gap-3 ${isArtisan ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        {/* Avatar */}
                        <Avatar className="w-8 h-8 flex-shrink-0 mt-1">
                          <AvatarFallback
                            className={`text-xs font-semibold ${
                              isArtisan
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            {isArtisan ? 'Me' : getInitials(activeConversation.customerName)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Bubble */}
                        <div className={`max-w-[70%] ${isArtisan ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                          <div
                            className={`
                              rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                              ${isArtisan
                                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                : 'bg-muted text-foreground rounded-tl-sm'
                              }
                            `}
                          >
                            {msg.content}
                          </div>
                          <div className={`flex items-center gap-1.5 ${isArtisan ? 'flex-row-reverse' : 'flex-row'}`}>
                            <span className="text-[11px] text-muted-foreground/60">
                              {formatMessageTime(msg.createdAt)}
                            </span>
                            {isArtisan && (
                              <CheckCheck className="w-3 h-3 text-primary/60" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                {/* Reply box */}
                <div className="border-t px-6 py-4 bg-muted/10">
                  {activeConversation.status === 'closed' ? (
                    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground py-2 px-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4" />
                        <span>Conversation is closed. Reopen it to send a reply.</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleClose}
                        disabled={closingId === activeConversation._id}
                      >
                        <RotateCcw className="w-3 h-3 mr-1.5" />
                        Reopen
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-3 items-end">
                      <Textarea
                        placeholder="Write a reply…"
                        className="flex-1 resize-none min-h-[72px] max-h-40 text-sm"
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleReply();
                          }
                        }}
                        disabled={sending}
                      />
                      <Button
                        onClick={handleReply}
                        disabled={sending || !replyText.trim()}
                        className="flex-shrink-0 h-10"
                      >
                        {sending ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground/50 mt-2">
                    Press Ctrl+Enter to send
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ArtisanMessages;
