import { useState, useEffect, useMemo } from "react";
import {
  Search, Clock, CheckCircle, XCircle, Loader2, RefreshCw,
  CreditCard, RotateCcw, Ban, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { toast } from "sonner";
import { API, edgeHeaders, authedEdgeHeaders } from "@/lib/api";

// Server-side handler for destructive ops (bypasses RLS, enforces ownership).
async function callManageTransaction(payload: Record<string, unknown>): Promise<{
  success: boolean;
  message?: string;
  deleted?: number;
  row?: { id: string; invoice_id: string; status: string };
}> {
  const headers = await authedEdgeHeaders();
  const resp = await fetch(API.manageTransaction, {
    method:  "POST",
    headers,
    body: JSON.stringify(payload),
  });
  let body: { success?: boolean; message?: string; deleted?: number; row?: { id: string; invoice_id: string; status: string } } = {};
  try { body = await resp.json(); } catch { /* ignore parse errors */ }
  if (!resp.ok) {
    return { success: false, message: body.message ?? `HTTP ${resp.status}` };
  }
  return {
    success: body.success === true,
    message: body.message,
    deleted: body.deleted,
    row:     body.row,
  };
}

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

// ── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes (matches Midtrans expiry in create-order)

const formatPrice = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const formatCountdown = (ms: number) => {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
};

// Status visual mapping (accepts both English lowercase and Indonesian capitalized)
const statusColors: Record<string, string> = {
  success:    "bg-green-500/15 text-green-500 border-green-500/30",
  berhasil:   "bg-green-500/15 text-green-500 border-green-500/30",
  pending:    "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  menunggu:   "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  processing: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  diproses:   "bg-blue-500/15 text-blue-500 border-blue-500/30",
  failed:     "bg-red-500/15 text-red-500 border-red-500/30",
  gagal:      "bg-red-500/15 text-red-500 border-red-500/30",
  canceled:   "bg-red-500/15 text-red-500 border-red-500/30",
  expired:    "bg-red-500/15 text-red-500 border-red-500/30",
};

const statusLabels: Record<string, string> = {
  success:    "Berhasil",
  berhasil:   "Berhasil",
  pending:    "Menunggu",
  menunggu:   "Menunggu",
  processing: "Diproses",
  diproses:   "Diproses",
  failed:     "Gagal",
  gagal:      "Gagal",
  canceled:   "Dibatalkan",
  expired:    "Kedaluwarsa",
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "success" || status === "berhasil") return <CheckCircle className="h-4 w-4" />;
  if (["failed", "gagal", "canceled", "expired"].includes(status)) return <XCircle className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
};

const isPendingStatus = (status: string) => {
  const s = status?.toLowerCase() ?? "";
  return s === "pending" || s === "menunggu";
};

const isProcessingStatus = (status: string) => {
  const s = status?.toLowerCase() ?? "";
  return s === "processing" || s === "diproses";
};

// "Hapus Semua" must skip these statuses (they're still active)
const isProtectedFromBulkDelete = (status: string) => {
  const s = status?.toLowerCase() ?? "";
  return s === "diproses" || s === "menunggu" || s === "processing" || s === "pending";
};

interface Transaction {
  id: string;
  invoice_id: string;
  product_id?: string;
  reference?: string;
  denomination_label?: string;
  game_slug?: string;
  player_id?: string;
  user_id?: string;
  amount?: number;             // legacy column (may be NULL/0)
  selling_price?: number;      // ACTUAL price column in DB schema
  total_price?: number;        // alt name used by some rows
  payment_method?: string;
  status: string;
  created_at: string;
  payment_token?: string | null;
  snap_token?: string | null;
  payment_url?: string | null;
  snap_redirect_url?: string | null;
}

