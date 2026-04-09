import { recentTransactions } from "@/data/transactions";
import { CheckCircle } from "lucide-react";

const TransactionTicker = () => {
  const items = [...recentTransactions, ...recentTransactions];

  return (
    <section className="py-3 overflow-hidden border-y border-border/30 bg-muted/20" data-testid="transaction-ticker">
      <div className="flex animate-ticker whitespace-nowrap">
        {items.map((tx, i) => (
          <div
            key={i}
            className="inline-flex items-center gap-2 px-6 text-sm text-muted-foreground shrink-0"
          >
            <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" style={{ color: "hsl(var(--success))" }} />
            <span>
              <span className="text-foreground font-medium">{tx.name}</span>{" "}
              baru saja membeli{" "}
              <span className="text-primary font-medium">{tx.product}</span>
            </span>
            <span className="text-xs opacity-60">• {tx.time}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TransactionTicker;
