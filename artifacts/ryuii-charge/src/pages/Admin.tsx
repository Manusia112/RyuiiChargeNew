import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3, DollarSign, ShoppingCart, TrendingUp, Settings,
  LogOut, Zap, Package, Upload, Save, Loader2, ImageIcon,
  ToggleLeft, ToggleRight, Plus, X, Trash2, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { games } from "@/data/games";
import { toast } from "sonner";
import { API, edgeHeaders } from "@/lib/api";

const formatPrice = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const toSlug = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface ProductItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  platform: string;
  pricing_mode: "manual" | "automatic";
  fixed_price: number;
  cost_price: number;
  markup_percent: number;
  digiflazz_sku: string | null;
  image_url: string | null;
  is_active: boolean;
  saving?: boolean;
  uploading?: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  platform: string | null;
  input_template: string | null;
  deleting?: boolean;
}

interface NewProductForm {
  name: string;
  slug: string;
  category: "game" | "voucher" | "ppob";
  game_category: string;
  platform: string;
  cost_price: number;
  markup_percent: number;
  pricing_mode: "manual" | "automatic";
  fixed_price: number;
  digiflazz_sku: string;
  is_active: boolean;
  saving: boolean;
}

interface NewCategoryForm {
  name: string;
  slug: string;
  platform: string;
  input_template: string;
  imageFile: File | null;
  imagePreview: string | null;
  saving: boolean;
}

const defaultMockProducts: ProductItem[] = games.map((g) => ({
  id: g.slug,
  slug: g.slug,
  name: g.name,
  category: g.category,
  platform: "Mobile",
  pricing_mode: "automatic",
  fixed_price: g.denominations[0]?.price ?? 0,
  cost_price: Math.round((g.denominations[0]?.price ?? 0) * 0.85),
  markup_percent: 15,
  digiflazz_sku: null,
  image_url: g.image,
  is_active: true,
}));

const EMPTY_NEW_PRODUCT: NewProductForm = {
  name: "",
  slug: "",
  category: "game",
  game_category: "",
  platform: "Mobile",
  cost_price: 0,
  markup_percent: 15,
  pricing_mode: "automatic",
  fixed_price: 0,
  digiflazz_sku: "",
  is_active: true,
  saving: false,
};

const EMPTY_NEW_CATEGORY: NewCategoryForm = {
  name: "",
  slug: "",
  platform: "Mobile",
  input_template: "",
  imageFile: null,
  imagePreview: null,
  saving: false,
};

interface DbTransaction {
  id: string;
  invoice_id: string;
  denomination_label?: string | null;
  amount: number;
  status: string;
  created_at: string;
  user_id?: string | null;
  player_id?: string | null;
  game_slug?: string | null;
  payment_method?: string | null;
  buyer_email?: string;
}

const STATUS_COLORS: Record<string, string> = {
  success: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  success: "Berhasil",
  pending: "Menunggu",
  processing: "Diproses",
  failed: "Gagal",
};

const PLATFORM_OPTIONS = ["Mobile", "PC", "Mobile & PC"];
const CATEGORY_OPTIONS = [
  { value: "game", label: "Game" },
  { value: "voucher", label: "Voucher" },
  { value: "ppob", label: "PPOB" },
];

type Tab = "dashboard" | "transactions" | "products" | "markup";

const dbBySlug = (product: ProductItem) => ({ slug: product.slug });

