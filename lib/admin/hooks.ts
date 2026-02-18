// =====================================================
// ClalMobile — Admin API Hook
// Reusable CRUD operations for admin panels
// =====================================================

"use client";

import { useState, useEffect, useCallback } from "react";

interface UseAdminApiOptions<T> {
  endpoint: string;
  autoFetch?: boolean;
}

export function useAdminApi<T>({ endpoint, autoFetch = true }: UseAdminApiOptions<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data || []);
    } catch (err: any) {
      setError(err.message || "خطأ في جلب البيانات");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (autoFetch) fetchData();
  }, [autoFetch, fetchData]);

  const create = async (item: Partial<T>) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    await fetchData();
    return json.data;
  };

  const update = async (id: string, updates: Partial<T>) => {
    const res = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    await fetchData();
    return json.data;
  };

  const remove = async (id: string) => {
    const res = await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    await fetchData();
  };

  return { data, loading, error, fetchData, create, update, remove };
}

// Settings-specific hook
export function useAdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      setSettings(json.settings || {});
      setIntegrations(json.integrations || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSetting = async (key: string, value: string) => {
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "setting", key, value }),
    });
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateIntegration = async (id: string, updates: any) => {
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "integration", id, updates }),
    });
    await fetchSettings();
  };

  return { settings, integrations, loading, fetchSettings, updateSetting, updateIntegration };
}
