import { useState } from "react";
import { Link } from "wouter";
import { Zap, X, FileText, RefreshCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Konten Syarat & Ketentuan ────────────────────────────────────────────────
function TermsContent() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
      <p className="text-foreground font-medium">
        Dengan menggunakan layanan RyuiiCharge, Anda dianggap telah membaca,
        memahami, dan menyetujui syarat dan ketentuan berikut.
      </p>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">1</span>
          Layanan
        </h3>
        <p className="pl-8">
          RyuiiCharge menyediakan layanan pengisian ulang (top-up) mata uang
          virtual dan produk digital secara real-time kepada pengguna di
          seluruh Indonesia.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">2</span>
          Kewajiban Pengguna
        </h3>
        <p className="pl-8">
          Pengguna wajib memberikan data yang akurat, termasuk namun tidak
          terbatas pada User ID, Zone ID, atau nomor telepon.{" "}
          <span className="text-foreground font-medium">
            Kesalahan input data oleh pengguna adalah tanggung jawab pengguna
            sepenuhnya.
          </span>
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">3</span>
          Harga
        </h3>
        <p className="pl-8">
          Harga dapat berubah sewaktu-waktu tanpa pemberitahuan sebelumnya
          mengikuti kebijakan provider dan nilai tukar mata uang.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">4</span>
          Transaksi
        </h3>
        <p className="pl-8">
          Transaksi dianggap sah jika pembayaran telah dikonfirmasi oleh
          sistem kami melalui Midtrans. Konfirmasi pembayaran bersifat otomatis
          dan permanen.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">5</span>
          Batasan Tanggung Jawab
        </h3>
        <p className="pl-8">
          RyuiiCharge tidak bertanggung jawab atas kerugian yang diakibatkan
          oleh penyalahgunaan akun pihak ketiga atau kesalahan sistem dari
          pihak pengembang game (publisher).
        </p>
      </div>

      <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border/40 text-xs">
        Syarat dan ketentuan ini berlaku efektif sejak Anda pertama kali
        menggunakan layanan RyuiiCharge. RyuiiCharge berhak memperbarui
        ketentuan ini sewaktu-waktu.
      </div>
    </div>
  );
}

// ── Konten Kebijakan Pengembalian ─────────────────────────────────────────────
function RefundContent() {
  return (
    <div className="space-y-5 text-sm text-muted-foreground leading-relaxed">
      <p className="text-foreground font-medium">
        Harap baca kebijakan pengembalian dana kami dengan seksama sebelum
        melakukan transaksi.
      </p>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">1</span>
          Produk Digital
        </h3>
        <p className="pl-8">
          Seluruh produk yang dijual di RyuiiCharge adalah produk digital yang
          bersifat{" "}
          <span className="text-foreground font-medium">Final (sekali pakai)</span>
          . Setiap pembelian tidak dapat diubah setelah diproses.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">2</span>
          Tidak Ada Pembatalan
        </h3>
        <p className="pl-8">
          Setelah pembayaran berhasil dikonfirmasi dan produk telah dikirimkan
          ke akun tujuan, transaksi{" "}
          <span className="text-foreground font-medium">
            tidak dapat dibatalkan atau dikembalikan (Refund)
          </span>{" "}
          dengan alasan apa pun.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">3</span>
          Kondisi Refund
        </h3>
        <p className="pl-8 mb-2">
          Pengembalian dana hanya dapat dilakukan jika:
        </p>
        <ul className="pl-8 space-y-1 list-none">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            Stok produk sedang kosong / terjadi gangguan layanan provider.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            Terjadi kegagalan sistem pada sisi RyuiiCharge yang menyebabkan
            produk tidak dapat terkirim dalam waktu 1×24 jam.
          </li>
        </ul>
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">4</span>
          Proses Refund
        </h3>
        <p className="pl-8">
          Refund akan diproses kembali ke saldo akun atau melalui metode
          pembayaran asal (tergantung ketentuan teknis) dalam waktu{" "}
          <span className="text-foreground font-medium">1–3 hari kerja</span>.
        </p>
      </div>

      <div className="space-y-1">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0">5</span>
          Kesalahan User ID
        </h3>
        <p className="pl-8">
          <span className="text-foreground font-medium">
            Tidak ada refund
          </span>{" "}
          untuk kesalahan input User ID atau Server oleh pembeli. Pastikan data
          yang dimasukkan sudah benar sebelum melakukan pembayaran.
        </p>
      </div>

      <div className="mt-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
        ⚠️ Untuk mengajukan klaim refund, hubungi tim kami melalui WhatsApp
        atau Telegram dengan menyertakan Invoice ID transaksi Anda.
      </div>
    </div>
  );
}

// ── Footer utama ─────────────────────────────────────────────────────────────
const Footer = () => {
  const [openDialog, setOpenDialog] = useState<"terms" | "refund" | null>(null);

  return (
    <>
      <footer className="border-t border-border/30 bg-card/30 mt-16">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="font-display font-bold neon-text text-foreground">RyuiiCharge</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Platform top up game terpercaya dengan proses otomatis dan harga termurah.
              </p>
            </div>

            <div>
              <h4 className="font-display font-semibold mb-4 text-sm">Produk</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="hover:text-primary transition-colors">Game Mobile</Link></li>
                <li><Link to="/" className="hover:text-primary transition-colors">Game PC</Link></li>
                <li><Link to="/" className="hover:text-primary transition-colors">Voucher Digital</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display font-semibold mb-4 text-sm">Bantuan</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/cek-transaksi" className="hover:text-primary transition-colors">
                    Cek Transaksi
                  </Link>
                </li>
                <li>
                  <span className="hover:text-primary transition-colors cursor-pointer">FAQ</span>
                </li>
                <li>
                  <a
                    href="https://wa.me/6285124631039"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                  >
                    Hubungi Kami
                  </a>
                </li>
                <li>
                  <a
                    href="https://t.me/RyuiiCharge"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors"
                  >
                    Hubungi dengan Telegram
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => setOpenDialog("refund")}
                    className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5 text-left"
                  >
                    <RefreshCcw className="h-3 w-3 shrink-0" />
                    Kebijakan Pengembalian
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setOpenDialog("terms")}
                    className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5 text-left"
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    Syarat &amp; Ketentuan
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-display font-semibold mb-4 text-sm">Metode Pembayaran</h4>
              <div className="grid grid-cols-3 gap-2">
                {["QRIS", "OVO", "DANA", "GoPay", "BCA", "BNI"].map((m) => (
                  <div key={m} className="glass-card px-2 py-1 text-center">
                    <span className="text-xs text-muted-foreground">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © 2025 RyuiiCharge. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Transaksi dilindungi dengan enkripsi SSL 256-bit
            </p>
          </div>
        </div>
      </footer>

      {/* Dialog Syarat & Ketentuan */}
      <Dialog open={openDialog === "terms"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              Syarat &amp; Ketentuan Layanan RyuiiCharge
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <TermsContent />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog Kebijakan Pengembalian */}
      <Dialog open={openDialog === "refund"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <RefreshCcw className="h-5 w-5 text-primary shrink-0" />
              Kebijakan Pengembalian Dana &amp; Pembatalan
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <RefundContent />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Footer;
