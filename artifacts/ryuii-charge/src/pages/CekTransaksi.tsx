import { useState, useEffect } from "react";
import { Search, Clock, CheckCircle, XCircle, Loader2, RefreshCw, CreditCard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import { toast } from "sonner";
import { API, edgeHeaders } from "@/lib/api";

declare global {
  interface Window {
    snap: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const statusColors: Record<string, string> = {
  success:    "bg-green-500/15 text-green-500 border-green-500/30",
  pending:    "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  processing: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  failed:     "bg-red-500/15 text-red-500 border-red-500/30",
  canceled:   "bg-red-500/15 text-red-500 border-red-500/30",
  expired:    "bg-red-500/15 text-red-500 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  success:    "Berhasil",
  pending:    "Menunggu",
  processing: "Diproses",
  failed:     "Gagal",
  canceled:   "Dibatalkan",
  expired:    "Kedaluwarsa",
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "success") return <CheckCircle className="h-4 w-4" />;
  if (status === "failed" || status === "canceled" || status === "expired") return <XCircle className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
};

const isPending = (status: string) => status === "pending" || status === "menunggu";

interface Transaction {
  id: string;
  invoice_id: string;
  product_id?: string;
  reference?: string;
  denomination_label?: string;
  game_slug?: string;
  player_id?: string;
  user_id?: string;
  amount: number;
  payment_method?: string;
  status: string;
  created_at: string;
  payment_token?: string | null;
}

// ── Transaction Card ─────────────────────────────────────────────────────────
const TransactionCard = ({ tx: initialTx }: { tx: Transaction }) => {
  const [tx, setTx]           = useState(initialTx);
  const [changing, setChanging] = useState(false);

  const normalizedStatus = tx.status?.toLowerCase() ?? "pending";
  const colorClass       = statusColors[normalizedStatus] ?? statusColors.pending;
  const labelText        = statusLabels[normalizedStatus] ?? tx.status;
  const canResume        = isPending(normalizedStatus) && !!tx.payment_token;

  // ── Lanjutkan: re-open existing token ─────────────────────────────────────
  const handleResume = () => {
    if (!tx.payment_token) return;
    console.log("[CekTransaksi] Resuming payment:", tx.invoice_id);
    window.snap.pay(tx.payment_token, {
      onSuccess: () => {
        toast.success("Pembayaran berhasil! Memperbarui status...");
        setTimeout(() => window.location.reload(), 1500);
      },
      onPending: () => {
        toast.info("Pembayaran sedang diproses.");
        setTimeout(() => window.location.reload(), 1500);
      },
      onError: () => toast.error("Pembayaran gagal. Silakan coba lagi."),
      onClose: () => toast.info("Popup ditutup."),
    });
  };

  // ── Ubah Metode: generate fresh token from backend ────────────────────────
  const handleChangeMethod = async () => {
    setChanging(true);
    try {
      const response = await fetch(API.repay, {
        method:  "POST",
        headers: edgeHeaders(),
        body: JSON.stringify({
          original_invoice_id: tx.invoice_id,
          product_id:          tx.product_id,
          player_id:           tx.player_id,
          denomination_label:  tx.denomination_label,
          amount:              tx.amount,
          game_slug:           tx.game_slug,
        }),
      });

      const result = await response.json() as {
        success?: boolean;
        token?: string;
        newInvoiceId?: string;
        message?: string;
        error?: string;
      };

      if (!result.success || !result.token || !result.newInvoiceId) {
        const errMsg = result.message ?? result.error ?? "Gagal membuat ulang pembayaran";
        toast.error(errMsg);
        return;
      }

      // Backend already updated invoice_id in Supabase.
      // Frontend only needs to sync the new payment_token so "Lanjutkan" still works.
      if (supabaseConfigured && supabase) {
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ payment_token: result.token })
          .eq("invoice_id", result.newInvoiceId);

        if (updateError) {
          console.error("[CekTransaksi] Supabase token sync error:", updateError);
        }
      }

      // Reflect updated data in the card immediately
      setTx((prev) => ({
        ...prev,
        invoice_id:    result.newInvoiceId!,
        payment_token: result.token!,
      }));

      console.log("[CekTransaksi] New token ready — opening Snap:", result.newInvoiceId);

      // Open Snap with the fresh token
      window.snap.pay(result.token, {
        onSuccess: () => {
          toast.success("Pembayaran berhasil! Memperbarui status...");
          setTimeout(() => window.location.reload(), 1500);
        },
        onPending: () => {
          toast.info("Pembayaran sedang diproses.");
          setTimeout(() => window.location.reload(), 1500);
        },
        onError: () => toast.error("Pembayaran gagal. Silakan coba lagi."),
        onClose: () => toast.info("Popup ditutup."),
      });
    } catch (err) {
      console.error("[CekTransaksi] Change method error:", err);
      toast.error("Gagal menghubungi server, coba lagi");
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{tx.invoice_id}</p>
          <p className="font-semibold mt-0.5">{tx.denomination_label ?? "—"}</p>
        </div>
        <Badge className={`text-xs border flex items-center gap-1 ${colorClass}`}>
          <StatusIcon status={normalizedStatus} />
          {labelText}
        </Badge>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Game</span>
        <span className="text-right font-medium capitalize">{tx.game_slug?.replace(/-/g, " ") ?? "—"}</span>
        <span className="text-muted-foreground">Player ID</span>
        <span className="text-right font-mono">{tx.player_id ?? "—"}</span>
        <span className="text-muted-foreground">Metode</span>
        <span className="text-right uppercase">{tx.payment_method ?? "—"}</span>
        <span className="text-muted-foreground font-semibold">Total</span>
        <span className="text-right font-bold text-primary">{formatPrice(tx.amount)}</span>
        <span className="text-muted-foreground">Tanggal</span>
        <span className="text-right text-xs">{formatDate(tx.created_at)}</span>
      </div>

      {/* Action buttons — only for pending transactions */}
      {canResume && (
        <div className="flex flex-col gap-2 pt-1">
          <Button
            onClick={handleResume}
            disabled={changing}
            className="w-full gradient-primary text-white gap-2"
            data-testid="button-resume-payment"
          >
            <CreditCard className="h-4 w-4" />
            Lanjutkan Pembayaran
          </Button>

          <Button
            onClick={handleChangeMethod}
            disabled={changing}
            variant="outline"
            className="w-full gap-2 border-border/50"
            data-testid="button-change-method"
          >
            {changing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Ubah Metode Pembayaran
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────
const CekTransaksi = () => {
  const { user } = useAuth();

  const [history, setHistory]               = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError]     = useState<string | null>(null);

  const [invoiceId, setInvoiceId]           = useState("");
  const [guestResult, setGuestResult]       = useState<Transaction | null>(null);
  const [guestNotFound, setGuestNotFound]   = useState(false);
  const [guestSearching, setGuestSearching] = useState(false);

  const loadHistory = async () => {
    if (!user || !supabaseConfigured || !supabase) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistory((data as Transaction[]) ?? []);
    } catch (err) {
      console.error("[CekTransaksi] Failed to load history:", err);
      setHistoryError("Gagal memuat riwayat transaksi. Coba lagi.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  const handleGuestSearch = async () => {
    if (!invoiceId.trim()) return;
    setGuestSearching(true);
    setGuestResult(null);
    setGuestNotFound(false);

    try {
      if (!supabaseConfigured || !supabase) {
        setGuestNotFound(true);
        setGuestSearching(false);
        return;
      }
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("invoice_id", invoiceId.trim())
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setGuestResult(data as Transaction);
      } else {
        setGuestNotFound(true);
      }
    } catch (err) {
      console.error("[CekTransaksi] Guest search error:", err);
      setGuestNotFound(true);
    } finally {
      setGuestSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-12 max-w-2xl">

        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold">Cek Transaksi</h1>
          <p className="text-muted-foreground mt-2">
            {user ? "Riwayat pesanan akun kamu" : "Masukkan Invoice ID untuk melacak pesanan"}
          </p>
        </div>

        {/* ── Authenticated: auto-loaded history ── */}
        {user && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg">Riwayat Pesananku</h2>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-border/50 text-xs"
                onClick={loadHistory}
                disabled={historyLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {historyLoading && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {historyError && !historyLoading && (
              <div className="glass-card p-5 text-center text-sm text-destructive">{historyError}</div>
            )}

            {!historyLoading && !historyError && history.length === 0 && (
              <div className="glass-card p-8 text-center text-muted-foreground text-sm">
                Belum ada transaksi. Topup pertamamu sekarang!
              </div>
            )}

            {!historyLoading && history.length > 0 && (
              <div className="space-y-3">
                {history.map((tx) => <TransactionCard key={tx.id} tx={tx} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Guest / Invoice search ── */}
        <div>
          {user && (
            <h2 className="font-display font-semibold text-lg mb-4">Cari Berdasarkan Invoice ID</h2>
          )}
          <div className="flex gap-3 mb-6">
            <Input
              placeholder="Masukkan Invoice ID... (contoh: RC-1234567890-ABCDEF)"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGuestSearch()}
              className="bg-muted/50 border-border/50"
              data-testid="input-invoice-id"
            />
            <Button
              onClick={handleGuestSearch}
              disabled={guestSearching || !invoiceId.trim()}
              className="btn-neon gradient-primary text-white shrink-0"
              data-testid="button-search-transaction"
            >
              {guestSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {guestResult && (
            <div data-testid="transaction-result">
              <TransactionCard tx={guestResult} />
            </div>
          )}

          {guestNotFound && (
            <div className="glass-card p-6 text-center" data-testid="transaction-not-found">
              <p className="text-muted-foreground">Invoice ID tidak ditemukan.</p>
              <p className="text-sm text-muted-foreground mt-1">Periksa kembali Invoice ID yang kamu masukkan.</p>
            </div>
          )}
        </div>

      </div>
      <Footer />
    </div>
  );
};

export default CekTransaksi;
