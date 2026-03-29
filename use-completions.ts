import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useCompletions() {
  return useQuery({
    queryKey: [api.completions.list.path],
    queryFn: async () => {
      const res = await fetch(api.completions.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch completions");
      return res.json();
    },
  });
}

export function useToggleCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { habitId: number; date: string }) => {
      const res = await fetch(api.completions.toggle.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to toggle completion");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.completions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.habits.list.path] });
    },
  });
}
