import { useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getGameBySlug } from "@/data/games";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { API, edgeHeaders } from "@/lib/api";

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

const formatPrice = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const Checkout = () => {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);

  const gameSlug      = params.get("game") ?? "";
  const denomId       = params.get("denom") ?? "";
  const playerId      = params.get("playerId") ?? "";
  const serverId      = params.get("serverId") ?? "";
  const nickname      = params.get("nickname") ?? "";

  const gameNameParam   = params.get("gameName") ?? "";
  const denomLabelParam = params.get("denomLabel") ?? "";
  const denomPriceParam = Number(params.get("denomPrice") ?? "0");

  const staticGame  = getGameBySlug(gameSlug);
  const staticDenom = staticGame?.denominations.find((d) => d.id === denomId);

  const gameName   = gameNameParam  || staticGame?.name   || "";
  const denomLabel = denomLabelParam || staticDenom?.label || "";
  const denomPrice = denomPriceParam || staticDenom?.price || 0;

  const { user } = useAuth();

  const [creating, setCreating] = useState(false);

  const missingFields: string[] = [];
  if (!gameSlug)       missingFields.push("game");
  if (!denomId)        missingFields.push("produk");
  if (!playerId)       missingFields.push("player ID");
  if (!gameName)       missingFields.push("nama game");
  if (!denomLabel)     missingFields.push("label produk");
  if (denomPrice <= 0) missingFields.push("harga");

  if (missingFields.length > 0) {
    console.error("[Checkout] Data pesanan tidak valid — field yang hilang:", missingFields.join(", "), {
      gameSlug, denomId, playerId, gameNameParam, denomLabelParam, denomPriceParam,
    });
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold">Data pesanan tidak valid</h1>
          <p className="text-muted-foreground text-sm">
            Field yang hilang: <span className="text-destructive font-mono">{missingFields.join(", ")}</span>
          </p>
          <Link to="/">
            <Button variant="outline">Kembali ke Beranda</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const handleCreateInvoice = async () => {
    setCreating(true);

    // Resolve session — get both user UUID and access token for auth binding
    let resolvedUserId: string | undefined;
    let accessToken: string | undefined;
    let resolvedEmail: string | undefined = user?.email;

    if (supabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          resolvedUserId = session.user.id;
          accessToken    = session.access_token;
          resolvedEmail  = session.user.email ?? resolvedEmail;
        }
      } catch {
        // Non-critical — proceed as guest
      }
    }

    const payload: Record<string, unknown> = {
      product_id:         denomId,
      player_id:          playerId,
      zone_id:            serverId || undefined,
      denomination_label: denomLabel,
      denomination_price: denomPrice,
      game_slug:          gameSlug,
      nickname:           nickname || undefined,
      customer_email:     resolvedEmail,
      // Always send user_id + email in body as explicit binding
      ...(resolvedUserId ? { user_id: resolvedUserId } : {}),
    };

    console.log("[Checkout] Sending payload to create-order:", { ...payload, user_id: resolvedUserId ? "***" : "guest" });

    // Build headers: include user JWT if available so backend can verify server-side
    const headers: Record<string, string> = {
      ...edgeHeaders(),
      ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
    };

    try {
      const response = await fetch(API.checkout, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json() as {
        success?: boolean;
        token?: string;
        invoiceId?: string;
        message?: string;
        error?: string;
      };

      console.log("[Checkout] create-order response:", response.status, result);

      if (result.success === false || !response.ok) {
        const errMsg = result.message ?? result.error ?? `Server error (HTTP ${response.status})`;
        console.error("[Checkout] checkout failed:", errMsg);
        toast.error(errMsg);
        setCreating(false);
        return;
      }

      if (result.success === true && result.token) {
        setCreating(false);
        const orderId = result.invoiceId ?? "";
        const statusUrl = orderId
          ? `/payment/success?order_id=${encodeURIComponent(orderId)}`
          : "/payment/success";
        const failedUrl = orderId
          ? `/payment/failed?order_id=${encodeURIComponent(orderId)}`
          : "/payment/failed";
        console.log("[Checkout] Opening Midtrans Snap popup for invoice:", orderId);
        window.snap.pay(result.token, {
          onSuccess: () => {
            navigate(statusUrl);
          },
          onPending: () => {
            toast.info("Pembayaran sedang diproses. Cek status di halaman transaksi.");
            navigate(statusUrl);
          },
          onError: () => {
            toast.error("Pembayaran gagal. Silakan coba lagi.");
            navigate(failedUrl);
          },
          onClose: () => {
            toast.info("Popup ditutup. Klik Bayar Sekarang untuk melanjutkan.");
          },
        });
        return;
      }

      setCreating(false);
    } catch (err) {
      console.error("[Checkout] Network error during create-order:", err);
      toast.error("Gagal menghubungi server, coba lagi");
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>

        <h1 className="font-display text-2xl font-bold mb-6">Checkout</h1>

        <div className="space-y-4">
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-display font-semibold">Detail Pesanan</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Game</span>
                <span className="font-medium">{gameName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item</span>
                <span className="font-medium">{denomLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Player ID</span>
                <span className="font-mono text-sm">{playerId}</span>
              </div>
              {serverId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zone / Server</span>
                  <span className="font-mono text-sm">{serverId}</span>
                </div>
              )}
              {nickname && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nickname</span>
                  <span className="font-medium" style={{ color: "hsl(var(--success))" }}>✓ {nickname}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/30 pt-2">
                <span className="text-muted-foreground font-semibold">Total</span>
                <span className="font-bold text-primary text-lg">{formatPrice(denomPrice)}</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleCreateInvoice}
            disabled={creating}
            className="w-full btn-neon gradient-primary text-white h-12"
            data-testid="button-create-invoice"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Membuat Invoice...
              </>
            ) : (
              "Bayar Sekarang"
            )}
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Checkout;
