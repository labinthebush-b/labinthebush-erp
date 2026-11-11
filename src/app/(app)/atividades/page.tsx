"use client";

import * as React from "react";
import { Bot } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { actorInitials, describeActivity, viaLabel } from "@/lib/activity/format";
import { fetchAccountProfiles, fetchActivity, type ActivityEntry, type UserProfile } from "@/lib/activity/repository";
import { useSupabaseUser } from "@/lib/supabase/use-supabase-user";

const PAGE_SIZE = 100;

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default function AtividadesPage() {
  const { userId } = useSupabaseUser();
  const [entries, setEntries] = React.useState<ActivityEntry[] | null>(null);
  const [profiles, setProfiles] = React.useState<UserProfile[]>([]);
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([fetchActivity(userId, limit), fetchAccountProfiles(userId)])
      .then(([nextEntries, nextProfiles]) => {
        if (cancelled) return;
        setEntries(nextEntries);
        setProfiles(nextProfiles);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Atividades" description="Quem adicionou, editou ou apagou o quê no ERP." />
      <Card>
        <CardContent className="flex flex-col gap-4">
          {failed ? <p className="text-sm text-muted-foreground">Não foi possível carregar as atividades.</p> : null}
          {!failed && entries?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
          ) : null}
          {entries?.map((entry) => {
            const profile = profiles.find((p) => p.userId === entry.actorId);
            const name = entry.actorId ? profile?.displayName || entry.actorEmail || "Usuário" : "IA";
            const via = entry.actorId ? viaLabel(entry.via) : null;
            return (
              <div key={entry.id} className="flex items-center gap-3">
                <Avatar>
                  {profile?.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
                  <AvatarFallback>{entry.actorId ? actorInitials(name) : <Bot className="size-4" />}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm break-words">
                    <span className="font-medium">{name}</span>{" "}
                    {via ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Bot className="size-3.5" aria-hidden />
                        {via}
                      </span>
                    ) : null}{" "}
                    {describeActivity(entry.action, entry.entity, entry.summary)}
                  </p>
                  <p className="text-xs text-muted-foreground">{dateFormat.format(new Date(entry.createdAt))}</p>
                </div>
              </div>
            );
          })}
          {entries?.length === limit ? (
            <Button variant="outline" className="self-center" onClick={() => setLimit(limit + PAGE_SIZE)}>
              Carregar mais
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
