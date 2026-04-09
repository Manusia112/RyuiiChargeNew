import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const AdminGuard = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // Jangan redirect selama loading — tunggu sampai sesi Supabase selesai dipulihkan
    if (loading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    if (!isAdmin) {
      navigate("/");
    }
  }, [loading, user, isAdmin, navigate]);

  // Tampilkan spinner selama auth masih diinisialisasi
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Selama menunggu redirect (user null atau bukan admin), tampilkan kosong
  if (!user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
};

export default AdminGuard;
