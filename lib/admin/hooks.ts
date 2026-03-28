// =====================================================
// ClalMobile — Admin API Hook
// Reusable CRUD operations for admin panels
// =====================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

interface PaginationState {
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
  page: number;
}

interface UseAdminApiOptions<_T> {
  endpoint: string;
  autoFetch?: boolean;
  paginate?: { limit: number };
}

export function useAdminApi<T>({ endpoint, autoFetch = true, paginate }: UseAdminApiOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const initialLoadDone = useRef(false);
  const [pagination, setPagination] = useState<PaginationState | null>(
    paginate ? { limit: paginate.limit, offset: 0, total: 0, totalPages: 0, page: 1 } : null
  );

  const fetchData = useCallback(async (silent = false, overrideOffset?: number) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      let url = endpoint;
      if (paginate) {
        const offset = overrideOffset ?? pagination?.offset ?? 0;
        const sep = endpoint.includes("?") ? "&" : "?";
        url = `${endpoint}${sep}limit=${paginate.limit}&offset=${offset}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data || []);
      if (json.pagination) {
        setPagination({
          limit: json.pagination.limit,
          offset: json.pagination.offset,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
          page: Math.floor(json.pagination.offset / json.pagination.limit) + 1,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في جلب البيانات");
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [endpoint, paginate, pagination?.offset]);

  useEffect(() => {
    if (autoFetch) fetchData();
  }, [autoFetch, fetchData]);

  const silentRefresh = useCallback(() => fetchData(true), [fetchData]);

  const create = async (item: Partial<T>) => {
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(item),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await silentRefresh();
      return json.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ في الإنشاء";
      setError(msg);
      throw err;
    }
  };

  const update = async (id: string, updates: Partial<T>) => {
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ id, ...updates }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await silentRefresh();
      return json.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ في التحديث";
      setError(msg);
      throw err;
    }
  };

  const remove = async (id: string) => {
    setError("");
    try {
      const res = await fetch(`${endpoint}?id=${id}`, { method: "DELETE", headers: csrfHeaders() });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await silentRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ في الحذف";
      setError(msg);
      throw err;
    }
  };

  const bulkRemove = async (ids: string[]) => {
    setError("");
    try {
      const res = await fetch(`${endpoint}?ids=${ids.join(",")}`, { method: "DELETE", headers: csrfHeaders() });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await silentRefresh();
      return json.deleted as number;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "خطأ في الحذف الجماعي";
      setError(msg);
      throw err;
    }
  };

  const clearError = useCallback(() => setError(""), []);

  const setPage = useCallback((page: number) => {
    if (!paginate) return;
    const newOffset = (page - 1) * paginate.limit;
    setPagination((prev) => prev ? { ...prev, offset: newOffset, page } : prev);
    fetchData(false, newOffset);
  }, [paginate, fetchData]);

  return { data, loading, error, clearError, fetchData, create, update, remove, bulkRemove, pagination, setPage };
}

// Settings-specific hook
export function useAdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSettings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSettings(json.settings || {});
      setIntegrations(json.integrations || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في جلب الإعدادات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = async (key: string, value: string) => {
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ type: "setting", key, value }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في تحديث الإعداد");
      throw err;
    }
  };

  const updateIntegration = async (id: string, updates: any) => {
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ type: "integration", id, updates }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await fetchSettings(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ في تحديث التكامل");
      throw err;
    }
  };

  const clearError = useCallback(() => setError(""), []);

  return { settings, integrations, loading, error, clearError, fetchSettings, updateSetting, updateIntegration };
}
