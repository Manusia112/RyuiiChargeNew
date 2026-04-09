import { Check, Loader2, Clock, XCircle } from "lucide-react";

interface Step {
  label: string;
  status: "done" | "active" | "pending" | "failed";
  time?: string;
}

interface Props {
  steps: Step[];
}

const OrderStatusTimeline = ({ steps }: Props) => {
  return (
    <div className="space-y-4" data-testid="order-status-timeline">
      {steps.map((step, index) => (
        <div key={index} className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 shrink-0 ${
                step.status === "done"
                  ? "border-primary bg-primary"
                  : step.status === "active"
                  ? "border-warning bg-warning/20"
                  : step.status === "failed"
                  ? "border-destructive bg-destructive/20"
                  : "border-border bg-muted"
              }`}
            >
              {step.status === "done" && <Check className="h-4 w-4 text-white" />}
              {step.status === "active" && <Loader2 className="h-4 w-4 text-warning animate-spin" />}
              {step.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
              {step.status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" />}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-0.5 h-8 mt-1 ${
                  step.status === "done" ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
          <div className="flex-1 pt-1">
            <p className={`text-sm font-medium ${
              step.status === "done" ? "text-foreground" :
              step.status === "active" ? "text-warning" :
              step.status === "failed" ? "text-destructive" :
              "text-muted-foreground"
            }`}>
              {step.label}
            </p>
            {step.time && (
              <p className="text-xs text-muted-foreground">{step.time}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderStatusTimeline;
