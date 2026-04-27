import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, XCircle, Info } from "lucide-react";
import type { Game } from "@/data/games";
import { API, edgeHeaders } from "@/lib/api";

interface Props {
  game: Game;
  playerId: string;
  setPlayerId: (v: string) => void;
  serverId: string;
  setServerId: (v: string) => void;
}

const NO_VALIDATION_NAME = "Tanpa Validasi (Lanjutkan)";

const CheckNickname = ({ game, playerId, setPlayerId, serverId, setServerId }: Props) => {
  const [checking, setChecking] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [noValidation, setNoValidation] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState(false);

  const resetAll = () => {
    setNickname(null);
    setNoValidation(false);
    setNotFound(false);
    setServerError(false);
  };

  const handleCheck = async () => {
    if (!playerId.trim()) return;
    setChecking(true);
    resetAll();

    try {
      const response = await fetch(API.checkNickname, {
        method: "POST",
        headers: edgeHeaders(),
        body: JSON.stringify({
          game_slug: game.slug,
          user_id:   playerId.trim(),
          zone_id:   serverId.trim() || undefined,
        }),
      });

      if (!response.ok) {
        console.error("check-nickname HTTP error:", response.status);
        setServerError(true);
        return;
      }

      const result = await response.json() as { success?: boolean; name?: string; error?: string };

      if (result.success && result.name === NO_VALIDATION_NAME) {
        setNoValidation(true);
      } else if (result.success && result.name) {
        setNickname(result.name);
      } else {
        setNotFound(true);
      }
    } catch {
      setServerError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex-1 min-w-0">
          <label className="text-sm text-muted-foreground mb-1 block">{game.idLabel}</label>
          <Input
            placeholder={`Masukkan ${game.idLabel}`}
            value={playerId}
            onChange={(e) => {
              setPlayerId(e.target.value);
              resetAll();
            }}
            className="bg-muted/50 border-border/50"
            data-testid="input-player-id"
          />
        </div>
        {game.serverLabel && (
          <div className="w-28 shrink-0">
            <label className="text-sm text-muted-foreground mb-1 block">{game.serverLabel}</label>
            <Input
              placeholder={game.serverLabel}
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              className="bg-muted/50 border-border/50"
              data-testid="input-server-id"
            />
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleCheck}
        disabled={!playerId.trim() || checking}
        className="border-primary/50 text-primary hover:bg-primary/10"
        data-testid="button-check-nickname"
      >
        {checking ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
            Mengecek...
          </>
        ) : (
          "Cek Nickname"
        )}
      </Button>

      {nickname && (
        <div className="flex items-center gap-2 text-sm" data-testid="text-nickname-found">
          <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--success))" }} />
          <span className="text-muted-foreground">Nickname:</span>
          <span className="font-semibold text-primary">{nickname}</span>
        </div>
      )}

      {noValidation && (
        <div className="flex items-center gap-2 text-sm" data-testid="text-no-validation">
          <Info className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="text-muted-foreground">Game ini tidak memerlukan validasi nickname. Lanjutkan pembelian.</span>
        </div>
      )}

      {notFound && (
        <div className="flex items-center gap-2 text-sm" data-testid="text-nickname-not-found">
          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-muted-foreground">ID tidak ditemukan. Periksa kembali.</span>
        </div>
      )}

      {serverError && (
        <div className="flex items-center gap-2 text-sm" data-testid="text-server-error">
          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          <span className="text-destructive">Gagal menghubungi server. Coba lagi.</span>
        </div>
      )}
    </div>
  );
};

export default CheckNickname;
