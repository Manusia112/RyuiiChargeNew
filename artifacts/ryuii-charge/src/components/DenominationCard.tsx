import type { GameDenomination } from "@/data/games";

interface Props {
  denomination: GameDenomination;
  selected: boolean;
  onSelect: (d: GameDenomination) => void;
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const DenominationCard = ({ denomination, selected, onSelect }: Props) => {
  return (
    <button
      onClick={() => onSelect(denomination)}
      className={`denom-card ${
        selected
          ? "selected"
          : ""
      }`}
      data-testid={`card-denomination-${denomination.id}`}
    >
      <p className="font-display font-semibold text-sm mb-1">{denomination.label}</p>
      <p className="text-primary font-bold text-base">{formatPrice(denomination.price)}</p>
      {denomination.originalPrice && (
        <p className="text-xs text-muted-foreground line-through">
          {formatPrice(denomination.originalPrice)}
        </p>
      )}
      {denomination.originalPrice && (
        <span className="inline-block mt-1 text-xs text-success font-medium bg-success/10 px-1.5 py-0.5 rounded">
          Hemat {Math.round((1 - denomination.price / denomination.originalPrice) * 100)}%
        </span>
      )}
    </button>
  );
};

export default DenominationCard;
