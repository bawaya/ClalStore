import { describe, it, expect, afterEach } from "vitest";
import { getPublicSiteUrl } from "@/lib/public-site-url";

describe("getPublicSiteUrl", () => {
  const snapshot = {
    app: process.env.NEXT_PUBLIC_APP_URL,
    site: process.env.NEXT_PUBLIC_SITE_URL,
    nodeEnv: process.env.NODE_ENV,
  };

  afterEach(() => {
    if (snapshot.app === undefined) delete (process.env as any).NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = snapshot.app;
    if (snapshot.site === undefined) delete (process.env as any).NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = snapshot.site;
    if (snapshot.nodeEnv === undefined) delete (process.env as any).NODE_ENV;
    else (process.env as any).NODE_ENV = snapshot.nodeEnv;
  });

  it("prefers NEXT_PUBLIC_APP_URL and strips trailing slashes", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://shop.example.com///";
    process.env.NEXT_PUBLIC_SITE_URL = "https://other.example.com";
    expect(getPublicSiteUrl()).toBe("https://shop.example.com");
  });

  it("falls back to NEXT_PUBLIC_SITE_URL when APP_URL unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://legacy.example.com";
    expect(getPublicSiteUrl()).toBe("https://legacy.example.com");
  });

  it("uses localhost in development when no URL env set", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    (process.env as any).NODE_ENV = "development";
    expect(getPublicSiteUrl()).toBe("http://localhost:3000");
  });

  it("uses production default when no URL env and not development", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    (process.env as any).NODE_ENV = "production";
    expect(getPublicSiteUrl()).toBe("https://clalmobile.com");
  });
});
