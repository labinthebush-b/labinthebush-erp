"use client";

import * as React from "react";
import type { Campaign, CampaignChannel, InstagramPostLink } from "./types";
import { EMPTY_CAMPAIGNS_STATE, campaignsReducer, type CampaignsAction, type CampaignsState } from "./campaigns-reducer";
import { useSupabaseReducer } from "@/lib/supabase/use-supabase-reducer";
import { diffById } from "@/lib/supabase/diff-collection";
import { deleteCampaigns, fetchCampaigns, fetchPostLinks, upsertCampaigns, upsertPostLinks } from "./repository";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

async function fetchInitial(userId: string): Promise<CampaignsState> {
  const [campaigns, posts] = await Promise.all([fetchCampaigns(userId), fetchPostLinks(userId)]);
  return { campaigns, posts };
}

async function sync(userId: string, previous: CampaignsState, next: CampaignsState): Promise<void> {
  const campaignsDiff = diffById(previous.campaigns, next.campaigns);
  // Posts nunca são apagados no banco: desvincular só limpa campaign_id (eles guardam tags próprias).
  const postsDiff = diffById(previous.posts, next.posts);
  await Promise.all([
    upsertCampaigns(userId, [...campaignsDiff.inserted, ...campaignsDiff.updated]),
    deleteCampaigns(userId, campaignsDiff.deletedIds),
    upsertPostLinks(userId, [...postsDiff.inserted, ...postsDiff.updated]),
  ]);
}

export type NewCampaignInput = {
  name: string;
  channel: CampaignChannel;
  startDate: string;
  endDate?: string;
  cost?: number;
  notes?: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
};

type CampaignsContextValue = {
  campaigns: Campaign[];
  posts: InstagramPostLink[];
  addCampaign: (input: NewCampaignInput) => Campaign;
  updateCampaign: (id: string, changes: Partial<NewCampaignInput>) => void;
  deleteCampaign: (id: string) => void;
  linkPost: (postId: string, campaignId: string) => void;
  unlinkPost: (postId: string) => void;
};

const CampaignsContext = React.createContext<CampaignsContextValue | null>(null);

export function CampaignsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useSupabaseReducer<CampaignsState, CampaignsAction>(
    campaignsReducer,
    EMPTY_CAMPAIGNS_STATE,
    (hydratedState) => ({ type: "HYDRATE" as const, state: hydratedState }),
    fetchInitial,
    sync
  );

  const value = React.useMemo<CampaignsContextValue>(
    () => ({
      campaigns: state.campaigns,
      posts: state.posts,
      addCampaign(input) {
        const timestamp = nowISO();
        const campaign: Campaign = { id: makeId(), ...input, createdAt: timestamp, updatedAt: timestamp };
        dispatch({ type: "ADD_CAMPAIGN", campaign });
        return campaign;
      },
      updateCampaign(id, changes) {
        dispatch({ type: "UPDATE_CAMPAIGN", id, changes, at: nowISO() });
      },
      deleteCampaign(id) {
        dispatch({ type: "DELETE_CAMPAIGN", id, at: nowISO() });
      },
      linkPost(postId, campaignId) {
        dispatch({ type: "LINK_POST", postId, campaignId, at: nowISO() });
      },
      unlinkPost(postId) {
        dispatch({ type: "UNLINK_POST", postId, at: nowISO() });
      },
    }),
    [state, dispatch]
  );

  return <CampaignsContext.Provider value={value}>{children}</CampaignsContext.Provider>;
}

export function useCampaigns() {
  const ctx = React.useContext(CampaignsContext);
  if (!ctx) throw new Error("useCampaigns must be used within a CampaignsProvider");
  return ctx;
}
