import type { Campaign, InstagramPostLink } from "./types";

export type CampaignsState = {
  campaigns: Campaign[];
  posts: InstagramPostLink[];
};

export const EMPTY_CAMPAIGNS_STATE: CampaignsState = { campaigns: [], posts: [] };

export type CampaignsAction =
  | { type: "HYDRATE"; state: CampaignsState }
  | { type: "ADD_CAMPAIGN"; campaign: Campaign }
  | { type: "UPDATE_CAMPAIGN"; id: string; changes: Partial<Campaign>; at: string }
  | { type: "DELETE_CAMPAIGN"; id: string; at: string }
  | { type: "LINK_POST"; postId: string; campaignId: string; at: string }
  | { type: "UNLINK_POST"; postId: string; at: string };

export function campaignsReducer(state: CampaignsState, action: CampaignsAction): CampaignsState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;

    case "ADD_CAMPAIGN":
      return { ...state, campaigns: [...state.campaigns, action.campaign] };

    case "UPDATE_CAMPAIGN":
      return {
        ...state,
        campaigns: state.campaigns.map((c) => (c.id === action.id ? { ...c, ...action.changes, updatedAt: action.at } : c)),
      };

    case "DELETE_CAMPAIGN":
      // Os posts continuam existindo (têm tags próprias), só deixam de apontar para a campanha.
      return {
        campaigns: state.campaigns.filter((c) => c.id !== action.id),
        posts: state.posts.map((p) => (p.campaignId === action.id ? { ...p, campaignId: undefined, updatedAt: action.at } : p)),
      };

    case "LINK_POST": {
      const existing = state.posts.find((p) => p.id === action.postId);
      if (existing) {
        if (existing.campaignId === action.campaignId) return state;
        return {
          ...state,
          posts: state.posts.map((p) => (p.id === action.postId ? { ...p, campaignId: action.campaignId, updatedAt: action.at } : p)),
        };
      }
      return {
        ...state,
        posts: [...state.posts, { id: action.postId, campaignId: action.campaignId, tags: [], createdAt: action.at, updatedAt: action.at }],
      };
    }

    case "UNLINK_POST":
      if (!state.posts.some((p) => p.id === action.postId && p.campaignId)) return state;
      return {
        ...state,
        posts: state.posts.map((p) => (p.id === action.postId ? { ...p, campaignId: undefined, updatedAt: action.at } : p)),
      };

    default:
      return state;
  }
}
