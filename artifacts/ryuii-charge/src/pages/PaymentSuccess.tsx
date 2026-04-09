import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Link } from "wouter";
import { CheckCircle, Clock, XCircle, Loader2, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type PaymentStatus = "loading" | "pending" | "success" | "failed" | "unknown";

interface TransactionInfo {
  invoice_id: string;
  denomination_label?: string;
  game_slug?: string;
  amount?: number;
  payment_method?: string;
  status: string;
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const PaymentSuccess = () => {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const orderId = params.get("orderId") ?? params.get("merchantOrderId") ?? "";

  const [status, setStatus]   = useState<PaymentStatus>("loading");
  const [tx, setTx]           = useState<TransactionInfo | null>(null);

  useEffect(() => {
    if (!orderId) {
      setStatus("unknown");
      return;
    }

    const fetchStatus = async () => {
      if (!supabaseConfigured || !supabase) {
        setStatus("unknown");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("invoice_id, denomination_label, game_slug, amount, payment_method, status")
          .eq("invoice_id", orderId)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setStatus("unknown");
          return;
        }

        setTx(data as TransactionInfo);
        const s = (data as TransactionInfo).status;
        if (s === "success")    setStatus("success");
        else if (s === "failed") setStatus("failed");
        else                    setStatus("pending");
      } catch (err) {
        console.error("[PaymentSuccess] Status fetch error:", err);
        setStatus("unknown");
      }
    };

    fetchStatus();
  }, [orderId]);

  const renderIcon = () => {
    if (status === "loading") return <Loader2 className="h-10 w-10 text-white animate-spin" />;
    if (status === "success") return <CheckCircle className="h-10 w-10 text-white" />;
    if (status === "failed")  return <XCircle className="h-10 w-10 text-white" />;
    return <Clock className="h-10 w-10 text-white" />;
  };

  const iconBg =
    status === "success" ? "gradient-primary" :
    status === "failed"  ? "bg-destructive" :
    status === "loading" ? "bg-muted" :
    "bg-warning";

  const renderTitle = () => {
    if (status === "loading")  return "Memeriksa Status Pembayaran...";
    if (status === "success")  return "Pembayaran Berhasil!";
    if (status === "failed")   return "Pembayaran Gagal";
    if (status === "pending")  return "Menunggu Pembayaran";
    return "Status Tidak Diketahui";
  };

  const renderDesc = () => {
    if (status === "loading")  return "Harap tunggu sebentar...";
    if (status === "success")  return "Item kamu akan segera dikirimkan ke akun game. Proses biasanya kurang dari 1 menit.";
    if (status === "failed")   return "Pembayaran tidak berhasil diproses. Silakan coba lagi atau hubungi support.";
    if (status === "pending")  return "Pembayaran belum kami terima. Jika sudah membayar, status akan diperbarui otomatis.";
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
            {tx.amount != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-primary">{formatPrice(tx.amount)}</span>
              </div>
            )}
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
