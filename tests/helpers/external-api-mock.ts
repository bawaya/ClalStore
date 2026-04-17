/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// ───── GSMArena ─────

export const gsmarenaMockResponses = {
  search: {
    data: [
      { id: "apple_iphone_15-12559", name: "Apple iPhone 15", brand: "Apple", img: "https://gsmarena.test/img/iphone15.jpg" },
      { id: "apple_iphone_15_pro-12548", name: "Apple iPhone 15 Pro", brand: "Apple", img: "https://gsmarena.test/img/iphone15pro.jpg" },
    ],
    status: "OK",
  },
  details: {
    data: {
      name: "Apple iPhone 15",
      brand: "Apple",
      release_date: "2025-09-22",
      specifications: {
        display: "6.1 inches, Super Retina XDR OLED",
        processor: "Apple A16 Bionic",
        ram: "6 GB",
        storage: "128GB / 256GB / 512GB",
        camera_main: "48 MP, f/1.6",
        battery: "3349 mAh",
        os: "iOS 17",
      },
      colors: [
        { name: "Black", hex: "#000000" },
        { name: "Blue", hex: "#0066CC" },
      ],
      images: ["https://gsmarena.test/img/iphone15_1.jpg", "https://gsmarena.test/img/iphone15_2.jpg"],
    },
  },
};

export function mockGSMArenaSearch(results = gsmarenaMockResponses.search.data) {
  return vi.fn().mockResolvedValue({ data: results, status: "OK" });
}

export function mockGSMArenaDetails(data = gsmarenaMockResponses.details.data) {
  return vi.fn().mockResolvedValue({ data });
}

// ───── MobileAPI ─────

export const mobileApiMockResponses = {
  search: {
    results: [
      { device_id: "iphone-15", name: "iPhone 15", brand: "Apple", year: 2025 },
      { device_id: "iphone-15-pro", name: "iPhone 15 Pro", brand: "Apple", year: 2025 },
    ],
  },
  details: {
    device_id: "iphone-15",
    name: "iPhone 15",
    brand: "Apple",
    specs: {
      display_size: "6.1",
      display_resolution: "2556x1179",
      chipset: "Apple A16 Bionic",
      ram: "6GB",
      storage: ["128GB", "256GB", "512GB"],
    },
    images: [{ url: "https://mobileapi.test/img/iphone15.jpg" }],
  },
};

export function mockMobileAPISearch(results = mobileApiMockResponses.search.results) {
  return vi.fn().mockResolvedValue({ results });
}

export function mockMobileAPIDetails(data = mobileApiMockResponses.details) {
  return vi.fn().mockResolvedValue(data);
}

// ───── Pexels ─────

export const pexelsMockResponses = {
  search: {
    photos: [
      { id: 1, src: { large: "https://pexels.test/1.jpg", medium: "https://pexels.test/1m.jpg" }, alt: "iPhone" },
      { id: 2, src: { large: "https://pexels.test/2.jpg", medium: "https://pexels.test/2m.jpg" }, alt: "Samsung" },
    ],
    total_results: 2,
    page: 1,
    per_page: 15,
  },
};

export function mockPexelsSearch(photos = pexelsMockResponses.search.photos) {
  return vi.fn().mockResolvedValue({ ...pexelsMockResponses.search, photos });
}

// ───── RemoveBG ─────

export function mockRemoveBGProcess() {
  const buffer = new ArrayBuffer(1024);
  return vi.fn().mockResolvedValue({
    imageBuffer: buffer,
    contentType: "image/png",
    width: 400,
    height: 400,
  });
}

// ───── combined fetch mock ─────

export function installExternalApiFetchMock() {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    const urlStr = typeof url === "string" ? url : "";

    if (urlStr.includes("gsmarena")) {
      return { ok: true, status: 200, json: async () => gsmarenaMockResponses.search, text: async () => "<html>mocked</html>" };
    }
    if (urlStr.includes("mobileapi") || urlStr.includes("mobile-api")) {
      return { ok: true, status: 200, json: async () => mobileApiMockResponses.details };
    }
    if (urlStr.includes("pexels.com")) {
      return { ok: true, status: 200, json: async () => pexelsMockResponses.search };
    }
    if (urlStr.includes("remove.bg") || urlStr.includes("removebg")) {
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(1024) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
