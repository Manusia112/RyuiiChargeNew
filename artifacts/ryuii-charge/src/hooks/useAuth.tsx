import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; code?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error?: string; needsVerification?: boolean }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resendVerification: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const MOCK_USERS: Record<string, { password: string; name: string; role: string }> = {
  "admin@admin.com": { password: "admin123", name: "Admin RyuiiCharge", role: "admin" },
  "user@test.com": { password: "user123", name: "Test User", role: "user" },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // loading tetap true sampai sesi pertama kali diperiksa (termasuk fetchProfile selesai)
  const [loading, setLoading] = useState(supabaseConfigured);

  const mapSupabaseUser = (u: SupabaseUser): User => ({
    id: u.id,
    email: u.email ?? "",
    name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? u.user_metadata?.user_name,
  });

  const fetchProfile = useCallback(async (supabaseUser: SupabaseUser): Promise<boolean> => {
    if (!supabase) return false;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", supabaseUser.id)
        .single();
      const admin = data?.role === "admin";
      setIsAdmin(admin);
      return admin;
    } catch {
      setIsAdmin(false);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    // Flag untuk memastikan loading=false hanya dipanggil sekali (saat event pertama)
    let initialEventHandled = false;

    // PENTING: Jangan panggil getSession() secara terpisah!
    // getSession() dan onAuthStateChange keduanya mengakses localStorage token bersamaan,
    // menyebabkan error "Lock auth-token was released because another request stole it".
    // onAuthStateChange sudah mengeluarkan event INITIAL_SESSION saat pertama subscribe,
    // yang berisi sesi yang tersimpan — jadi getSession() tidak diperlukan.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Jalankan async dalam IIFE agar tidak memblokir callback onAuthStateChange
      (async () => {
        if (!mounted) return;

        if (session?.user) {
          setUser(mapSupabaseUser(session.user));
          // Fetch profile hanya untuk event pertama atau saat sign in — bukan token refresh
          if (event !== "TOKEN_REFRESHED") {
            await fetchProfile(session.user);
          }
        } else {
          setUser(null);
          setIsAdmin(false);
        }

        // Set loading false hanya setelah event pertama (INITIAL_SESSION) selesai diproses
        if (!initialEventHandled && mounted) {
          initialEventHandled = true;
          setLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    if (!supabaseConfigured || !supabase) {
      const found = MOCK_USERS[email.toLowerCase()];
      if (!found || found.password !== password) {
        return { error: "Email atau password salah" };
      }
      setUser({ id: `mock-${Date.now()}`, email, name: found.name });
      setIsAdmin(found.role === "admin");
      return {};
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (
        error.message.toLowerCase().includes("email not confirmed") ||
        error.message.toLowerCase().includes("email_not_confirmed")
      ) {
        return { error: "Email belum diverifikasi", code: "EMAIL_NOT_CONFIRMED" };
      }
      return { error: "Email atau password salah" };
    }
    return {};
  };

  const signUp = async (email: string, password: string, name?: string) => {
    if (!supabaseConfigured || !supabase) {
      if (MOCK_USERS[email.toLowerCase()]) return { error: "Email sudah terdaftar" };
      setUser({ id: `mock-${Date.now()}`, email, name });
      return {};
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name ?? "" } },
    });

    if (error) return { error: error.message };

    if (data.user && !data.user.confirmed_at && data.user.identities?.length) {
      return { needsVerification: true };
    }

    if (data.user && data.user.identities?.length === 0) {
      return { error: "Email sudah terdaftar" };
    }

    return {};
  };

  const signOut = async () => {
    // Reset state lokal dulu agar UI responsif segera
    setUser(null);
    setIsAdmin(false);
    // Kemudian panggil Supabase signOut untuk clear session di server + localStorage
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Abaikan error saat signOut — state lokal sudah di-reset
      }
    }
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const resendVerification = async (email: string) => {
    if (!supabase) return { error: "Supabase belum dikonfigurasi" };
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) return { error: error.message };
    return {};
  };

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, loading, signIn, signUp, signOut, signInWithGoogle, resendVerification }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
