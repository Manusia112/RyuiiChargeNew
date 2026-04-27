import { useState } from "react";
import { Link } from "wouter";
import { Zap, Mail, RefreshCw, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const EmailVerification = () => {
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const { resendVerification } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") ?? "";

  const handleResend = async () => {
    if (!email) {
      toast.error("Email tidak ditemukan. Silakan daftar ulang.");
      return;
    }
    setResending(true);
    const result = await resendVerification(email);
    setResending(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      setSent(true);
      toast.success("Email verifikasi telah dikirim ulang!");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-2xl font-bold neon-text text-foreground">RyuiiCharge</span>
          </Link>
        </div>

        <div className="glass-card p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Mail className="h-10 w-10 text-primary" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-2xl font-bold">Cek Emailmu!</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Kami telah mengirimkan link verifikasi ke
            </p>
            {email ? (
              <p className="font-semibold text-primary text-sm break-all px-2">{email}</p>
            ) : null}
            <p className="text-muted-foreground text-sm leading-relaxed">
              Klik link di email tersebut untuk mengaktifkan akun RyuiiCharge-mu.
            </p>
          </div>

          <div className="space-y-3">
            {sent ? (
              <div className="flex items-center justify-center gap-2 text-sm py-2"
                style={{ color: "hsl(var(--success))" }}>
                <CheckCircle className="h-4 w-4" />
                Email verifikasi terkirim!
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={resending || !email}
                className="w-full gap-2 border-primary/50 text-primary hover:bg-primary/10"
                data-testid="button-resend-verification"
              >
                {resending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Kirim Ulang Email Verifikasi
              </Button>
            )}

            <Link to="/login">
              <Button variant="ghost" className="w-full gap-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Halaman Masuk
              </Button>
            </Link>
          </div>

          <div className="border-t border-border/30 pt-4 space-y-1">
            <p className="text-xs text-muted-foreground">Tidak menerima email? Periksa folder spam/junk.</p>
            <p className="text-xs text-muted-foreground">Link verifikasi berlaku selama 24 jam.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
