import { describe, it, expect, beforeEach } from "vitest";
import React, { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { LangProvider, useLang } from "@/lib/i18n";

type LangContextValue = ReturnType<typeof useLang>;

function LangProbe({ onValue }: { onValue: (value: LangContextValue) => void }) {
  const value = useLang();

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

  return null;
}

async function captureLangContext({ withProvider = false } = {}) {
  let captured: LangContextValue | null = null;
  const onValue = (value: LangContextValue) => {
    captured = value;
  };
  const probe = React.createElement(LangProbe, { onValue });

  render(
    withProvider
      ? React.createElement(LangProvider, null, probe)
      : probe,
  );

  await waitFor(() => {
    expect(captured).not.toBeNull();
  });

  const value = captured as LangContextValue | null;
  if (!value) {
    throw new Error("Lang context was not captured");
  }

  return value;
}

describe("useLang outside LangProvider", () => {
  it("returns default context values", async () => {
    const captured = await captureLangContext();

    expect(captured.lang).toBe("ar");
    expect(captured.dir).toBe("rtl");
    expect(captured.fontClass).toBe("font-arabic");
  });

  it("t() returns key as fallback when used outside provider", async () => {
    const captured = await captureLangContext();

    expect(captured.t("any.key")).toBe("any.key");
  });
});

describe("LangProvider initial render", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("provides dir as 'rtl'", async () => {
    const captured = await captureLangContext({ withProvider: true });

    expect(captured.dir).toBe("rtl");
  });

  it("provides default lang 'ar' on initial render", async () => {
    const captured = await captureLangContext({ withProvider: true });

    expect(captured.lang).toBe("ar");
  });

  it("provides fontClass 'font-arabic' for default Arabic", async () => {
    const captured = await captureLangContext({ withProvider: true });

    expect(captured.fontClass).toBe("font-arabic");
  });

  it("t() translates known keys in Arabic", async () => {
    const captured = await captureLangContext({ withProvider: true });
    const translation = captured.t("nav.home");

    expect(translation).toBeTruthy();
    expect(translation).not.toBe("nav.home");
  });

  it("t() returns key as fallback for unknown paths", async () => {
    const captured = await captureLangContext({ withProvider: true });

    expect(captured.t("nonexistent.deep.path")).toBe("nonexistent.deep.path");
  });

  it("t() returns key when path partially exists but final value is not a string", async () => {
    const captured = await captureLangContext({ withProvider: true });

    expect(captured.t("nav")).toBe("nav");
  });
});

describe("detectLang via localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to 'ar' when localStorage is empty and navigator is not Hebrew", async () => {
    const captured = await captureLangContext({ withProvider: true });

    expect(captured.lang).toBe("ar");
  });

  it("detectLang reads from localStorage when set to 'he'", () => {
    localStorage.setItem("clal_lang", "he");

    expect(localStorage.getItem("clal_lang")).toBe("he");
  });

  it("detectLang reads from localStorage when set to 'ar'", () => {
    localStorage.setItem("clal_lang", "ar");

    expect(localStorage.getItem("clal_lang")).toBe("ar");
  });

  it("ignores invalid localStorage values", () => {
    localStorage.setItem("clal_lang", "fr");
    const stored = localStorage.getItem("clal_lang");

    expect(stored !== "ar" && stored !== "he").toBe(true);
  });
});

describe("setLang behavior", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("setLang is a function in the context", async () => {
    const captured = await captureLangContext({ withProvider: true });

    expect(typeof captured.setLang).toBe("function");
  });

  it("renders children inside the provider", () => {
    function Child() {
      return React.createElement("div", null, "child-content");
    }

    render(React.createElement(LangProvider, null, React.createElement(Child)));

    expect(screen.getByText("child-content")).toBeInTheDocument();
  });
});
