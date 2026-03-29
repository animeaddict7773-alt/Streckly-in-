import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useBadges() {
  return useQuery({
    queryKey: [api.badges.list.path],
    queryFn: async () => {
      const res = await fetch(api.badges.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch badges");
      return res.json();
    },
  });
}
