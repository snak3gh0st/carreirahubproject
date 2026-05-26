"use client";
import { useQuery } from "@tanstack/react-query";

export type DigisacThreadPreview = {
  id: string;
  displayName: string;
  phoneNumber: string;
  needsReply: boolean;
  lastMessageAt: string | null;
  latestMessage: {
    content: string;
    direction: "INBOUND" | "OUTBOUND" | "SYSTEM";
    externalCreatedAt: string | null;
    createdAt: string;
  } | null;
  customer: { id: string; name: string } | null;
  enrollment: { id: string } | null;
};

type DigisacListResponse = {
  config: { enabled: boolean; missing: string[] };
  stats: { total: number; needsReply: number; unmatched: number; activeEnrollments: number };
  threads: DigisacThreadPreview[];
  migrationRequired?: boolean;
};

export function useOpsDigisacUnread() {
  const query = useQuery<DigisacListResponse>({
    queryKey: ["ops-digisac-threads"],
    queryFn: async () => {
      const res = await fetch("/api/ops/digisac");
      if (!res.ok) throw new Error("Falha ao carregar Digisac.");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const unreadCount = query.data?.stats.needsReply ?? 0;
  const threads = query.data?.threads ?? [];
  const enabled = query.data?.config.enabled !== false;
  const migrationRequired = query.data?.migrationRequired ?? false;

  return { unreadCount, threads, enabled, migrationRequired, isLoading: query.isLoading };
}
