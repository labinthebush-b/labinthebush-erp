"use client";

import * as React from "react";
import { createClient } from "./client";

export type SupabaseUserState = {
  /**
   * The account whose data this login works on: the login itself, or the owner
   * when it's a member of a shared account (see 0006_shared_account.sql). Every
   * row is read and written under this id.
   */
  userId: string | undefined;
  /** The email of the login itself, even on a shared account. */
  email: string | undefined;
  /** True until the first session check resolves. Every domain provider waits on this before fetching. */
  loading: boolean;
};

const accountIds = new Map<string, Promise<string | undefined>>();

/** Resolved once per login, since every provider uses this hook. A failed lookup isn't cached, so it can be retried. */
function resolveAccountId(authUserId: string): Promise<string | undefined> {
  let accountId = accountIds.get(authUserId);
  if (!accountId) {
    accountId = Promise.resolve(createClient().rpc("current_account_id")).then(({ data, error }) => {
      if (error || !data) {
        accountIds.delete(authUserId);
        return undefined;
      }
      return data as string;
    });
    accountIds.set(authUserId, accountId);
  }
  return accountId;
}

/**
 * The single source of "who is signed in" for every domain provider — each
 * one waits for `loading === false` before fetching its Supabase-backed
 * state, and re-fetches whenever `userId` changes (sign-in/sign-out).
 */
export function useSupabaseUser(): SupabaseUserState {
  const [state, setState] = React.useState<SupabaseUserState>({
    userId: undefined,
    email: undefined,
    loading: true,
  });

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;
    let latest = 0;

    async function apply(user: { id: string; email?: string } | null | undefined) {
      const run = ++latest;
      const userId = user ? await resolveAccountId(user.id) : undefined;
      if (active && run === latest) setState({ userId, email: user?.email, loading: false });
    }

    supabase.auth.getUser().then(({ data }) => apply(data.user));

    // setTimeout: the Supabase client deadlocks if its own auth callback waits
    // on another Supabase call.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void apply(session?.user), 0);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
