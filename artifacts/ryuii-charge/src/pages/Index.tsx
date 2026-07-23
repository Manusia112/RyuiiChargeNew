import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Search, Loader2, Smartphone, Monitor } from "lucide-react";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CategoryGrid from "@/components/CategoryGrid";
import TransactionTicker from "@/components/TransactionTicker";
import { games } from "@/data/games";
import { supabase, supabaseConfigured } from "@/lib/supabase";

interface CategoryItem {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  platform: string | null;
}

const platformIcons: Record<string, typeof Smartphone> = {
  Mobile: Smartphone,
  PC: Monitor,
};

const Index = () => {
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<CategoryItem[] | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;

    setLoadingCategories(true);
    supabase
      .from("categories")
      .select("id, slug, name, image_url, platform")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        setLoadingCategories(false);
        if (error) {
          console.error("Gagal memuat kategori dari Supabase:", error);
          return;
        }
        if (data && data.length > 0) {
          setCategories(data as CategoryItem[]);
        }
      });
  }, []);

  const fallbackGames = games.map((g) => ({
    id: g.slug,
    slug: g.slug,
    name: g.name,
    image_url: g.image,
    platform: "Mobile",
  }));

  const displayCategories: CategoryItem[] = categories ?? fallbackGames;

  const filteredCategories = search
    ? displayCategories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : displayCategories;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section id="main-content" className="container mx-auto px-4 pt-20 pb-12 md:pt-28 md:pb-20">
        <div className="flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-center md:text-left space-y-5 opacity-0 animate-fade-in-up">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground tracking-tight">
              Top Up Game
              <br />
              <span className="gradient-text">Instant Delivery</span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-md leading-relaxed">
              Diamond, UC, Coins — proses otomatis 24/7 dengan harga terbaik. 
              Bayar pakai QRIS, Virtual Account, atau E-Wallet.
            </p>
            <div className="relative max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Cari game..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 text-base bg-muted/50 border-border/50 rounded-xl focus:border-primary"
                data-testid="input-search-hero"
              />
            </div>
          </div>

          <div className="hidden md:block relative w-80 h-80 shrink-0 opacity-0 animate-fade-in stagger-2">
            <div className="hero-blob absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="grid grid-cols-3 gap-3">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="w-16 h-16 rounded-xl bg-card border border-border/60 flex items-center justify-center opacity-0 animate-scale-in"
                    style={{ animationDelay: `${0.3 + i * 0.06}s` }}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary/40" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <TransactionTicker />

      <div className="container mx-auto px-4">
        <CategoryGrid />

        <section className="py-8 md:py-12 opacity-0 animate-fade-in-up stagger-3">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold">Featured Games</h2>
              <p className="text-muted-foreground text-sm mt-1">Pilih game favoritmu</p>
            </div>
            {search && (
              <p className="text-sm text-muted-foreground">{filteredCategories.length} hasil untuk "{search}"</p>
            )}
          </div>

          {loadingCategories ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredCategories.map((cat, i) => {
                const PlatformIcon = platformIcons[cat.platform ?? ""] || null;
                return (
                  <Link
                    key={cat.slug}
                    to={`/game/${cat.slug}`}
                    className="game-card group cursor-pointer block opacity-0 animate-fade-in-up"
                    style={{ animationDelay: `${0.4 + i * 0.05}s` }}
                    data-testid={`card-game-${cat.slug}`}
                  >
                    <div className="aspect-[4/3] overflow-hidden rounded-t-[calc(var(--radius)-1px)]">
                      <img
                        src={cat.image_url || ""}
                        alt={cat.name}
                        loading={i < 4 ? "eager" : "lazy"}
                        fetchPriority={i < 2 ? "high" : "low"}
                        width="400"
                        height="300"
                        decoding="async"
                        className="w-full h-full object-contain bg-muted/30 group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          const el = e.target as HTMLImageElement;
                          el.style.display = "none";
                          const fb = el.parentElement?.querySelector(".img-fallback");
                          if (fb) fb.classList.remove("hidden");
                        }}
                      />
                      <div className="w-full h-full bg-muted/30 flex items-center justify-center img-fallback hidden">
                        <span className="text-3xl font-bold text-muted-foreground/20">
                          {cat.name.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-sm leading-tight line-clamp-2">{cat.name}</p>
                          {cat.platform && (
                            <div className="flex items-center gap-1 mt-1.5">
                              {PlatformIcon && <PlatformIcon className="h-3 w-3 text-muted-foreground" />}
                              <span className="text-xs text-muted-foreground capitalize">{cat.platform}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
