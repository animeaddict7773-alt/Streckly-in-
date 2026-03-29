import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useSettings() {
  return useQuery({
    queryKey: [api.settings.get.path],
    queryFn: async () => {
      const res = await fetch(api.settings.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });
}

export type FeatureKey = 'analytics' | 'calendar' | 'dailyPlanner' | 'badges' | 'sharing' | 'adsDisabled';

export function useUnlockFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (feature: FeatureKey) => {
      const res = await fetch(api.settings.unlockFeature.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to unlock feature");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.settings.get.path], data);
    },
  });
}
