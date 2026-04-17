/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient, makeTask } from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const task = makeTask({ id: "t1", title: "Follow up", status: "pending" });

// ── Mocks ─────────────────────────────────────────────
const mockGetCRMTasks = vi.fn().mockResolvedValue([task]);
const mockCreateTask = vi.fn().mockResolvedValue(task);
const mockUpdateTask = vi.fn().mockResolvedValue(undefined);
const mockDeleteTask = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/crm/queries", () => ({
  getCRMTasks: (...args: any[]) => mockGetCRMTasks(...args),
  createTask: (...args: any[]) => mockCreateTask(...args),
  updateTask: (...args: any[]) => mockUpdateTask(...args),
  deleteTask: (...args: any[]) => mockDeleteTask(...args),
}));

vi.mock("@/lib/supabase", () => {
  const client = createMockSupabaseClient();
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
});

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    }),
  };
});

// ── Imports ───────────────────────────────────────────
import { GET, POST, PUT, DELETE } from "@/app/api/crm/tasks/route";

// ── Tests ─────────────────────────────────────────────

describe("CRM Tasks — /api/crm/tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns tasks list", async () => {
      const req = createMockRequest({ url: "/api/crm/tasks" });
      const res = await GET(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockGetCRMTasks).toHaveBeenCalled();
    });

    it("passes filters to query", async () => {
      const req = createMockRequest({
        url: "/api/crm/tasks",
        searchParams: { status: "todo", assignedTo: "u1", limit: "10" },
      });
      await GET(req);
      expect(mockGetCRMTasks).toHaveBeenCalledWith(
        expect.objectContaining({ status: "todo", assignedTo: "u1", limit: 10 }),
      );
    });
  });

  describe("POST", () => {
    it("creates a task", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/tasks",
        body: { title: "New task", priority: "high" },
      });
      const res = await POST(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCreateTask).toHaveBeenCalled();
    });

    it("returns 400 for missing title", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/tasks",
        body: { priority: "high" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid priority", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/tasks",
        body: { title: "Test", priority: "extreme" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("PUT", () => {
    it("updates a task", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/tasks",
        body: { id: "t1", status: "done" },
      });
      const res = await PUT(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpdateTask).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "done" }));
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/tasks",
        body: { status: "done" },
      });
      const res = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE", () => {
    it("deletes a task", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/crm/tasks",
        searchParams: { id: "t1" },
      });
      const res = await DELETE(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockDeleteTask).toHaveBeenCalledWith("t1");
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({ method: "DELETE", url: "/api/crm/tasks" });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });
});
