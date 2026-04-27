import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, Menu, X, Zap, User, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [location, navigate] = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const navLinks = [
    { to: "/", label: "Beranda" },
    { to: "/cek-transaksi", label: "Cek Transaksi" },
  ];

  const handleLogoutConfirm = async () => {
    await signOut();
    setIsOpen(false);
    setShowLogoutDialog(false);
    navigate("/");
  };

  const displayName = user?.name || user?.email || "";

  return (
    <>
      <nav className="sticky top-0 z-50 glass-card border-b border-border/50 backdrop-blur-xl" data-testid="navbar">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 shrink-0" data-testid="link-logo">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold neon-text text-foreground">
                RyuiiCharge
              </span>
            </Link>

            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari game..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-muted/50 border-border/50 focus:border-primary"
                  data-testid="input-search-navbar"
                />
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    location === link.to ? "text-primary" : "text-muted-foreground"
                  }`}
                  data-testid={`link-nav-${link.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  {link.label}
                </Link>
              ))}

              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={displayName}>
                    {displayName}
                  </span>
                  {isAdmin && (
                    <Link to="/admin">
                      <Button variant="outline" size="sm" className="gap-2 border-primary/50 text-primary hover:bg-primary/10">
                        <Shield className="h-4 w-4" />
                        Admin
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLogoutDialog(true)}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="gap-2" data-testid="button-login">
                      <User className="h-4 w-4" />
                      Masuk
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm" className="btn-neon gradient-primary text-white" data-testid="button-register">
                      Daftar
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            <button
              className="md:hidden p-2"
              onClick={() => setIsOpen(!isOpen)}
              data-testid="button-menu-toggle"
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {isOpen && (
            <div className="md:hidden pb-4 space-y-3 border-t border-border/30 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari game..."
                  className="pl-9 bg-muted/50"
                  data-testid="input-search-mobile"
                />
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block text-sm font-medium text-muted-foreground hover:text-primary py-1"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1 py-2 border-t border-border/30">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{displayName}</p>
                      {user.name && (
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <Link to="/admin" onClick={() => setIsOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full gap-2 border-primary/50 text-primary">
                        <Shield className="h-4 w-4" /> Admin Dashboard
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setIsOpen(false); setShowLogoutDialog(true); }}
                    className="w-full gap-2 text-muted-foreground"
                    data-testid="button-logout-mobile"
                  >
                    <LogOut className="h-4 w-4" /> Keluar
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link to="/login" className="flex-1" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">Masuk</Button>
                  </Link>
                  <Link to="/register" className="flex-1" onClick={() => setIsOpen(false)}>
                    <Button size="sm" className="w-full gradient-primary text-white">Daftar</Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah kamu yakin ingin keluar dari akun <span className="font-medium text-foreground">{displayName}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogoutConfirm}
              className="gradient-primary text-white"
            >
              Ya, Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Navbar;
