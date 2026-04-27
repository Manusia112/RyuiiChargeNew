import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Zap, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabaseConfigured } from "@/lib/supabase";
import { validateEmail } from "@/lib/emailValidation";

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [notVerified, setNotVerified] = useState(false);
  const [, navigate] = useLocation();
  const { signIn, signInWithGoogle, resendVerification } = useAuth();

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setNotVerified(false);
    if (emailError) setEmailError("");
  };

  const handleEmailBlur = () => {
    if (!email) return;
    const result = validateEmail(email);
    if (!result.valid) setEmailError(result.error ?? "");
  };

  const handleLogin = async () => {
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setEmailError(emailCheck.error ?? "Format email tidak valid");
      return;
    }

    if (!password) return;

    setLoading(true);
    setNotVerified(false);
    const result = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);

    if (result.error) {
      if (result.code === "EMAIL_NOT_CONFIRMED") {
        setNotVerified(true);
      } else {
        toast.error(result.error);
      }
    } else {
      toast.success("Berhasil masuk!");
      navigate("/");
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    await signInWithGoogle();
    setGoogleLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    const result = await resendVerification(email);
    setResending(false);
    if (result.error) {
      toast.error(result.error);
    } else {
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
          <h1 className="font-display text-2xl font-bold">Masuk</h1>
          <p className="text-muted-foreground text-sm mt-1">Masuk untuk melihat riwayat pesanan</p>
        </div>

        <div className="glass-card p-6 space-y-4">
          {!supabaseConfigured && (
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Akun demo (Supabase belum terkonfigurasi):</p>
              <p>Admin: admin@admin.com / admin123</p>
              <p>User: user@test.com / user123</p>
            </div>
          )}

          {notVerified && (
            <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-400 text-sm">Email Belum Diverifikasi</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Verifikasi emailmu sebelum bisa masuk. Cek kotak masuk atau folder spam.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={resending}
                className="w-full gap-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                data-testid="button-resend-from-login"
              >
                {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Kirim Ulang Email Verifikasi
              </Button>
            </div>
          )}

          {supabaseConfigured && (
            <>
              <Button
                variant="outline"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full gap-3 border-border/50 hover:bg-muted/50"
                data-testid="button-google-login"
              >
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Lanjutkan dengan Google
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
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="••••••••"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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

          <Button
            onClick={handleLogin}
            disabled={!email || !password || !!emailError || loading}
            className="w-full btn-neon gradient-primary text-white"
            data-testid="button-submit-login"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Masuk
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Daftar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
