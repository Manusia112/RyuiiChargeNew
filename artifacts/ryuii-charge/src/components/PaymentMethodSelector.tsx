import { QrCode, Wallet, Building2 } from "lucide-react";

const methods = [
  {
    id: "qris",
    label: "QRIS",
    description: "Scan QR dari e-wallet manapun",
    icon: QrCode,
  },
  {
    id: "ewallet",
    label: "E-Wallet",
    description: "OVO, DANA, GoPay, ShopeePay",
    icon: Wallet,
  },
  {
    id: "va",
    label: "Virtual Account",
    description: "BCA, BNI, BRI, Mandiri",
    icon: Building2,
  },
];

interface Props {
  selected: string;
  onSelect: (id: string) => void;
}

const PaymentMethodSelector = ({ selected, onSelect }: Props) => (
  <div className="space-y-3">
    <h3 className="font-display font-semibold text-lg">Metode Pembayaran</h3>
    {methods.map((m) => (
      <button
        key={m.id}
        onClick={() => onSelect(m.id)}
        className={`w-full glass-card p-4 flex items-center gap-4 text-left transition-all duration-300 hover:border-primary/50 ${
          selected === m.id ? "border-primary ring-1 ring-primary/50 bg-primary/10" : ""
        }`}
        data-testid={`button-payment-${m.id}`}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
          <m.icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{m.label}</p>
          <p className="text-xs text-muted-foreground">{m.description}</p>
        </div>
      </button>
    ))}
  </div>
);

export default PaymentMethodSelector;
