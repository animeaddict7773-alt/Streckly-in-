import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useAllDailyLogs() {
  return useQuery({
    queryKey: ['/api/daily-logs'],
    queryFn: async () => {
      const res = await fetch('/api/daily-logs', { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch daily logs");
      return res.json();
    },
  });
}

export function useDailyLog(date: string) {
  return useQuery({
    queryKey: [api.dailyLogs.get.path, date],
    queryFn: async () => {
      const url = buildUrl(api.dailyLogs.get.path, { date });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch daily log");
      return res.json();
    },
    enabled: !!date,
  });
}

export function useUpdateDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ date, ...updates }: { date: string; notes?: string; oneTimeTasks?: any }) => {
      const url = buildUrl(api.dailyLogs.update.path, { date });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update daily log");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.dailyLogs.get.path, variables.date] });
      queryClient.invalidateQueries({ queryKey: ['/api/daily-logs'] });
    },
  });
}
