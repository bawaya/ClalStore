import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { InboxStats } from "@/lib/crm/inbox-types";

import { InboxStatsBar } from "@/components/crm/inbox/InboxStats";

describe("InboxStatsBar", () => {
  it("renders nothing when stats is null", () => {
    const { container } = render(<InboxStatsBar stats={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders without crashing with valid stats", () => {
    const stats: InboxStats = {
      total_conversations: 100,
      active: 12,
      waiting: 5,
      bot: 3,
      resolved_today: 8,
      messages_today: 45,
      unread_total: 7,
    };
    render(<InboxStatsBar stats={stats} />);
    expect(screen.getByText("نشطة")).toBeInTheDocument();
  });

  it("displays active count", () => {
    const stats: InboxStats = {
      total_conversations: 100,
      active: 12,
      waiting: 5,
      bot: 3,
      resolved_today: 8,
      messages_today: 45,
      unread_total: 7,
    };
    render(<InboxStatsBar stats={stats} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("نشطة")).toBeInTheDocument();
  });

  it("displays waiting count", () => {
    const stats: InboxStats = {
      total_conversations: 100,
      active: 12,
      waiting: 5,
      bot: 3,
      resolved_today: 8,
      messages_today: 45,
      unread_total: 7,
    };
    render(<InboxStatsBar stats={stats} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("بانتظار")).toBeInTheDocument();
  });

  it("displays bot count", () => {
    const stats: InboxStats = {
      total_conversations: 100,
      active: 12,
      waiting: 5,
      bot: 3,
      resolved_today: 8,
      messages_today: 45,
      unread_total: 7,
    };
    render(<InboxStatsBar stats={stats} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("بوت")).toBeInTheDocument();
  });

  it("displays resolved today count", () => {
    const stats: InboxStats = {
      total_conversations: 100,
      active: 12,
      waiting: 5,
      bot: 3,
      resolved_today: 8,
      messages_today: 45,
      unread_total: 7,
    };
    render(<InboxStatsBar stats={stats} />);
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("محلولة اليوم")).toBeInTheDocument();
  });

  it("renders all 4 stat items", () => {
    const stats: InboxStats = {
      total_conversations: 100,
      active: 0,
      waiting: 0,
      bot: 0,
      resolved_today: 0,
      messages_today: 0,
      unread_total: 0,
    };
    render(<InboxStatsBar stats={stats} />);
    const labels = ["نشطة", "بانتظار", "بوت", "محلولة اليوم"];
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("renders with grid layout (4 columns)", () => {
    const stats: InboxStats = {
      total_conversations: 100,
      active: 10,
      waiting: 3,
      bot: 1,
      resolved_today: 5,
      messages_today: 20,
      unread_total: 4,
    };
    const { container } = render(<InboxStatsBar stats={stats} />);
    const grid = container.querySelector(".grid-cols-4");
    expect(grid).toBeInTheDocument();
  });

  it("shows colored dots for each stat", () => {
    const stats: InboxStats = {
      total_conversations: 100,
      active: 10,
      waiting: 3,
      bot: 1,
      resolved_today: 5,
      messages_today: 20,
      unread_total: 4,
    };
    const { container } = render(<InboxStatsBar stats={stats} />);
    expect(container.querySelector(".bg-green-500")).toBeInTheDocument();
    expect(container.querySelector(".bg-yellow-500")).toBeInTheDocument();
    expect(container.querySelector(".bg-blue-500")).toBeInTheDocument();
    expect(container.querySelector(".bg-gray-500")).toBeInTheDocument();
  });
});
