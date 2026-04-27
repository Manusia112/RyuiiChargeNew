import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, ShoppingCart, Loader2, CheckCircle, XCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DenominationCard from "@/components/DenominationCard";
import { getGameBySlug, type GameDenomination } from "@/data/games";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { API, edgeHeaders } from "@/lib/api";

const formatPrice = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

type InputTemplate = "SINGLE_ID" | "USERNAME" | "MLBB" | "HOYOVERSE" | "KURO" | "RIOT";

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  platform: string | null;
  input_template: InputTemplate | null;
}

// ── Server option lists ────────────────────────────────────────────────────
const HOYO_SERVER_OPTIONS = [
  { label: "Asia",     value: "os_asia" },
  { label: "America",  value: "os_us"   },
  { label: "Europe",   value: "os_euro" },
  { label: "TW/HK/MO", value: "os_cht" },
];

const KURO_SERVER_OPTIONS = [
  { label: "Asia",    value: "asia"    },
  { label: "America", value: "america" },
  { label: "Europe",  value: "europe"  },
  { label: "HMT",     value: "hmt"     },
  { label: "SEA",     value: "sea"     },
];

// ── Slug-based fallback when input_template is null on older categories ────
function deriveInputTemplate(slug: string): InputTemplate {
  const s = slug.toLowerCase();
  if (s.includes("mobile-legends") || s.includes("mlbb")) return "MLBB";
  if (
    s.includes("genshin") || s.includes("honkai") ||
    s.includes("hsr")     || s.includes("zzz")    || s.includes("hi3")
  ) return "HOYOVERSE";
  if (s.includes("wuthering") || s.includes("pgr") || s.includes("kuro")) return "KURO";
  if (s.includes("valorant")  || s.includes("riot")) return "RIOT";
  if (s.includes("roblox")) return "USERNAME";
  return "SINGLE_ID";
}

const GameDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const mockGame = getGameBySlug(slug || "");

  const [loadingHeader, setLoadingHeader] = useState(false);
  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null);
  const [loadingDenoms, setLoadingDenoms] = useState(false);
  const [dbDenominations, setDbDenominations] = useState<GameDenomination[] | null>(null);
  const [selectedDenom, setSelectedDenom] = useState<GameDenomination | null>(null);

  // ── Input state per template ──────────────────────────────────────────────
  const [userId,   setUserId]   = useState("");   // MLBB: User ID
  const [zoneId,   setZoneId]   = useState("");   // MLBB: Zone ID
  const [uid,      setUid]      = useState("");   // HOYOVERSE / KURO: UID
  const [hoyoServer, setHoyoServer] = useState(HOYO_SERVER_OPTIONS[0].value);
  const [kuroServer, setKuroServer] = useState(KURO_SERVER_OPTIONS[0].value);
  const [playerId, setPlayerId] = useState("");   // SINGLE_ID
  const [riotId,   setRiotId]   = useState("");   // RIOT: Riot ID
  const [tagline,  setTagline]  = useState("");   // RIOT: Tagline
  const [username, setUsername] = useState("");   // USERNAME

  const [checkingNickname, setCheckingNickname] = useState(false);
  const [verifiedNickname, setVerifiedNickname] = useState<string | null>(null);
  const [nicknameError,    setNicknameError]    = useState<string | null>(null);

  const resetNickname = () => {
    setVerifiedNickname(null);
    setNicknameError(null);
  };

  useEffect(() => {
    if (!slug) return;

    if (supabaseConfigured && supabase) {
      setLoadingHeader(true);
      supabase
        .from("categories")
        .select("id, name, slug, image_url, platform, input_template")
        .eq("slug", slug)
        .maybeSingle()
        .then(({ data, error }) => {
          setLoadingHeader(false);
          if (error) { console.error("Gagal memuat kategori:", error); return; }
          if (data) setCategoryInfo(data as CategoryInfo);
        });

      setLoadingDenoms(true);
      supabase
        .from("products")
        .select("id, name, slug, selling_price, cost_price")
        .eq("game_category", slug)
        .eq("is_active", true)
        .order("selling_price", { ascending: true })
        .then(({ data, error }) => {
          setLoadingDenoms(false);
          if (error) { console.error("Gagal memuat produk denominasi:", error); return; }
          if (data && data.length > 0) {
            const mapped: GameDenomination[] = data.map((row) => ({
              id:     row.slug,
              label:  row.name,
              amount: 0,
              price:  row.selling_price ?? row.cost_price ?? 0,
            }));
            setDbDenominations(mapped);
          }
        });
    }
  }, [slug]);

  // Resolved template: DB value takes priority, slug fallback for legacy entries
  const inputTemplate: InputTemplate =
    categoryInfo?.input_template ?? deriveInputTemplate(slug ?? "");

  // ── Customer number concatenation (Digiflazz format) ─────────────────────
  const computeCustomerNo = (): string => {
    switch (inputTemplate) {
      case "MLBB":      return `${userId.trim()}${zoneId.trim()}`;
      case "HOYOVERSE": return `${uid.trim()}${hoyoServer}`;
      case "KURO":      return `${uid.trim()}${kuroServer}`;
      case "RIOT":      return `${riotId.trim()}#${tagline.trim()}`;
      case "USERNAME":  return username.trim();
      case "SINGLE_ID":
      default:          return playerId.trim();
    }
  };

  const isInputReady = (): boolean => {
    switch (inputTemplate) {
      case "MLBB":      return !!userId.trim() && !!zoneId.trim();
      case "HOYOVERSE": return !!uid.trim() && !!hoyoServer;
      case "KURO":      return !!uid.trim() && !!kuroServer;
      case "RIOT":      return !!riotId.trim() && !!tagline.trim();
      case "USERNAME":  return !!username.trim();
      case "SINGLE_ID":
      default:          return !!playerId.trim();
    }
  };

  const getIdForValidation = (): string => {
    switch (inputTemplate) {
      case "MLBB":      return userId.trim();
      case "HOYOVERSE": return uid.trim();
      case "KURO":      return uid.trim();
      case "RIOT":      return riotId.trim() && tagline.trim() ? `${riotId.trim()}#${tagline.trim()}` : riotId.trim();
      case "USERNAME":  return username.trim();
      case "SINGLE_ID":
      default:          return playerId.trim();
    }
  };

  const getZoneForValidation = (): string => {
    switch (inputTemplate) {
      case "MLBB":      return zoneId.trim();
      default:          return "";
    }
  };

  const handleCheckNickname = async () => {
    if (!isInputReady()) return;
    setCheckingNickname(true);
    setVerifiedNickname(null);
    setNicknameError(null);

    const idToSend   = getIdForValidation();
    const zoneToSend = getZoneForValidation();

    try {
      const res = await fetch(API.checkNickname, {
        method: "POST",
        headers: edgeHeaders(),
        body: JSON.stringify({
          game_slug: slug,
          user_id:   idToSend,
          zone_id:   zoneToSend,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("check-nickname HTTP error:", res.status, text);
        setNicknameError("Gagal menghubungi server. Coba lagi.");
        return;
      }

      const json = await res.json() as { success?: boolean; name?: string; error?: string };

      if (json.success && json.name === "Tanpa Validasi (Lanjutkan)") {
        setVerifiedNickname("Tanpa Validasi (Lanjutkan)");
      } else if (json.success && json.name) {
        setVerifiedNickname(json.name);
      } else {
        setNicknameError(json.error ?? "ID tidak ditemukan. Periksa kembali.");
      }
    } catch {
      setNicknameError("Gagal menghubungi server. Coba lagi.");
    } finally {
      setCheckingNickname(false);
    }
  };

  const gameName       = categoryInfo?.name     ?? mockGame?.name ?? (slug ? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "");
  const gameBanner     = categoryInfo?.image_url ?? mockGame?.banner ?? null;
  const gamePlatform   = categoryInfo?.platform  ?? (mockGame?.category === "mobile" ? "Mobile" : mockGame?.category === "pc" ? "PC" : null);
  const gameDescription = mockGame?.description  ?? null;
  const denominations  = dbDenominations ?? (mockGame?.denominations ?? []);

  const isLoading  = loadingHeader || loadingDenoms;
  const hasData    = categoryInfo !== null || mockGame !== undefined;
  const notFound   = !isLoading && !hasData && dbDenominations === null;

  const canCheckout = !!(selectedDenom && isInputReady());

  const handleCheckout = () => {
    if (!canCheckout) return;
    const params = new URLSearchParams({
      game:        slug ?? "",
      denom:       selectedDenom!.id,
      gameName,
      denomLabel:  selectedDenom!.label,
      denomPrice:  String(selectedDenom!.price),
      playerId:    computeCustomerNo(),
      serverId:    inputTemplate === "MLBB" ? zoneId : "",
      nickname:    verifiedNickname ?? "",
    });
    navigate(`/checkout?${params.toString()}`);
  };

  // ── Input field renderer ──────────────────────────────────────────────────
  const renderInputFields = () => {
    switch (inputTemplate) {

      case "MLBB":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">User ID</Label>
                <Input
                  placeholder="Contoh: 123456789"
                  value={userId}
                  onChange={(e) => { setUserId(e.target.value); resetNickname(); }}
                  className="bg-muted/50 border-border/50"
                  data-testid="input-user-id"
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">Zone ID</Label>
                <Input
                  placeholder="Contoh: 1234"
                  value={zoneId}
                  onChange={(e) => { setZoneId(e.target.value); resetNickname(); }}
                  className="bg-muted/50 border-border/50"
                  data-testid="input-zone-id"
                />
              </div>
            </div>
          </div>
        );

      case "HOYOVERSE":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">UID</Label>
                <Input
                  placeholder="Contoh: 800123456"
                  value={uid}
                  onChange={(e) => { setUid(e.target.value); resetNickname(); }}
                  className="bg-muted/50 border-border/50"
                  data-testid="input-uid"
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">Server</Label>
                <select
                  value={hoyoServer}
                  onChange={(e) => { setHoyoServer(e.target.value); resetNickname(); }}
                  className="w-full bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary h-10"
                  data-testid="select-server"
                >
                  {HOYO_SERVER_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      case "KURO":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">UID</Label>
                <Input
                  placeholder="Contoh: 200123456"
                  value={uid}
                  onChange={(e) => { setUid(e.target.value); resetNickname(); }}
                  className="bg-muted/50 border-border/50"
                  data-testid="input-uid"
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">Server</Label>
                <select
                  value={kuroServer}
                  onChange={(e) => { setKuroServer(e.target.value); resetNickname(); }}
                  className="w-full bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary h-10"
                  data-testid="select-server-kuro"
                >
                  {KURO_SERVER_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      case "RIOT":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">Riot ID</Label>
                <Input
                  placeholder="Contoh: RyuiiGamer"
                  value={riotId}
                  onChange={(e) => { setRiotId(e.target.value); resetNickname(); }}
                  className="bg-muted/50 border-border/50"
                  data-testid="input-riot-id"
                />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-1 block">
                  Tagline{" "}
                  <span className="text-xs text-muted-foreground/70">(Tanpa tanda #)</span>
                </Label>
                <Input
                  placeholder="Contoh: 1234"
                  value={tagline}
                  onChange={(e) => { setTagline(e.target.value); resetNickname(); }}
                  className="bg-muted/50 border-border/50"
                  data-testid="input-tagline"
                />
              </div>
            </div>
          </div>
        );

      case "USERNAME":
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Username</Label>
              <Input
                placeholder="Masukkan Username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); resetNickname(); }}
                className="bg-muted/50 border-border/50"
                data-testid="input-username"
              />
            </div>
            <p className="text-xs text-amber-400">
              ⚠️ Masukkan Username asli untuk login, BUKAN Display Name
            </p>
          </div>
        );

      case "SINGLE_ID":
      default:
        return (
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground mb-1 block">Player ID</Label>
              <Input
                placeholder="Masukkan Player ID"
                value={playerId}
                onChange={(e) => { setPlayerId(e.target.value); resetNickname(); }}
                className="bg-muted/50 border-border/50"
                data-testid="input-player-id"
              />
            </div>
          </div>
        );
    }
  };

  if (!slug) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl font-bold mb-4">Game Tidak Ditemukan</h1>
          <Button variant="outline" onClick={() => navigate("/")} className="btn-neon">Kembali ke Beranda</Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading && !hasData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center items-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl font-bold mb-4">Game Tidak Ditemukan</h1>
          <Button variant="outline" onClick={() => navigate("/")} className="btn-neon">Kembali ke Beranda</Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="relative h-40 md:h-56 overflow-hidden">
        {gameBanner ? (
          <img src={gameBanner} alt={gameName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted/30" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, hsl(var(--background)), hsl(var(--background) / 0.6), transparent)" }} />
      </div>

      <div className="container mx-auto px-4 -mt-12 relative z-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </button>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <div>
              {gamePlatform && (
                <span className="inline-block text-xs font-medium text-primary glass-card px-2 py-1 mb-2 capitalize">
                  {gamePlatform}
                </span>
              )}
              <h1 className="font-display text-2xl md:text-3xl font-bold" data-testid="text-game-name">{gameName}</h1>
              {gameDescription && <p className="text-muted-foreground mt-1">{gameDescription}</p>}
            </div>

            <div>
              <h2 className="font-display font-semibold text-lg mb-3">Pilih Nominal</h2>
              {loadingDenoms ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : denominations.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada nominal tersedia.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {denominations.map((d) => (
                    <DenominationCard
                      key={d.id}
                      denomination={d}
                      selected={selectedDenom?.id === d.id}
                      onSelect={setSelectedDenom}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="font-display font-semibold text-lg mb-3">Data Akun</h2>
              <div className="space-y-4">
                {renderInputFields()}

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckNickname}
                    disabled={!isInputReady() || checkingNickname}
                    className="border-primary/50 text-primary hover:bg-primary/10 gap-2"
                    data-testid="button-check-nickname"
                  >
                    {checkingNickname ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Mengecek...</>
                    ) : (
                      <><Search className="h-3.5 w-3.5" />Cek Nickname</>
                    )}
                  </Button>
                </div>

                {verifiedNickname && (
                  <div className="flex items-center gap-2 text-sm" data-testid="text-nickname-found">
                    <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--success))" }} />
                    <span className="text-muted-foreground">Nickname:</span>
                    <span className="font-semibold" style={{ color: "hsl(var(--success))" }}>{verifiedNickname}</span>
                  </div>
                )}

                {nicknameError && (
                  <div className="flex items-center gap-2 text-sm" data-testid="text-nickname-error">
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    <span className="text-destructive">{nicknameError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="glass-card p-5 space-y-4 sticky top-24">
              <h3 className="font-display font-semibold text-lg">Ringkasan</h3>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Game</span>
                  <span className="font-medium text-right">{gameName}</span>
                </div>
                {selectedDenom && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Item</span>
                      <span className="font-medium">{selectedDenom.label}</span>
                    </div>
                    <div className="flex justify-between border-t border-border/30 pt-2">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-bold text-primary">{formatPrice(selectedDenom.price)}</span>
                    </div>
                  </>
                )}
                {!selectedDenom && (
                  <p className="text-muted-foreground text-xs">Pilih nominal terlebih dahulu</p>
                )}
                {verifiedNickname && (
                  <div className="flex justify-between border-t border-border/30 pt-2">
                    <span className="text-muted-foreground">Akun</span>
                    <span className="font-semibold text-xs text-right" style={{ color: "hsl(var(--success))" }}>
                      ✓ {verifiedNickname}
                    </span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleCheckout}
                disabled={!canCheckout}
                className="w-full btn-neon gradient-primary text-white gap-2"
                data-testid="button-checkout"
              >
                <ShoppingCart className="h-4 w-4" />
                Beli Sekarang
              </Button>

              {!canCheckout && (
                <p className="text-xs text-muted-foreground text-center">
                  {!selectedDenom ? "Pilih nominal" : "Lengkapi data akun"}
                </p>
              )}

              <div className="border-t border-border/30 pt-3 space-y-2">
                {["Proses Otomatis", "Harga Termurah", "100% Aman"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "hsl(var(--success))" }}></span>
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default GameDetail;
