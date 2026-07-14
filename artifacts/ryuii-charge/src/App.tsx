import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter, Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import AdminGuard from "@/components/AdminGuard";
import { Loader2 } from "lucide-react";

const Index = lazy(() => import("@/pages/Index"));
const GameDetail = lazy(() => import("@/pages/GameDetail"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const CekTransaksi = lazy(() => import("@/pages/CekTransaksi"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const EmailVerification = lazy(() => import("@/pages/EmailVerification"));
const Admin = lazy(() => import("@/pages/Admin"));
const PaymentSuccess = lazy(() => import("@/pages/PaymentSuccess"));
const PaymentFailed = lazy(() => import("@/pages/PaymentFailed"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        {() => <Suspense fallback={<PageLoader />}><Index /></Suspense>}
      </Route>
      <Route path="/game/:slug">
        {() => <Suspense fallback={<PageLoader />}><GameDetail /></Suspense>}
      </Route>
      <Route path="/checkout">
        {() => <Suspense fallback={<PageLoader />}><Checkout /></Suspense>}
      </Route>
      <Route path="/cek-transaksi">
        {() => <Suspense fallback={<PageLoader />}><CekTransaksi /></Suspense>}
      </Route>
      <Route path="/login">
        {() => <Suspense fallback={<PageLoader />}><Login /></Suspense>}
      </Route>
      <Route path="/register">
        {() => <Suspense fallback={<PageLoader />}><Register /></Suspense>}
      </Route>
      <Route path="/verify-email">
        {() => <Suspense fallback={<PageLoader />}><EmailVerification /></Suspense>}
      </Route>
      <Route path="/payment/success">
        {() => <Suspense fallback={<PageLoader />}><PaymentSuccess /></Suspense>}
      </Route>
      <Route path="/payment/failed">
        {() => <Suspense fallback={<PageLoader />}><PaymentFailed /></Suspense>}
      </Route>
      <Route path="/admin">
        {() => (
          <Suspense fallback={<PageLoader />}>
            <AdminGuard><Admin /></AdminGuard>
          </Suspense>
        )}
      </Route>
      <Route>
        {() => <Suspense fallback={<PageLoader />}><NotFound /></Suspense>}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
            <Sonner richColors position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
