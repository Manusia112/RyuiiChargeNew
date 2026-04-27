import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter, Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster as Sonner } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import AdminGuard from "@/components/AdminGuard";
import Index from "@/pages/Index";
import GameDetail from "@/pages/GameDetail";
import Checkout from "@/pages/Checkout";
import CekTransaksi from "@/pages/CekTransaksi";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import EmailVerification from "@/pages/EmailVerification";
import Admin from "@/pages/Admin";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentFailed from "@/pages/PaymentFailed";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Index} />
      <Route path="/game/:slug" component={GameDetail} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/cek-transaksi" component={CekTransaksi} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify-email" component={EmailVerification} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/failed" component={PaymentFailed} />
      <Route path="/admin">
        {() => (
          <AdminGuard>
            <Admin />
          </AdminGuard>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
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
  );
}

export default App;
