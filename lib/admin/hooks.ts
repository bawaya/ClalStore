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
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await fetchData();
      return json.data;
    } catch (err: any) {
      const msg = err.message || "خطأ في الإنشاء";
      setError(msg);
      throw err;
    }
  };

  const update = async (id: string, updates: Partial<T>) => {
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await fetchData();
      return json.data;
    } catch (err: any) {
      const msg = err.message || "خطأ في التحديث";
      setError(msg);
      throw err;
    }
  };

  const remove = async (id: string) => {
    setError("");
    try {
      const res = await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await fetchData();
    } catch (err: any) {
      const msg = err.message || "خطأ في الحذف";
      setError(msg);
      throw err;
    }
  };

  const clearError = useCallback(() => setError(""), []);

  return { data, loading, error, clearError, fetchData, create, update, remove };
}

// Settings-specific hook
export function useAdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSettings(json.settings || {});
      setIntegrations(json.integrations || []);
    } catch (err: any) {
      setError(err.message || "خطأ في جلب الإعدادات");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "setting", key, value }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch (err: any) {
      setError(err.message || "خطأ في تحديث الإعداد");
      throw err;
    }
  };

  const updateIntegration = async (id: string, updates: any) => {
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "integration", id, updates }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await fetchSettings();
    } catch (err: any) {
      setError(err.message || "خطأ في تحديث التكامل");
      throw err;
    }
  };

  const clearError = useCallback(() => setError(""), []);

  return { settings, integrations, loading, error, clearError, fetchSettings, updateSetting, updateIntegration };
}
