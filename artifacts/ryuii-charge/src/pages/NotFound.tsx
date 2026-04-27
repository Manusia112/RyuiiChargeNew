import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-6">
      <p className="font-display text-8xl font-bold text-primary/30">404</p>
      <h1 className="font-display text-3xl font-bold">Halaman Tidak Ditemukan</h1>
      <p className="text-muted-foreground">Halaman yang kamu cari tidak ada atau sudah dipindahkan.</p>
      <Link to="/">
        <Button className="gap-2 btn-neon gradient-primary text-white">
          <Home className="h-4 w-4" />
          Kembali ke Beranda
        </Button>
      </Link>
    </div>
  </div>
);

export default NotFound;
