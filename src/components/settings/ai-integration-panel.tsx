"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useSupabaseUser } from "@/lib/supabase/use-supabase-user";
import { createApiKey, listApiKeys, revokeApiKey, type ApiKeySummary } from "@/lib/ai/keys";

/**
 * Lets the user generate/revoke personal API keys for external AI assistants
 * (ChatGPT, Claude, ...) to call the MCP endpoint at /api/mcp. A raw key is
 * shown exactly once, right after creation — like a GitHub PAT — because
 * only its hash is ever stored (see src/lib/ai/keys.ts).
 */
export function AiIntegrationPanel() {
  const { userId } = useSupabaseUser();
  const [keys, setKeys] = React.useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newKeyName, setNewKeyName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);
  const [keyPendingRevoke, setKeyPendingRevoke] = React.useState<ApiKeySummary | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // `loading` already starts as `true` (see useState above) — this effect
    // only ever needs to flip it back to `false` once the fetch settles.
    listApiKeys(userId)
      .then((result) => {
        if (!cancelled) setKeys(result);
      })
      .catch(() => {
        if (!cancelled) toast.error("Não foi possível carregar as chaves de API.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleCreate() {
    if (!userId || !newKeyName.trim()) return;
    setCreating(true);
    try {
      const { summary, rawKey } = await createApiKey(userId, newKeyName.trim());
      setKeys((prev) => [summary, ...prev]);
      setRevealedKey(rawKey);
      setNewKeyName("");
    } catch {
      toast.error("Não foi possível gerar a chave.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(key: ApiKeySummary) {
    if (!userId) return;
    try {
      await revokeApiKey(userId, key.id);
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      toast.success("Chave revogada.");
    } catch {
      toast.error("Não foi possível revogar a chave.");
    } finally {
      setKeyPendingRevoke(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-muted-foreground">
        Gere uma chave para conectar um assistente de IA (ChatGPT, Claude, ...) ao endpoint MCP do ERP em{" "}
        <code className="rounded bg-paper-mist px-1 py-0.5 text-caption">/api/mcp</code>. A IA só acessa os seus próprios dados e
        qualquer lançamento financeiro exige sua confirmação explícita antes de ser gravado.
      </p>

      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="text-caption text-muted-foreground">Carregando...</p>
        ) : keys.length === 0 ? (
          <p className="text-caption text-muted-foreground">Nenhuma chave gerada ainda.</p>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <KeyRound className="size-3.5 text-muted-foreground" />
                <div>
                  <p className="text-body font-medium text-foreground">{key.name}</p>
                  <p className="text-caption text-muted-foreground">
                    {key.keyPrefix}••••••• · criada em {new Date(key.createdAt).toLocaleDateString("pt-BR")}
                    {key.lastUsedAt ? ` · último uso em ${new Date(key.lastUsedAt).toLocaleDateString("pt-BR")}` : " · nunca usada"}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Revogar chave" onClick={() => setKeyPendingRevoke(key)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Nome da chave (ex.: Claude, ChatGPT)"
          className="max-w-64"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <Button variant="outline" onClick={handleCreate} disabled={creating || !newKeyName.trim()}>
          {creating ? "Gerando..." : "Gerar chave"}
        </Button>
      </div>

      <Dialog open={revealedKey != null} onOpenChange={(open) => !open && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sua chave de API</DialogTitle>
            <DialogDescription>
              Copie agora — por segurança, ela não pode ser mostrada de novo. Se perder, revogue e gere outra.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={revealedKey ?? ""} className="font-mono text-caption" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copiar chave"
              onClick={() => {
                if (revealedKey) {
                  navigator.clipboard.writeText(revealedKey);
                  toast.success("Chave copiada.");
                }
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Já copiei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={keyPendingRevoke != null} onOpenChange={(open) => !open && setKeyPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar chave &quot;{keyPendingRevoke?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Qualquer assistente de IA usando essa chave perde acesso imediatamente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => keyPendingRevoke && handleRevoke(keyPendingRevoke)}>Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
