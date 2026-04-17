import { describe, it, expect } from "vitest";
import {
  resolveConfig,
  CLALMOBILE_CONFIG,
  EZORDER_CONFIG,
  FATIMA_AI_CONFIG,
  DEFAULT_COLORS,
  type BrandConfig,
} from "@/lib/brand-config";

// ─────────────────────────────────────────────
// resolveConfig
// ─────────────────────────────────────────────
describe("resolveConfig", () => {
  it("fills in default apiPrefix when not specified", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "" };
    const resolved = resolveConfig(config);
    expect(resolved.apiPrefix).toBe("/api");
  });

  it("preserves explicit apiPrefix", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "", apiPrefix: "/v2" };
    const resolved = resolveConfig(config);
    expect(resolved.apiPrefix).toBe("/v2");
  });

  it("fills in default currency when not specified", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "" };
    const resolved = resolveConfig(config);
    expect(resolved.currency).toBe("\u20AA");
  });

  it("preserves explicit currency", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "", currency: "$" };
    const resolved = resolveConfig(config);
    expect(resolved.currency).toBe("$");
  });

  it("fills in default locale when not specified", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "" };
    const resolved = resolveConfig(config);
    expect(resolved.locale).toBe("ar-EG");
  });

  it("preserves explicit locale", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "", locale: "en-US" };
    const resolved = resolveConfig(config);
    expect(resolved.locale).toBe("en-US");
  });

  it("fills in default direction when not specified", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "" };
    const resolved = resolveConfig(config);
    expect(resolved.direction).toBe("rtl");
  });

  it("preserves explicit direction", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "", direction: "ltr" };
    const resolved = resolveConfig(config);
    expect(resolved.direction).toBe("ltr");
  });

  it("merges colors with DEFAULT_COLORS", () => {
    const config: BrandConfig = {
      name: "Test",
      logo: "T",
      baseUrl: "",
      colors: { brand: "#ff0000" },
    };
    const resolved = resolveConfig(config);
    expect(resolved.colors.brand).toBe("#ff0000"); // overridden
    expect(resolved.colors.accent).toBe(DEFAULT_COLORS.accent); // default
    expect(resolved.colors.gold).toBe(DEFAULT_COLORS.gold); // default
    expect(resolved.colors.cyan).toBe(DEFAULT_COLORS.cyan); // default
    expect(resolved.colors.teal).toBe(DEFAULT_COLORS.teal); // default
  });

  it("uses all DEFAULT_COLORS when no colors provided", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "" };
    const resolved = resolveConfig(config);
    expect(resolved.colors).toEqual(DEFAULT_COLORS);
  });

  it("merges features with defaults (all true)", () => {
    const config: BrandConfig = {
      name: "Test",
      logo: "T",
      baseUrl: "",
      features: { inbox: false },
    };
    const resolved = resolveConfig(config);
    expect(resolved.features.inbox).toBe(false); // overridden
    expect(resolved.features.dashboard).toBe(true); // default
    expect(resolved.features.kanban).toBe(true); // default
    expect(resolved.features.finance).toBe(true); // default
    expect(resolved.features.analytics).toBe(true); // default
  });

  it("enables all features when no features provided", () => {
    const config: BrandConfig = { name: "Test", logo: "T", baseUrl: "" };
    const resolved = resolveConfig(config);
    expect(resolved.features).toEqual({
      dashboard: true,
      kanban: true,
      finance: true,
      analytics: true,
      inbox: true,
    });
  });

  it("preserves name, logo, tagline, baseUrl", () => {
    const config: BrandConfig = {
      name: "MyBrand",
      logo: "M",
      tagline: "Best brand",
      baseUrl: "https://mybrand.com",
    };
    const resolved = resolveConfig(config);
    expect(resolved.name).toBe("MyBrand");
    expect(resolved.logo).toBe("M");
    expect(resolved.tagline).toBe("Best brand");
    expect(resolved.baseUrl).toBe("https://mybrand.com");
  });
});

// ─────────────────────────────────────────────
// Brand configs
// ─────────────────────────────────────────────
describe("CLALMOBILE_CONFIG", () => {
  it("has correct name", () => {
    expect(CLALMOBILE_CONFIG.name).toBe("ClalMobile Command Center");
  });

  it("has brand color #c41040", () => {
    expect(CLALMOBILE_CONFIG.colors?.brand).toBe("#c41040");
  });

  it("uses shekel currency", () => {
    expect(CLALMOBILE_CONFIG.currency).toBe("\u20AA");
  });

  it("is RTL direction", () => {
    expect(CLALMOBILE_CONFIG.direction).toBe("rtl");
  });

  it("has all features enabled", () => {
    expect(CLALMOBILE_CONFIG.features?.dashboard).toBe(true);
    expect(CLALMOBILE_CONFIG.features?.inbox).toBe(true);
  });

  it("resolves to a complete config", () => {
    const resolved = resolveConfig(CLALMOBILE_CONFIG);
    expect(resolved.apiPrefix).toBe("/api");
    expect(resolved.colors.brand).toBe("#c41040");
  });
});

describe("EZORDER_CONFIG", () => {
  it("has correct name", () => {
    expect(EZORDER_CONFIG.name).toBe("EZOrder Dashboard");
  });

  it("has inbox disabled", () => {
    expect(EZORDER_CONFIG.features?.inbox).toBe(false);
  });

  it("resolves correctly with inbox disabled", () => {
    const resolved = resolveConfig(EZORDER_CONFIG);
    expect(resolved.features.inbox).toBe(false);
    expect(resolved.features.dashboard).toBe(true);
  });
});

describe("FATIMA_AI_CONFIG", () => {
  it("has correct name", () => {
    expect(FATIMA_AI_CONFIG.name).toBe("Fatima.AI Dashboard");
  });

  it("has all features enabled", () => {
    const resolved = resolveConfig(FATIMA_AI_CONFIG);
    expect(resolved.features.inbox).toBe(true);
    expect(resolved.features.dashboard).toBe(true);
  });
});

// ─────────────────────────────────────────────
// DEFAULT_COLORS
// ─────────────────────────────────────────────
describe("DEFAULT_COLORS", () => {
  it("defines all five color keys", () => {
    expect(DEFAULT_COLORS).toHaveProperty("brand");
    expect(DEFAULT_COLORS).toHaveProperty("accent");
    expect(DEFAULT_COLORS).toHaveProperty("gold");
    expect(DEFAULT_COLORS).toHaveProperty("cyan");
    expect(DEFAULT_COLORS).toHaveProperty("teal");
  });

  it("all colors are valid hex strings", () => {
    for (const color of Object.values(DEFAULT_COLORS)) {
      expect(/^#[0-9a-fA-F]{6}$/.test(color)).toBe(true);
    }
  });
});
