"use client";

import * as React from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { actorInitials } from "@/lib/activity/format";
import { fetchMyProfile, saveMyProfile, uploadAvatar, type UserProfile } from "@/lib/activity/repository";
import { useSupabaseUser } from "@/lib/supabase/use-supabase-user";

/** Name and photo of the signed-in login, shown next to what it does in Atividades. */
export function ProfilePanel() {
  const { userId: accountId, email } = useSupabaseUser();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((result) => {
        if (cancelled) return;
        setProfile(result);
        setName(result?.displayName ?? "");
      })
      .catch(() => toast.error("Não foi possível carregar seu perfil."));
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: UserProfile) {
    if (!accountId) return;
    setSaving(true);
    try {
      await saveMyProfile(accountId, next);
      setProfile(next);
      toast.success("Perfil salvo.");
    } catch {
      toast.error("Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profile) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A foto precisa ter até 2 MB.");
      return;
    }
    setSaving(true);
    try {
      const avatarUrl = await uploadAvatar(profile.userId, file);
      await save({ ...profile, avatarUrl });
    } catch {
      toast.error("Não foi possível enviar a foto. Use PNG, JPG ou WebP.");
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <label className="cursor-pointer" aria-label="Trocar foto">
        <Avatar className="size-16">
          {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
          <AvatarFallback>{actorInitials(name || email || "")}</AvatarFallback>
        </Avatar>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={saving}
          onChange={handlePhoto}
        />
      </label>
      <div className="flex-1">
        <Field label="Seu nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={email} />
        </Field>
      </div>
      <Button disabled={saving} onClick={() => save({ ...profile, displayName: name.trim() || null })}>
        Salvar
      </Button>
    </div>
  );
}