const resolveAmount = (tx: Transaction): number => {
  const raw = tx.selling_price ?? tx.amount ?? tx.total_price ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const resolveToken = (tx: Transaction): string | null =>
  tx.payment_token ?? tx.snap_token ?? null;

// ── Hook: live ticker for pending transactions ────────────────────────────
function useCountdown(createdAtIso: string | undefined, active: boolean) {
  const expiryMs = useMemo(() => {
    if (!createdAtIso) return 0;
    return new Date(createdAtIso).getTime() + PAYMENT_EXPIRY_MS;
  }, [createdAtIso]);

  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, expiryMs - Date.now()),
  );

  useEffect(() => {
    if (!active || !expiryMs) return;
    setRemaining(Math.max(0, expiryMs - Date.now()));
    const id = setInterval(() => {
      const r = Math.max(0, expiryMs - Date.now());
      setRemaining(r);
      if (r <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [active, expiryMs]);

  return { remaining, expired: active && expiryMs > 0 && remaining <= 0 };
}

// ── Transaction Card ─────────────────────────────────────────────────────────
interface CardProps {
  tx: Transaction;
  onLocalUpdate?: (id: string, patch: Partial<Transaction>) => void;
  onLocalRemove?: (id: string) => void;
  showDelete?: boolean;
}

const TransactionCard = ({ tx: initialTx, onLocalUpdate, onLocalRemove, showDelete }: CardProps) => {
  const [tx, setTx]             = useState(initialTx);
  const [changing, setChanging] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync if parent replaces the row (e.g., after refresh)
  useEffect(() => { setTx(initialTx); }, [initialTx]);

  const normalizedStatus = tx.status?.toLowerCase() ?? "pending";
  const isPending        = isPendingStatus(normalizedStatus);
  const activeToken      = resolveToken(tx);

  const { remaining, expired } = useCountdown(tx.created_at, isPending);

  // Effective status: if the timer ran out on a pending row, treat as "Gagal" in UI
  const effectiveStatus = expired ? "gagal" : normalizedStatus;
  const colorClass      = statusColors[effectiveStatus] ?? statusColors.pending;
  const labelText       = statusLabels[effectiveStatus] ?? tx.status;
  const displayAmount   = resolveAmount(tx);

  // Buttons hidden when expired or already non-pending
  const canResume       = isPending && !expired && !!activeToken;
  const canChangeMethod = isPending && !expired;
  const canCancel       = isPending && !expired;

  // ── Auto-mark expired rows as Gagal in DB (one-shot per row) ────────────
  useEffect(() => {
    if (!expired) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await callManageTransaction({ action: "cancel", transaction_id: tx.id });
        if (!cancelled && result.success) {
          onLocalUpdate?.(tx.id, { status: "Gagal" });
        } else if (!result.success) {
          console.warn("[CekTransaksi] auto-fail skipped:", result.message);
        }
      } catch (err) {
        console.warn("[CekTransaksi] auto-fail error:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [expired, tx.id, onLocalUpdate]);

  // ── Lanjutkan: re-open existing token ─────────────────────────────────────
  const handleResume = () => {
    if (!activeToken) return;
    console.log("[CekTransaksi] Resuming payment:", tx.invoice_id);
    window.snap.pay(activeToken, {
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

  // ── Ubah Metode: regenerate token, OVERWRITE existing row (no duplicate) ─
  const handleChangeMethod = async () => {
    setChanging(true);
    try {
      const repayAmount = resolveAmount(tx);
      if (!repayAmount) {
        toast.error("Harga transaksi 0 / kosong, tidak bisa diulang. Silakan order baru.");
        setChanging(false);
        return;
      }

      const response = await fetch(API.repay, {
        method:  "POST",
        headers: edgeHeaders(),
        body: JSON.stringify({
          original_invoice_id: tx.invoice_id,
          invoice_id:          tx.invoice_id,
          product_id:          tx.product_id,
          player_id:           tx.player_id,
          denomination_label:  tx.denomination_label,
          amount:              repayAmount,
          selling_price:       repayAmount,
          gross_amount:        repayAmount,
          total_price:         repayAmount,
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

      // Defensive: ensure no duplicate row exists. The backend repay
      // function is expected to UPDATE the existing row in-place, but
      // if it inserted a new row we collapse it here so the user only
      // sees one entry per purchase intent.
      if (supabaseConfigured && supabase && result.newInvoiceId !== tx.invoice_id) {
        // Delete any orphan row that was just created with the new invoice_id…
        await supabase
          .from("transactions")
          .delete()
          .eq("invoice_id", result.newInvoiceId)
          .neq("id", tx.id);

        // …then move the original row to the new invoice_id + token.
        const { error: updateError } = await supabase
          .from("transactions")
          .update({
            invoice_id:    result.newInvoiceId,
            payment_token: result.token,
            snap_token:    result.token,
            status:        "pending",
          })
          .eq("id", tx.id);

        if (updateError) {
          console.error("[CekTransaksi] row overwrite failed:", updateError);
        }
      } else if (supabaseConfigured && supabase) {
        // Same invoice_id — just refresh the token field.
        await supabase
          .from("transactions")
          .update({ payment_token: result.token, snap_token: result.token })
          .eq("id", tx.id);
      }

      // Reflect updated data locally
      const patch: Partial<Transaction> = {
        invoice_id:    result.newInvoiceId,
        payment_token: result.token,
        snap_token:    result.token,
        status:        "pending",
      };
      setTx((prev) => ({ ...prev, ...patch }));
      onLocalUpdate?.(tx.id, patch);

      console.log("[CekTransaksi] New token ready — opening Snap:", result.newInvoiceId);

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

  // ── Batalkan Pesanan ────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!window.confirm("Batalkan pesanan ini? Status akan diubah menjadi Gagal.")) return;
    setCancelling(true);
    try {
      const result = await callManageTransaction({ action: "cancel", transaction_id: tx.id });
      // STRICT: only update local UI after server confirms success.
      if (!result.success) {
        toast.error(result.message ?? "Gagal membatalkan pesanan.");
        return;
      }
      toast.success("Pesanan dibatalkan.");
      setTx((prev) => ({ ...prev, status: "Gagal" }));
      onLocalUpdate?.(tx.id, { status: "Gagal" });
    } catch (err) {
      console.error("[CekTransaksi] Cancel error:", err);
      toast.error("Gagal menghubungi server, coba lagi.");
    } finally {
      setCancelling(false);
    }
  };

  // ── Hapus item ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm("Apakah Anda yakin? Data histori tidak dapat dikembalikan.")) return;
    setDeleting(true);
    try {
      const result = await callManageTransaction({ action: "delete", transaction_id: tx.id });
      // STRICT: only remove from UI after server confirms the row was deleted.
      if (!result.success) {
        toast.error(result.message ?? "Gagal menghapus histori.");
        return;
      }
      toast.success("Histori dihapus.");
      onLocalRemove?.(tx.id);
    } catch (err) {
      console.error("[CekTransaksi] Delete error:", err);
      toast.error("Gagal menghubungi server, coba lagi.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-3" data-testid="transaction-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{tx.invoice_id}</p>
          <p className="font-semibold mt-0.5">{tx.denomination_label ?? "—"}</p>
        </div>
        <Badge className={`text-xs border flex items-center gap-1 ${colorClass}`}>
          <StatusIcon status={effectiveStatus} />
          {labelText}
        </Badge>
      </div>

      {/* Live countdown for pending rows */}
      {isPending && !expired && (
        <div className="flex items-center justify-between rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs">
          <span className="text-yellow-400/90 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Bayar sebelum
          </span>
          <span
            className="font-mono font-bold text-yellow-300 tabular-nums"
            data-testid="countdown-timer"
          >
            {formatCountdown(remaining)}
          </span>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Game</span>
        <span className="text-right font-medium capitalize">{tx.game_slug?.replace(/-/g, " ") ?? "—"}</span>
        <span className="text-muted-foreground">Player ID</span>
        <span className="text-right font-mono">{tx.player_id ?? "—"}</span>
        <span className="text-muted-foreground">Metode</span>
        <span className="text-right uppercase">{tx.payment_method ?? "—"}</span>
        <span className="text-muted-foreground font-semibold">Total</span>
        <span className="text-right font-bold text-primary">{formatPrice(displayAmount)}</span>
        <span className="text-muted-foreground">Tanggal</span>
        <span className="text-right text-xs">{formatDate(tx.created_at)}</span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 pt-1">
        {canResume && (
          <Button
            onClick={handleResume}
            disabled={changing || cancelling}
            className="w-full gradient-primary text-white gap-2"
            data-testid="button-resume-payment"
          >
            <CreditCard className="h-4 w-4" />
            Lanjutkan Pembayaran
          </Button>
        )}

        {canChangeMethod && (
          <Button
            onClick={handleChangeMethod}
            disabled={changing || cancelling}
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
        )}

        {canCancel && (
          <Button
            onClick={handleCancel}
            disabled={cancelling || changing}
            variant="outline"
            className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
            data-testid="button-cancel-order"
          >
            {cancelling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Membatalkan...
              </>
            ) : (
              <>
                <Ban className="h-4 w-4" />
                Batalkan Pesanan
              </>
            )}
          </Button>
        )}

        {showDelete && !canCancel && !isProcessingStatus(normalizedStatus) && (
          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="ghost"
            size="sm"
            className="w-full gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            data-testid="button-delete-history"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Hapus Histori
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────
const CekTransaksi = () => {
  const { user } = useAuth();

  const [history, setHistory]               = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError]     = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting]     = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const patchLocal = (id: string, patch: Partial<Transaction>) => {
    setHistory((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeLocal = (id: string) => {
    setHistory((prev) => prev.filter((row) => row.id !== id));
  };

  // ── Hapus Semua: removes everything except active rows (Diproses/Menunggu) ─
  const handleDeleteAll = async () => {
    if (!user) return;

    const deletable = history.filter((row) => !isProtectedFromBulkDelete(row.status));
    if (deletable.length === 0) {
      toast.info("Tidak ada histori yang bisa dihapus (semua transaksi masih aktif).");
      return;
    }

    if (!window.confirm(
      `Apakah Anda yakin? Data histori tidak dapat dikembalikan.\n\n` +
      `${deletable.length} histori akan dihapus. Transaksi yang masih Menunggu / Diproses tidak akan terhapus.`
    )) return;

    setBulkDeleting(true);
    try {
      const result = await callManageTransaction({ action: "delete_all" });
      // STRICT: only refresh UI after server confirms deletion.
      if (!result.success) {
        toast.error(result.message ?? "Gagal menghapus histori.");
        return;
      }
      toast.success(`${result.deleted ?? deletable.length} histori dihapus.`);
      // Reload from DB so UI reflects the actual server state
      await loadHistory();
    } catch (err) {
      console.error("[CekTransaksi] Bulk delete error:", err);
      toast.error("Gagal menghubungi server, coba lagi.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const deletableCount = history.filter((row) => !isProtectedFromBulkDelete(row.status)).length;

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
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="font-display font-semibold text-lg">Riwayat Pesananku</h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
                  onClick={handleDeleteAll}
                  disabled={bulkDeleting || historyLoading || deletableCount === 0}
                  data-testid="button-delete-all"
                >
                  {bulkDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Hapus Semua
                </Button>
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
                {history.map((tx) => (
                  <TransactionCard
                    key={tx.id}
                    tx={tx}
                    onLocalUpdate={patchLocal}
                    onLocalRemove={removeLocal}
                    showDelete
                  />
                ))}
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
              placeholder="Masukkan Invoice ID... (contoh: RYUII-1234567890-ABCD)"
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
