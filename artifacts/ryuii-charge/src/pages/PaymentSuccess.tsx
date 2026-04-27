import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Link } from "wouter";
import { CheckCircle, Clock, XCircle, Loader2, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type PaymentStatus = "loading" | "pending" | "processing" | "success" | "failed" | "unknown";

interface TransactionInfo {
  invoice_id: string;
  denomination_label?: string;
  game_slug?: string;
  amount?: number;
  selling_price?: number;
  total_price?: number;
  payment_method?: string;
  status: string;
}

// Normalize raw DB status (mixed English/Indonesian) into our UI bucket.
function normalizeStatus(raw: string): PaymentStatus {
  const s = (raw ?? "").toLowerCase().trim();
  if (s === "berhasil" || s === "success" || s === "settlement" || s === "capture") return "success";
  if (s === "gagal" || s === "failed" || s === "canceled" || s === "cancelled" ||
      s === "expired" || s === "deny" || s === "expire") return "failed";
  if (s === "diproses" || s === "processing") return "processing";
  // pending | menunggu | unknown → treat as pending (still waiting for payment)
  return "pending";
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const PaymentSuccess = () => {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orderId =
    params.get("order_id") ??
    params.get("orderId") ??
    params.get("merchantOrderId") ??
    "";

  const [status, setStatus]   = useState<PaymentStatus>("loading");
  const [tx, setTx]           = useState<TransactionInfo | null>(null);

  // Poll the DB until we reach a terminal status (success/failed) or until
  // ~3 minutes elapse, so the UI reflects what the webhook just wrote.
  useEffect(() => {
    if (!orderId) {
      setStatus("unknown");
      return;
    }

    if (!supabaseConfigured || !supabase) {
      setStatus("unknown");
      return;
    }

    let cancelled = false;
    let pollHandle: ReturnType<typeof setTimeout> | null = null;
    let attempts  = 0;
    const MAX_ATTEMPTS = 36; // 36 * 5s = 3 minutes of polling

    const fetchOnce = async () => {
      try {
        const { data, error } = await supabase!
          .from("transactions")
          .select("invoice_id, denomination_label, game_slug, amount, selling_price, total_price, payment_method, status")
          .eq("invoice_id", orderId)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;

        if (!data) {
          setStatus("unknown");
          return;
        }

        const row = data as TransactionInfo;
        setTx(row);
        const next = normalizeStatus(row.status);
        setStatus(next);

        // Stop polling once we reach a terminal status
        if (next === "success" || next === "failed") return;

        // Otherwise schedule another poll
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) {
          pollHandle = setTimeout(fetchOnce, 5_000);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[PaymentSuccess] Status fetch error:", err);
        // Don't permanently fail — just retry a few more times.
        attempts += 1;
        if (attempts < MAX_ATTEMPTS) {
          pollHandle = setTimeout(fetchOnce, 5_000);
        } else {
          setStatus("unknown");
        }
      }
    };

    fetchOnce();
    return () => {
      cancelled = true;
      if (pollHandle) clearTimeout(pollHandle);
    };
  }, [orderId]);

  const renderIcon = () => {
    if (status === "loading")    return <Loader2 className="h-10 w-10 text-white animate-spin" />;
    if (status === "success")    return <CheckCircle className="h-10 w-10 text-white" />;
    if (status === "failed")     return <XCircle className="h-10 w-10 text-white" />;
    if (status === "processing") return <Loader2 className="h-10 w-10 text-white animate-spin" />;
    return <Clock className="h-10 w-10 text-white" />;
  };

  const iconBg =
    status === "success"    ? "gradient-primary" :
    status === "failed"     ? "bg-destructive" :
    status === "loading"    ? "bg-muted" :
    status === "processing" ? "bg-blue-500" :
    "bg-warning";

  const renderTitle = () => {
    if (status === "loading")    return "Memeriksa Status Pembayaran...";
    if (status === "success")    return "Pembayaran Berhasil!";
    if (status === "failed")     return "Pembayaran Gagal";
    if (status === "processing") return "Sedang Diproses";
    if (status === "pending")    return "Menunggu Pembayaran";
    return "Status Tidak Diketahui";
  };

  const renderDesc = () => {
    if (status === "loading")    return "Harap tunggu sebentar...";
    if (status === "success")    return "Item kamu sudah dikirim ke akun game. Cek inventory game-mu sekarang!";
    if (status === "failed")     return "Pembayaran tidak berhasil diproses. Silakan coba lagi atau hubungi support.";
    if (status === "processing") return "Pembayaran diterima — item sedang dikirim ke akun game. Tunggu sebentar...";
    if (status === "pending")    return "Pembayaran belum kami terima. Jika sudah membayar, status akan diperbarui otomatis.";
    return orderId
      ? "Tidak dapat menemukan data transaksi untuk order ini. Gunakan Cek Transaksi untuk mencari secara manual."
      : "Tidak ada order ID pada URL. Gunakan Cek Transaksi untuk mencari pesananmu.";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-20 max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <div className={`h-20 w-20 rounded-full ${iconBg} flex items-center justify-center`}>
            {renderIcon()}
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold mb-2" data-testid="text-success-title">
          {renderTitle()}
        </h1>
        <p className="text-muted-foreground mb-6 text-sm">{renderDesc()}</p>

        {tx && status !== "loading" && (
          <div className="glass-card p-4 text-left text-sm space-y-2 mb-6">
            {orderId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice ID</span>
                <span className="font-mono text-xs">{orderId}</span>
              </div>
            )}
            {tx.denomination_label && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Produk</span>
                <span className="font-medium">{tx.denomination_label}</span>
              </div>
            )}
            {tx.game_slug && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Game</span>
                <span className="capitalize">{tx.game_slug.replace(/-/g, " ")}</span>
              </div>
            )}
            {(() => {
              const amt = Number((tx as any).selling_price ?? tx.amount ?? (tx as any).total_price ?? 0);
              return amt > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-primary">{formatPrice(amt)}</span>
                </div>
              ) : null;
            })()}
          </div>
        )}

        {status !== "loading" && (
          <div className="flex flex-col gap-3">
            <Link to="/cek-transaksi">
              <Button className="w-full gap-2 btn-neon gradient-primary text-white">
                <Search className="h-4 w-4" />
                Cek Status Pesanan
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full gap-2 border-border/50">
                <Home className="h-4 w-4" />
                Kembali ke Beranda
              </Button>
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default PaymentSuccess;
