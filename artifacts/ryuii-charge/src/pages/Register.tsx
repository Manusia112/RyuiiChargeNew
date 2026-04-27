import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Zap, Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabaseConfigured } from "@/lib/supabase";
import { validateEmail } from "@/lib/emailValidation";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileFailed, setTurnstileFailed] = useState(false);
  const [, navigate] = useLocation();
  const { signUp, signInWithGoogle } = useAuth();
  const turnstileRef = useRef<{ reset: () => void } | null>(null);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (emailError) setEmailError("");
  };

  const handleEmailBlur = () => {
    if (!email) return;
    const result = validateEmail(email);
    if (!result.valid) setEmailError(result.error ?? "");
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      toast.error("Nama tidak boleh kosong");
      return;
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setEmailError(emailCheck.error ?? "Format email tidak valid");
      return;
    }

    if (password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }

    // Verifikasi Turnstile (hanya jika site key dikonfigurasi DAN widget berhasil dimuat)
    if (TURNSTILE_SITE_KEY && !turnstileFailed) {
      if (!turnstileToken) {
        toast.error("Selesaikan verifikasi CAPTCHA terlebih dahulu");
        return;
      }

      try {
        const apiUrl = API_BASE
          ? `${window.location.origin}${API_BASE}/api/verify-turnstile`
          : "/api/verify-turnstile";

        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const data = await res.json() as { success: boolean; error?: string };
        if (!data.success) {
          toast.error(data.error ?? "Verifikasi CAPTCHA gagal. Coba lagi.");
          turnstileRef.current?.reset();
          setTurnstileToken(null);
          return;
        }
      } catch {
        // Jika server verifikasi tidak bisa dihubungi, lanjutkan saja (graceful fallback)
      }
    }

    setLoading(true);
    const result = await signUp(email.trim().toLowerCase(), password, name.trim());
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } else if (result.needsVerification) {
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } else {
      toast.success("Akun berhasil dibuat!");
      navigate("/");
    }
  };

  const handleGoogleRegister = async () => {
    setGoogleLoading(true);
    await signInWithGoogle();
    setGoogleLoading(false);
  };

  // Tombol aktif jika: tidak pakai Turnstile, ATAU Turnstile gagal load (fallback), ATAU token sudah didapat
  const canSubmit = !!(name && email && password && !emailError && (!TURNSTILE_SITE_KEY || turnstileFailed || turnstileToken));

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
          <h1 className="font-display text-2xl font-bold">Daftar Akun</h1>
          <p className="text-muted-foreground text-sm mt-1">Bergabung dan nikmati top up lebih mudah</p>
        </div>

        <div className="glass-card p-6 space-y-4">
          {supabaseConfigured && (
            <>
              <Button
                variant="outline"
                onClick={handleGoogleRegister}
                disabled={googleLoading}
                className="w-full gap-3 border-border/50 hover:bg-muted/50"
                data-testid="button-google-register"
              >
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Daftar dengan Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground font-medium tracking-widest">atau</span>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nama</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nama kamu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-9 bg-muted/50 border-border/50"
                data-testid="input-name"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="nama@gmail.com"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                className={`pl-9 bg-muted/50 border-border/50 ${emailError ? "border-red-500 focus:border-red-500" : ""}`}
                data-testid="input-email"
              />
            </div>
            {emailError && (
              <div className="flex items-start gap-1.5 mt-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">{emailError}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Gunakan email aktif dari Gmail, Yahoo, Outlook, iCloud, dll.
            </p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Min. 8 karakter"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                className="pl-9 pr-9 bg-muted/50 border-border/50"
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Cloudflare Turnstile CAPTCHA — hanya muncul jika site key terkonfigurasi dan belum error */}
          {TURNSTILE_SITE_KEY && !turnstileFailed && (
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                onError={() => {
                  // Jika Turnstile gagal load (misal domain belum terdaftar di Cloudflare),
                  // aktifkan fallback diam-diam agar pengguna asli tetap bisa mendaftar
                  setTurnstileToken(null);
                  setTurnstileFailed(true);
                }}
                options={{
                  theme: "dark",
                  language: "id",
                }}
              />
            </div>
          )}

          {supabaseConfigured && (
            <p className="text-xs text-muted-foreground">
              Setelah mendaftar, kami akan mengirim email verifikasi. Pastikan kamu verifikasi sebelum login.
            </p>
          )}

          <Button
            onClick={handleRegister}
            disabled={!canSubmit || loading}
            className="w-full btn-neon gradient-primary text-white"
            data-testid="button-submit-register"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Daftar Sekarang
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
