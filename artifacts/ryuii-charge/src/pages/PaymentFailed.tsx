import { Link } from "wouter";
import { XCircle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PaymentFailed = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="container mx-auto px-4 py-20 max-w-sm text-center">
      <div className="flex justify-center mb-6">
        <div className="h-20 w-20 rounded-full bg-destructive/20 border-2 border-destructive/50 flex items-center justify-center">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
      </div>
      <h1 className="font-display text-2xl font-bold mb-2" data-testid="text-failed-title">Pembayaran Gagal</h1>
      <p className="text-muted-foreground mb-8">Terjadi kesalahan saat memproses pembayaran kamu. Silakan coba lagi atau gunakan metode pembayaran lain.</p>
      <div className="flex flex-col gap-3">
        <Link to="/">
          <Button className="w-full gap-2 btn-neon gradient-primary text-white">
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </Button>
        </Link>
        <Link to="/">
          <Button variant="outline" className="w-full gap-2 border-border/50">
            <Home className="h-4 w-4" />
            Kembali ke Beranda
          </Button>
        </Link>
      </div>
    </div>
    <Footer />
  </div>
);

export default PaymentFailed;
