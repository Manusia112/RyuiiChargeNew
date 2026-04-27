import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Search, Loader2 } from "lucide-react";
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

      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, hsl(217 91% 60% / 0.08), transparent)" }} />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 glass-card px-4 py-1.5 text-sm text-primary mb-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" style={{ backgroundColor: "hsl(var(--success))" }}></span>
              Proses Otomatis 24/7
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight text-foreground">
              Top Up Game{" "}
              <span className="bg-clip-text text-transparent gradient-primary">Instan & Murah</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Proses otomatis, harga termurah, dan terpercaya. Diamond, UC, Coins, dan masih banyak lagi!
            </p>
            <div className="relative max-w-md mx-auto">
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
        </div>
      </section>

      <TransactionTicker />

      <div className="container mx-auto px-4">
        <CategoryGrid />

        <section className="py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-2xl font-bold">Game Populer</h2>
            {search && (
              <p className="text-sm text-muted-foreground">{filteredCategories.length} hasil untuk "{search}"</p>
            )}
          </div>

          {loadingCategories ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/game/${cat.slug}`}
                  className="glass-card overflow-hidden hover:border-primary/50 transition-all duration-300 group cursor-pointer block"
                  data-testid={`card-game-${cat.slug}`}
                >
                  <div className="aspect-square overflow-hidden">
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                        <span className="text-2xl font-bold text-muted-foreground/30">
                          {cat.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-display font-semibold text-xs leading-tight line-clamp-2">{cat.name}</p>
                    {cat.platform && (
                      <p className="text-xs text-muted-foreground mt-1">{cat.platform}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Transaksi Berhasil", value: "2.5 Juta+" },
              { label: "Pengguna Aktif", value: "500 Ribu+" },
              { label: "Produk Tersedia", value: "1000+" },
              { label: "Uptime Layanan", value: "99.9%" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-5 text-center">
                <p className="font-display text-2xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