const Admin = () => {
  const { signOut } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<ProductItem[]>(defaultMockProducts);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [dbTransactions, setDbTransactions] = useState<DbTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProductForm>(EMPTY_NEW_PRODUCT);
  const [newCategory, setNewCategory] = useState<NewCategoryForm>(EMPTY_NEW_CATEGORY);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const categoryImageRef = useRef<HTMLInputElement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "category" | "product";
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const generateUniqueSlug = async (table: string, baseSlug: string): Promise<string> => {
    if (!supabase) return baseSlug;
    const { data } = await supabase.from(table).select("slug").eq("slug", baseSlug).maybeSingle();
    if (!data) return baseSlug;
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${baseSlug}-${suffix}`;
  };

  const totalRevenue = dbTransactions
    .filter((t) => t.status === "success")
    .reduce((s, t) => s + t.amount, 0);
  const successRate = dbTransactions.length > 0
    ? ((dbTransactions.filter((t) => t.status === "success").length / dbTransactions.length) * 100).toFixed(1)
    : "0.0";

  const filteredOrders = search
    ? dbTransactions.filter(
        (t) =>
          t.invoice_id.toLowerCase().includes(search.toLowerCase()) ||
          (t.denomination_label ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (t.buyer_email ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : dbTransactions;

  const fetchCategories = () => {
    if (!supabaseConfigured || !supabase) return;
    setLoadingCategories(true);
    supabase
      .from("categories")
      .select("id, name, slug, image_url, platform, input_template")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        setLoadingCategories(false);
        if (error) {
          console.error("Gagal memuat kategori:", error);
          return;
        }
        if (data) setCategories(data as CategoryItem[]);
      });
  };

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await fetch(API.adminTransactions, { headers: edgeHeaders() });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const json = await res.json() as { transactions: DbTransaction[] };
      setDbTransactions(json.transactions ?? []);
    } catch (err) {
      console.error("Gagal memuat transaksi:", err);
      toast.error("Gagal memuat transaksi dari server");
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    void fetchTransactions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "products") {
      if (supabaseConfigured && supabase) {
        setLoadingProducts(true);
        supabase
          .from("products")
          .select("id, slug, name, category, platform, pricing_mode, fixed_price, cost_price, markup_percent, digiflazz_sku, image_url, is_active")
          .order("name")
          .then(({ data, error }) => {
            setLoadingProducts(false);
            if (error) {
              toast.error("Gagal memuat produk dari database");
              return;
            }
            if (data && data.length > 0) {
              setProducts(
                data.map((d) => ({
                  ...d,
                  platform: d.platform ?? "Mobile",
                  digiflazz_sku: d.digiflazz_sku ?? null,
                })) as ProductItem[]
              );
            }
          });
      }
      fetchCategories();
    }
    if (activeTab === "transactions") {
      void fetchTransactions();
    }
  }, [activeTab]);

  const computedPrice = (p: ProductItem) =>
    p.pricing_mode === "automatic"
      ? Math.ceil((p.cost_price * (1 + p.markup_percent / 100)) / 100) * 100
      : p.fixed_price;

  const updateProduct = (id: string, patch: Partial<ProductItem>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handleSaveProduct = async (product: ProductItem) => {
    updateProduct(product.id, { saving: true });

    if (!supabaseConfigured || !supabase) {
      await new Promise((r) => setTimeout(r, 600));
      updateProduct(product.id, { saving: false });
      toast.success(`Produk "${product.name}" disimpan (mode demo)`);
      return;
    }

    const sellingPrice = product.pricing_mode === "automatic"
      ? Math.ceil((product.cost_price * (1 + product.markup_percent / 100)) / 100) * 100
      : product.fixed_price;

    const { error } = await supabase
      .from("products")
      .update({
        name: product.name,
        platform: product.platform,
        pricing_mode: product.pricing_mode,
        fixed_price: product.fixed_price,
        cost_price: product.cost_price,
        markup_percent: product.markup_percent,
        selling_price: sellingPrice,
        is_active: product.is_active,
        digiflazz_sku: product.digiflazz_sku || null,
      })
      .eq("slug", dbBySlug(product).slug);

    updateProduct(product.id, { saving: false });
    if (error) {
      console.error("Update error:", error);
      toast.error(`Gagal menyimpan: ${error.message}`);
    } else {
      toast.success(`Produk "${product.name}" berhasil disimpan`);
    }
  };

  const handleImageUpload = async (product: ProductItem, file: File) => {
    if (!file) return;

    if (!supabaseConfigured || !supabase) {
      toast.error("Upload gambar memerlukan Supabase.");
      return;
    }

    updateProduct(product.id, { uploading: true });

    const ext = file.name.split(".").pop() ?? "jpg";
    const fileName = `${product.slug}-${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      updateProduct(product.id, { uploading: false });
      toast.error(`Upload gagal: ${uploadError.message}`);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(uploadData.path);

    const newImageUrl = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_url: newImageUrl })
      .eq("slug", product.slug);

    updateProduct(product.id, { uploading: false, image_url: newImageUrl });

    if (updateError) {
      toast.error(`Gambar diupload tapi gagal disimpan ke database: ${updateError.message}`);
    } else {
      toast.success("Gambar berhasil diupload!");
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) { toast.error("Nama produk wajib diisi"); return; }
    if (!newProduct.slug.trim()) { toast.error("Slug wajib diisi"); return; }
    if (!newProduct.category) { toast.error("Pilih kategori"); return; }

    if (!supabaseConfigured || !supabase) {
      toast.error("Menambah produk memerlukan koneksi Supabase");
      return;
    }

    setNewProduct((prev) => ({ ...prev, saving: true }));

    const sellingPrice = newProduct.pricing_mode === "automatic"
      ? Math.ceil((newProduct.cost_price * (1 + newProduct.markup_percent / 100)) / 100) * 100
      : newProduct.fixed_price;

    const uniqueProductSlug = await generateUniqueSlug("products", newProduct.slug.trim());
    if (uniqueProductSlug !== newProduct.slug.trim()) {
      setNewProduct((prev) => ({ ...prev, slug: uniqueProductSlug }));
    }

    const insertPayload = {
      name: newProduct.name.trim(),
      slug: uniqueProductSlug,
      category: newProduct.category,
      game_category: newProduct.category === "game" ? newProduct.game_category : null,
      platform: newProduct.platform,
      pricing_mode: newProduct.pricing_mode,
      cost_price: newProduct.cost_price,
      markup_percent: newProduct.markup_percent,
      fixed_price: newProduct.fixed_price,
      selling_price: sellingPrice,
      digiflazz_sku: newProduct.digiflazz_sku.trim() || null,
      is_active: newProduct.is_active,
      image_url: null,
    };

    const { data, error } = await supabase
      .from("products")
      .insert(insertPayload)
      .select("id, slug, name, category, platform, pricing_mode, fixed_price, cost_price, markup_percent, digiflazz_sku, image_url, is_active")
      .single();

    setNewProduct((prev) => ({ ...prev, saving: false }));

    if (error) {
      console.error("Insert error:", error);
      console.error("Insert payload:", insertPayload);
      toast.error(`Gagal menambah produk: ${error.message}`);
      return;
    }

    if (data) {
      setProducts((prev) => [
        ...prev,
        { ...data, platform: data.platform ?? "Mobile" } as ProductItem,
      ]);
    }

    toast.success(`Produk "${newProduct.name}" berhasil ditambahkan!`);
    setShowAddModal(false);
    setNewProduct(EMPTY_NEW_PRODUCT);
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) { toast.error("Nama kategori wajib diisi"); return; }
    if (!newCategory.slug.trim()) { toast.error("Slug wajib diisi"); return; }

    if (!supabaseConfigured || !supabase) {
      toast.error("Menambah kategori memerlukan koneksi Supabase");
      return;
    }

    setNewCategory((prev) => ({ ...prev, saving: true }));

    const uniqueSlug = await generateUniqueSlug("categories", newCategory.slug.trim());

    let imageUrl: string | null = null;

    if (newCategory.imageFile) {
      const ext = newCategory.imageFile.name.split(".").pop() ?? "jpg";
      const fileName = `${uniqueSlug}-${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("game-images")
        .upload(fileName, newCategory.imageFile, { upsert: true });

      if (uploadError) {
        toast.error(`Gagal upload: Pastikan bucket 'game-images' di Supabase sudah diatur ke Public.`);
        setNewCategory((prev) => ({ ...prev, saving: false }));
        return;
      }

      const { data: urlData } = supabase.storage
        .from("game-images")
        .getPublicUrl(uploadData.path);
      imageUrl = urlData.publicUrl;
    }

    const insertPayload = {
      name: newCategory.name.trim(),
      slug: uniqueSlug,
      platform: newCategory.platform.trim() || null,
      image_url: imageUrl,
      input_template: newCategory.input_template || null,
    };

    const { data, error } = await supabase
      .from("categories")
      .insert(insertPayload)
      .select("id, name, slug, image_url, platform, input_template")
      .single();

    setNewCategory((prev) => ({ ...prev, saving: false }));

    if (error) {
      console.error("Insert kategori error:", error);
      toast.error(`Gagal menambah kategori: ${error.message}`);
      return;
    }

    if (data) {
      setCategories((prev) => [...prev, data as CategoryItem]);
    }

    if (uniqueSlug !== newCategory.slug.trim()) {
      toast.success(`Kategori "${newCategory.name}" ditambahkan dengan slug "${uniqueSlug}" (slug asli sudah ada)`);
    } else {
      toast.success(`Kategori "${newCategory.name}" berhasil ditambahkan!`);
    }
    setShowAddCategoryModal(false);
    setNewCategory(EMPTY_NEW_CATEGORY);
  };

  const handleDeleteCategory = (cat: CategoryItem) => {
    setDeleteConfirm({ type: "category", id: cat.id, name: cat.name });
  };

  const handleDeleteProduct = (product: ProductItem) => {
    setDeleteConfirm({ type: "product", id: product.id, name: product.name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || !supabaseConfigured || !supabase) {
      toast.error("Koneksi Supabase tidak tersedia");
      return;
    }
    setDeleting(true);
    const { type, id, name } = deleteConfirm;
    const table = type === "category" ? "categories" : "products";
    const { error } = await supabase.from(table).delete().eq("id", id);
    setDeleting(false);
    setDeleteConfirm(null);
    if (error) {
      toast.error(`Gagal menghapus: ${error.message}`);
    } else {
      if (type === "category") {
        setCategories((prev) => prev.filter((c) => c.id !== id));
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
      toast.success(`"${name}" berhasil dihapus`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "transactions", label: "Transaksi", icon: ShoppingCart },
    { id: "products", label: "Produk", icon: Package },
    { id: "markup", label: "Markup Global", icon: Settings },
  ];

  const gameCategoryOptions = categories.length > 0
    ? categories.map((c) => ({ value: c.slug, label: c.name }))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <nav className="glass-card border-b border-border/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 overflow-x-auto">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="font-display font-bold text-foreground hidden sm:block">RyuiiCharge</span>
              <span className="text-muted-foreground text-xs hidden sm:block">/ Admin</span>
            </Link>
            <div className="flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-tab-${tab.id}`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:block">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 shrink-0">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:block">Keluar</span>
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <h1 className="font-display text-2xl font-bold">Dashboard</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Revenue", value: formatPrice(totalRevenue), icon: DollarSign, color: "text-emerald-400" },
                { label: "Total Pesanan", value: dbTransactions.length.toString(), icon: ShoppingCart, color: "text-primary" },
                { label: "Pesanan Hari Ini", value: dbTransactions.filter((t) => new Date(t.created_at).toDateString() === new Date().toDateString()).length.toString(), icon: TrendingUp, color: "text-secondary" },
                { label: "Success Rate", value: `${successRate}%`, icon: BarChart3, color: "text-amber-400" },
              ].map((stat) => (
                <div key={stat.label} className="glass-card p-5" data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <p className={`font-display text-xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {!supabaseConfigured && (
              <div className="glass-card p-4 border border-amber-500/30 bg-amber-500/5">
                <p className="text-amber-400 text-sm font-semibold mb-1">Mode Demo — Supabase Belum Terkonfigurasi</p>
                <p className="text-muted-foreground text-xs">
                  Tambahkan <code className="text-primary">VITE_SUPABASE_URL</code> dan <code className="text-primary">VITE_SUPABASE_ANON_KEY</code> ke secrets untuk mengaktifkan database real, upload gambar, dan autentikasi.
                </p>
              </div>
            )}

            <div className="glass-card p-5">
              <h3 className="font-display font-semibold mb-4">Transaksi Terbaru</h3>
              {loadingTransactions ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : dbTransactions.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada transaksi.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Pembeli / Email</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Harga</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbTransactions.slice(0, 5).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.invoice_id}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.buyer_email ?? "Guest"}</TableCell>
                        <TableCell className="text-sm">{t.denomination_label ?? "-"}</TableCell>
                        <TableCell className="text-sm font-medium">{formatPrice(t.amount)}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs border ${STATUS_COLORS[t.status] ?? STATUS_COLORS.pending}`}>
                            {STATUS_LABELS[t.status] ?? t.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}

        {activeTab === "transactions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="font-display text-2xl font-bold">Transaksi</h1>
              <Input
                placeholder="Cari invoice, produk, player ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 bg-muted/50 border-border/50"
                data-testid="input-search-transactions"
              />
            </div>
            <div className="glass-card overflow-hidden">
              {loadingTransactions ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <p className="text-muted-foreground text-sm p-5">
                  {search ? "Tidak ada transaksi yang cocok dengan pencarian." : "Belum ada transaksi."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Pembeli / Email</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Harga</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((t) => (
                      <TableRow key={t.id} data-testid={`row-order-${t.invoice_id}`}>
                        <TableCell className="font-mono text-xs">{t.invoice_id}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.buyer_email ?? "Guest"}</TableCell>
                        <TableCell className="text-sm">{t.denomination_label ?? "-"}</TableCell>
                        <TableCell className="text-sm font-medium">{formatPrice(t.amount)}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs border ${STATUS_COLORS[t.status] ?? STATUS_COLORS.pending}`}>
                            {STATUS_LABELS[t.status] ?? t.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        )}

        {activeTab === "products" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold">Manajemen Produk</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Kelola kategori game dan produk denominasi
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {supabaseConfigured && (
                  <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    Terhubung ke Supabase
                  </Badge>
                )}
                <Button
                  onClick={() => setShowAddCategoryModal(true)}
                  variant="outline"
                  className="gap-2 border-border/50"
                  data-testid="button-add-category"
                >
                  <FolderOpen className="h-4 w-4" />
                  Tambah Kategori Game
                </Button>
                <Button
                  onClick={() => {
                    const defaultGame = gameCategoryOptions[0]?.value ?? "";
                    setNewProduct({ ...EMPTY_NEW_PRODUCT, game_category: defaultGame });
                    setShowAddModal(true);
                  }}
                  className="gap-2 btn-neon gradient-primary text-white"
                  data-testid="button-add-product"
                >
                  <Plus className="h-4 w-4" />
                  Tambah Produk
                </Button>
              </div>
            </div>

            {/* Daftar Kategori Game */}
            <div className="glass-card p-5">
              <h2 className="font-display font-semibold text-lg mb-4">Kategori Game</h2>
              {loadingCategories ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : categories.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {supabaseConfigured ? "Belum ada kategori game. Tambah kategori baru." : "Supabase belum terkonfigurasi."}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {categories.map((cat) => (
                    <div key={cat.id} className="glass-card p-3 relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted/40 mb-2">
                        {cat.image_url ? (
                          <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-xs leading-tight line-clamp-2">{cat.name}</p>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5 truncate">{cat.slug}</p>
                      {cat.platform && (
                        <p className="text-xs text-muted-foreground">{cat.platform}</p>
                      )}
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow"
                        title="Hapus kategori"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daftar Produk */}
            {loadingProducts ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {products.map((product) => (
                  <div key={product.id} className="glass-card p-5">
                    <div className="flex flex-col md:flex-row gap-5">
                      {/* Gambar produk (upload tetap di sini untuk edit produk yang sudah ada) */}
                      <div className="flex items-start gap-4">
                        <div className="relative group shrink-0">
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted/50 border border-border/50">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                              </div>
                            )}
                            {product.uploading && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                                <Loader2 className="h-5 w-5 animate-spin text-white" />
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => fileInputRefs.current[product.id]?.click()}
                            disabled={product.uploading}
                            className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full gradient-primary flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                            title="Upload gambar"
                            data-testid={`button-upload-image-${product.slug}`}
                          >
                            <Upload className="h-3.5 w-3.5 text-white" />
                          </button>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={(el) => { fileInputRefs.current[product.id] = el; }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(product, file);
                              e.target.value = "";
                            }}
                          />
                        </div>

                        <div className="space-y-1.5 min-w-0">
                          <p className="text-xs text-muted-foreground capitalize">{product.category}</p>
                          <p className="text-xs text-muted-foreground font-mono">{product.slug}</p>
                          <button
                            onClick={() => updateProduct(product.id, { is_active: !product.is_active })}
                            className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors ${
                              product.is_active
                                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                : "border-border/50 text-muted-foreground"
                            }`}
                          >
                            {product.is_active ? "Aktif" : "Nonaktif"}
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Nama Produk</Label>
                            <Input
                              value={product.name}
                              onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                              className="bg-muted/50 border-border/50"
                              placeholder="Nama produk"
                              data-testid={`input-name-${product.slug}`}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Platform</Label>
                            <select
                              value={product.platform ?? "Mobile"}
                              onChange={(e) => updateProduct(product.id, { platform: e.target.value })}
                              className="w-full bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                              data-testid={`select-platform-${product.slug}`}
                            >
                              {PLATFORM_OPTIONS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">SKU Digiflazz</Label>
                          <Input
                            value={product.digiflazz_sku ?? ""}
                            onChange={(e) => updateProduct(product.id, { digiflazz_sku: e.target.value })}
                            className="bg-muted/50 border-border/50 font-mono"
                            placeholder="Kode SKU dari Digiflazz (opsional)"
                            data-testid={`input-sku-${product.slug}`}
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <Label className="text-sm font-medium shrink-0">Mode Harga:</Label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateProduct(product.id, {
                                  pricing_mode: product.pricing_mode === "manual" ? "automatic" : "manual",
                                })
                              }
                              className="flex items-center gap-2 glass-card px-3 py-1.5 hover:border-primary/50 transition-all"
                              data-testid={`toggle-pricing-mode-${product.slug}`}
                            >
                              {product.pricing_mode === "automatic" ? (
                                <ToggleRight className="h-5 w-5 text-primary" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                              )}
                              <span className={`text-sm font-medium ${product.pricing_mode === "automatic" ? "text-primary" : "text-muted-foreground"}`}>
                                {product.pricing_mode === "automatic" ? "Otomatis" : "Manual"}
                              </span>
                            </button>
                            <span className="text-xs text-muted-foreground">
                              {product.pricing_mode === "automatic"
                                ? "Harga = Modal + Markup %"
                                : "Harga ditentukan manual"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {product.pricing_mode === "automatic" ? (
                            <>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Harga Modal (Rp)</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={product.cost_price}
                                    onChange={(e) => updateProduct(product.id, { cost_price: Number(e.target.value) })}
                                    className="pl-8 bg-muted/50 border-border/50"
                                    data-testid={`input-cost-price-${product.slug}`}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Markup (%)</Label>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="999"
                                    value={product.markup_percent}
                                    onChange={(e) => updateProduct(product.id, { markup_percent: Number(e.target.value) })}
                                    className="pr-8 bg-muted/50 border-border/50"
                                    data-testid={`input-markup-percent-${product.slug}`}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Harga Jual (kalkulasi)</Label>
                                <div className="glass-card px-3 py-2 border-primary/30">
                                  <p className="text-primary font-bold text-sm">{formatPrice(computedPrice(product))}</p>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div>
                              <Label className="text-xs text-muted-foreground mb-1 block">Harga Jual Manual (Rp)</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                                <Input
                                  type="number"
                                  min="0"
                                  value={product.fixed_price}
                                  onChange={(e) => updateProduct(product.id, { fixed_price: Number(e.target.value) })}
                                  className="pl-8 bg-muted/50 border-border/50"
                                  data-testid={`input-fixed-price-${product.slug}`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex md:flex-col justify-end items-end gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleSaveProduct(product)}
                          disabled={product.saving}
                          className="gap-2 btn-neon gradient-primary text-white"
                          data-testid={`button-save-product-${product.slug}`}
                        >
                          {product.saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Simpan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteProduct(product)}
                          className="gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          data-testid={`button-delete-product-${product.slug}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "markup" && (
          <div className="space-y-4">
            <div>
              <h1 className="font-display text-2xl font-bold">Markup Global</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Terapkan markup global ke semua produk dengan mode Otomatis
              </p>
            </div>

            <div className="glass-card p-5 space-y-4 max-w-sm">
              <div>
                <Label className="text-sm mb-2 block">Markup Global (%)</Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min="0"
                      max="999"
                      placeholder="contoh: 15"
                      className="pr-8 bg-muted/50 border-border/50"
                      id="global-markup"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <Button
                    className="btn-neon gradient-primary text-white"
                    data-testid="button-apply-global-markup"
                    onClick={() => {
                      const val = (document.getElementById("global-markup") as HTMLInputElement)?.value;
                      const pct = Number(val);
                      if (isNaN(pct) || pct < 0) return;
                      setProducts((prev) =>
                        prev.map((p) =>
                          p.pricing_mode === "automatic" ? { ...p, markup_percent: pct } : p
                        )
                      );
                      toast.success(`Markup global ${pct}% diterapkan ke semua produk Otomatis`);
                    }}
                  >
                    Terapkan
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Catatan: Hanya produk dengan mode "Otomatis" yang akan terpengaruh. Simpan setiap produk untuk menyimpan perubahan ke database.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((game) => (
                <div key={game.slug} className="glass-card p-4 flex items-center gap-4">
                  {game.image_url ? (
                    <img src={game.image_url} alt={game.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                      <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{game.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{game.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${game.pricing_mode === "automatic" ? "border-primary/40 text-primary" : "border-border/50 text-muted-foreground"}`}>
                        {game.pricing_mode === "automatic" ? "Otomatis" : "Manual"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatPrice(computedPrice(game))}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min="0"
                      max="999"
                      placeholder="0"
                      value={game.markup_percent === 0 ? "" : game.markup_percent}
                      onChange={(e) =>
                        updateProduct(game.id, { markup_percent: Number(e.target.value), pricing_mode: "automatic" })
                      }
                      className="w-20 bg-muted/50 border-border/50 text-right"
                      data-testid={`input-markup-${game.slug}`}
                    />
                    <span className="text-muted-foreground text-sm">%</span>
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="btn-neon gradient-primary text-white"
              data-testid="button-save-markup"
              onClick={() => {
                products.forEach((p) => {
                  if (p.pricing_mode === "automatic") handleSaveProduct(p);
                });
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              Simpan Semua Markup
            </Button>
          </div>
        )}
      </div>

      {/* Modal Tambah Kategori Game */}
      {showAddCategoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddCategoryModal(false); }}
        >
          <div className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-5 relative">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Tambah Kategori Game</h2>
              <button
                onClick={() => { setShowAddCategoryModal(false); setNewCategory(EMPTY_NEW_CATEGORY); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Upload Gambar Kategori */}
            <div>
              <Label className="text-sm mb-2 block">Gambar Kategori</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted/50 border border-border/50 shrink-0">
                  {newCategory.imagePreview ? (
                    <img src={newCategory.imagePreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => categoryImageRef.current?.click()}
                  className="gap-2 border-border/50"
                  type="button"
                >
                  <Upload className="h-4 w-4" />
                  Pilih Gambar
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={categoryImageRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewCategory((prev) => ({
                        ...prev,
                        imageFile: file,
                        imagePreview: URL.createObjectURL(file),
                      }));
                    }
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {/* Nama & Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1 block">Nama <span className="text-red-400">*</span></Label>
                <Input
                  value={newCategory.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewCategory((prev) => ({
                      ...prev,
                      name,
                      slug: toSlug(name),
                    }));
                  }}
                  placeholder="contoh: Mobile Legends"
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div>
                <Label className="text-sm mb-1 block">Slug <span className="text-red-400">*</span></Label>
                <Input
                  value={newCategory.slug}
                  onChange={(e) => setNewCategory((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="contoh: mobile-legends"
                  className="bg-muted/50 border-border/50 font-mono"
                />
              </div>
            </div>

            {/* Platform */}
            <div>
              <Label className="text-sm mb-1 block">Platform</Label>
              <select
                value={newCategory.platform}
                onChange={(e) => setNewCategory((prev) => ({ ...prev, platform: e.target.value }))}
                className="w-full bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Tipe Input Data Akun */}
            <div>
              <Label className="text-sm mb-1 block">Tipe Input Data Akun</Label>
              <select
                value={newCategory.input_template}
                onChange={(e) => setNewCategory((prev) => ({ ...prev, input_template: e.target.value }))}
                className="w-full bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">— Pilih tipe input —</option>
                <option value="SINGLE_ID">SINGLE_ID — Player ID / User ID (FF, PUBG)</option>
                <option value="USERNAME">USERNAME — Username (Roblox)</option>
                <option value="MLBB">MLBB — User ID + Zone ID (Mobile Legends)</option>
                <option value="HOYOVERSE">HOYOVERSE — UID + Server Asia/America/Europe/TW-HK-MO (Genshin, HSR, ZZZ, HI3)</option>
                <option value="KURO">KURO — UID + Server Asia/America/Europe/HMT/SEA (Wuthering Waves, PGR)</option>
                <option value="RIOT">RIOT — Riot ID + Tagline (Valorant)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Menentukan form input yang tampil di halaman topup game ini.
              </p>
            </div>

            {/* Tombol aksi */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-border/50"
                onClick={() => { setShowAddCategoryModal(false); setNewCategory(EMPTY_NEW_CATEGORY); }}
                disabled={newCategory.saving}
              >
                Batal
              </Button>
              <Button
                className="flex-1 btn-neon gradient-primary text-white gap-2"
                onClick={handleAddCategory}
                disabled={newCategory.saving || !newCategory.name || !newCategory.slug}
              >
                {newCategory.saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {newCategory.saving ? "Menyimpan..." : "Simpan Kategori"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Produk Baru */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5 relative">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Tambah Produk Baru</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nama & Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1 block">Nama Produk <span className="text-red-400">*</span></Label>
                <Input
                  value={newProduct.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewProduct((prev) => ({
                      ...prev,
                      name,
                      slug: prev.category === "game" && prev.game_category
                        ? `${prev.game_category}-${toSlug(name)}`
                        : toSlug(name),
                    }));
                  }}
                  placeholder="contoh: 5 Diamond"
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div>
                <Label className="text-sm mb-1 block">Slug <span className="text-red-400">*</span></Label>
                <Input
                  value={newProduct.slug}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="contoh: mobile-legends-5-diamond"
                  className="bg-muted/50 border-border/50 font-mono"
                />
              </div>
            </div>

            {/* Kategori & Platform */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1 block">Kategori <span className="text-red-400">*</span></Label>
                <select
                  value={newProduct.category}
                  onChange={(e) => {
                    const cat = e.target.value as "game" | "voucher" | "ppob";
                    setNewProduct((prev) => ({
                      ...prev,
                      category: cat,
                      slug: cat === "game" && prev.game_category && prev.name
                        ? `${prev.game_category}-${toSlug(prev.name)}`
                        : toSlug(prev.name),
                    }));
                  }}
                  className="w-full bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-sm mb-1 block">Platform</Label>
                <select
                  value={newProduct.platform}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, platform: e.target.value }))}
                  className="w-full bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Game dropdown — hanya tampil jika kategori = game, diambil dari categories DB */}
            {newProduct.category === "game" && (
              <div>
                <Label className="text-sm mb-1 block">Game <span className="text-red-400">*</span></Label>
                {gameCategoryOptions.length === 0 ? (
                  <p className="text-xs text-amber-400 py-2">
                    Belum ada kategori game. Tambah kategori terlebih dahulu.
                  </p>
                ) : (
                  <select
                    value={newProduct.game_category}
                    onChange={(e) => {
                      const gc = e.target.value;
                      setNewProduct((prev) => ({
                        ...prev,
                        game_category: gc,
                        slug: prev.name ? `${gc}-${toSlug(prev.name)}` : gc,
                      }));
                    }}
                    className="w-full bg-muted/50 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    {gameCategoryOptions.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* SKU Digiflazz */}
            <div>
              <Label className="text-sm mb-1 block">SKU Digiflazz</Label>
              <Input
                value={newProduct.digiflazz_sku}
                onChange={(e) => setNewProduct((prev) => ({ ...prev, digiflazz_sku: e.target.value }))}
                placeholder="Kode SKU dari Digiflazz (opsional)"
                className="bg-muted/50 border-border/50 font-mono"
              />
            </div>

            {/* Harga Modal & Markup */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1 block">Harga Modal (Rp)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                  <Input
                    type="number"
                    min="0"
                    value={newProduct.cost_price}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, cost_price: Number(e.target.value) }))}
                    className="pl-8 bg-muted/50 border-border/50"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1 block">Markup (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="999"
                    value={newProduct.markup_percent}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, markup_percent: Number(e.target.value) }))}
                    className="pr-8 bg-muted/50 border-border/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Mode Harga */}
            <div>
              <Label className="text-sm mb-2 block">Mode Harga</Label>
              <div className="flex gap-2">
                {(["automatic", "manual"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setNewProduct((prev) => ({ ...prev, pricing_mode: mode }))}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                      newProduct.pricing_mode === mode
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {mode === "automatic" ? "Otomatis" : "Manual"}
                  </button>
                ))}
              </div>
            </div>

            {/* Harga Manual */}
            {newProduct.pricing_mode === "manual" && (
              <div>
                <Label className="text-sm mb-1 block">Harga Jual Manual (Rp)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                  <Input
                    type="number"
                    min="0"
                    value={newProduct.fixed_price}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, fixed_price: Number(e.target.value) }))}
                    className="pl-8 bg-muted/50 border-border/50"
                  />
                </div>
              </div>
            )}

            {/* Preview harga otomatis */}
            {newProduct.pricing_mode === "automatic" && newProduct.cost_price > 0 && (
              <div className="glass-card px-3 py-2 border-primary/30">
                <p className="text-xs text-muted-foreground mb-0.5">Harga Jual (kalkulasi)</p>
                <p className="text-primary font-bold text-sm">
                  {formatPrice(Math.ceil((newProduct.cost_price * (1 + newProduct.markup_percent / 100)) / 100) * 100)}
                </p>
              </div>
            )}

            {/* Status aktif */}
            <div className="flex items-center gap-3">
              <Label className="text-sm">Status Produk</Label>
              <button
                type="button"
                onClick={() => setNewProduct((prev) => ({ ...prev, is_active: !prev.is_active }))}
                className={`text-sm flex items-center gap-1 px-3 py-1 rounded-full border transition-colors ${
                  newProduct.is_active
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-border/50 text-muted-foreground"
                }`}
              >
                {newProduct.is_active ? "Aktif" : "Nonaktif"}
              </button>
            </div>

            {/* Tombol aksi */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-border/50"
                onClick={() => { setShowAddModal(false); setNewProduct(EMPTY_NEW_PRODUCT); }}
                disabled={newProduct.saving}
              >
                Batal
              </Button>
              <Button
                className="flex-1 btn-neon gradient-primary text-white gap-2"
                onClick={handleAddProduct}
                disabled={newProduct.saving || !newProduct.name || !newProduct.slug}
              >
                {newProduct.saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {newProduct.saving ? "Menyimpan..." : "Simpan Produk"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-base">Hapus {deleteConfirm.type === "category" ? "Kategori" : "Produk"}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Apakah Anda yakin ingin menghapus <span className="font-semibold text-foreground">"{deleteConfirm.name}"</span>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 border-border/50"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Batal
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white gap-2"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleting ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
