"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NOTIFICATIONS_QUERY_KEY } from "./query-keys";

export interface AppNotification {
  id: number;
  type: string;
  title?: string;
  body?: string;
  payload: Record<string, unknown>;
  receiptId?: string;
  readAt?: string;
  createdAt: string;
}

interface NotificationsData {
  notifications: AppNotification[];
  unreadCount: number;
}

async function fetchNotificationsData(): Promise<NotificationsData> {
  const res = await fetch("/api/user/notifications", {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return { notifications: [], unreadCount: 0 };
  const data = await res.json();
  return {
    notifications: data.notifications ?? [],
    unreadCount: data.unreadCount ?? 0,
  };
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotificationsData,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  }, [queryClient]);

  const markRead = useCallback(
    async (id: number) => {
      // Optimistic update: remove clicked notification from list.
      queryClient.setQueryData<NotificationsData>(NOTIFICATIONS_QUERY_KEY, (old) => {
        if (!old) return old;
        const removed = old.notifications.find((n) => n.id === id);
        const wasUnread = Boolean(removed && !removed.readAt);
        return {
          notifications: old.notifications.filter((n) => n.id !== id),
          unreadCount: Math.max(0, old.unreadCount - (wasUnread ? 1 : 0)),
        };
      });
      try {
        await fetch("/api/user/notifications", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        // On error, sync with server state.
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      }
    },
    [queryClient]
  );

  const markAllRead = useCallback(async () => {
    queryClient.setQueryData<NotificationsData>(NOTIFICATIONS_QUERY_KEY, (old) => {
      if (!old) return old;
      return {
        notifications: old.notifications.map((n) => ({
          ...n,
          readAt: n.readAt ?? new Date().toISOString(),
        })),
        unreadCount: 0,
      };
    });
    try {
      await fetch("/api/user/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    }
  }, [queryClient]);

  return {
    notifications,
    unreadCount,
    loading,
    refetch,
    markRead,
    markAllRead,
  };
}
