// Generates postman/ClalMobile-API-Layers.postman_collection.json from app/api routes.
// Run: node scripts/postman/build-collection.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { scanRoutes } from "./scan-routes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "../../postman/ClalMobile-API-Layers.postman_collection.json");

/** @param {string} p */
function idVarFor(p) {
  if (p.includes("/crm/inbox/")) return "crmInboxId";
  if (p.includes("/crm/chats/")) return "crmChatId";
  if (p.includes("/crm/customers/")) return "crmCustomerId";
  if (p.includes("/crm/pipeline/")) return "pipelineId";
  if (p.includes("/admin/sales-docs/")) return "salesDocId";
  if (p.includes("/admin/sales-requests/")) return "adminSalesRequestId";
  if (p.includes("/admin/corrections/")) return "adminCorrectionId";
  if (p.includes("/admin/orders/")) return "adminOrderId";
  if (p.includes("/customer/orders/")) return "customerOrderId";
  if (p.includes("/employee/announcements/")) return "employeeAnnouncementId";
  if (p.includes("/employee/sales-requests/")) return "employeeSalesRequestId";
  if (p.includes("/pwa/sales/")) return "pwaSaleId";
  return "resourceId";
}

/** @param {string} path - e.g. /api/crm/inbox/[id]/ */
function toUrlPath(path) {
  const idVar = idVarFor(path);
  return path.replace(/\[id\]/g, `{{${idVar}}}`).replace(/\/$/, "");
}

/** @param {string} p0 */
function layerName(p0) {
  const p = p0.replace(/\/$/, "");
  if (
    p === "/api/health" ||
    p === "/api/csrf" ||
    p === "/api/settings/public" ||
    p === "/api/push/vapid" ||
    p === "/api/reviews/featured"
  ) {
    return "0-Smoke-Public";
  }
  if (p.startsWith("/api/crm/")) return "4-CRM";
  if (p.startsWith("/api/admin/")) return "5-Admin";
  if (p.startsWith("/api/employee/") || p.startsWith("/api/pwa/")) return "6-Employee-SalesPWA";
  if (
    p.startsWith("/api/webhook/") ||
    p.startsWith("/api/cron/") ||
    p.startsWith("/api/reports/") ||
    p === "/api/email" ||
    p.includes("callback") ||
    p === "/api/push/send" ||
    p === "/api/push/subscribe"
  ) {
    return "7-Integrations-Ops";
  }
  if (p.startsWith("/api/customer/") || p.startsWith("/api/auth/")) return "3-Customer-Auth-GDPR";
  if (p.startsWith("/api/store/")) return "1-Store-Read-Model";
  return "2-Commerce-Messaging-Orders";
}

const CONTRACT_TEST = [
  "const code = pm.response.code;",
  "pm.test('No internal 500/502 (يُقبل 503 لخدمات اختيارية بدون مفاتيح مثل product-assistant)', function () {",
  "  pm.expect([500, 502].includes(code)).to.be.false;",
  "});",
  "const ct = (pm.response.headers.get('content-type') || '');",
  "if (ct.includes('application/json')) {",
  "  try {",
  "    const j = pm.response.json();",
  "    pm.test('JSON root is object or array', function () {",
  "      pm.expect(j).to.satisfy((x) => x !== null && typeof x === 'object');",
  "    });",
  "  } catch (e) { pm.test('JSON parseable', function () { pm.expect.fail('body not valid JSON'); }); }",
  "}",
].join("\n");

/**
 * @param {string} clean
 * @param {string} method
 */
function querySuffix(clean, method) {
  if (method !== "GET") return "";
  if (clean.startsWith("/api/store/autocomplete")) return "?q=phone&limit=5";
  if (clean.startsWith("/api/store/smart-search")) return "?q=xiaomi";
  if (clean.startsWith("/api/store/order-status")) return "?order=00000000-0000-0000-0000-000000000000";
  if (clean.startsWith("/api/reports/daily") || clean.startsWith("/api/reports/weekly")) {
    return "?secret={{cronSecret}}&date=2025-01-15";
  }
  if (clean.startsWith("/api/cron/reports") && method === "GET") return "?secret={{cronSecret}}";
  return "";
}

/**
 * @param {string} clean
 * @param {string} method
 */
function defaultBodyFor(clean, method) {
  if (method === "GET") return "";
  if (clean.startsWith("/api/webchat/product-assistant")) {
    return JSON.stringify(
      {
        messages: [{ role: "user", content: "Hello" }],
        page: "smart-home",
        lang: "ar",
        useWebSearch: false,
      },
      null,
      2,
    );
  }
  if (clean.startsWith("/api/crm/orders") && method === "PUT") {
    return JSON.stringify(
      { action: "status", orderId: "{{sampleOrderId}}", status: "new" },
      null,
      2,
    );
  }
  return "{\n  \n}";
}

/**
 * @param {string} method
 * @param {string} pathRaw
 */
function makeRequest(method, pathRaw) {
  const clean = pathRaw.replace(/\/$/, "");
  const needsJsonBody = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isHealth = clean === "/api/health";
  const pathResolved = toUrlPath(pathRaw);
  const raw = `{{baseUrl}}${pathResolved}${querySuffix(clean, method)}`;

  const headers = {};
  if (needsJsonBody) headers["Content-Type"] = "application/json";
  if (isHealth) headers["Authorization"] = "Bearer {{healthCheckToken}}";

  const headerArr = Object.entries(headers).map(([key, value]) => ({ key, value, type: "text" }));

  const name = (isHealth ? "GET" : method) + " " + pathResolved;

  return {
    name: isHealth ? "GET /api/health (Bearer {{healthCheckToken}})" : name,
    request: {
      method,
      header: headerArr,
      // String URL: مطلوب لـ Newman (postman-runtime يترك { raw } فاضياً إن لم يُعرّف host/path).
      url: raw,
      description:
        "مُولّد آلي. عيّن متغيّرات البيئة. للبِدن الحقيقي راجع Zod/المعالج في route المقابلة.",
    },
    event: [
      {
        listen: "test",
        script: { type: "text/javascript", exec: CONTRACT_TEST.split("\n") },
      },
    ],
  };
}

const { routes } = scanRoutes();

const layerMap = new Map();
for (const r of routes) {
  const folder = layerName(r.path);
  if (!layerMap.has(folder)) layerMap.set(folder, []);
  for (const m of r.methods) {
    const req = makeRequest(m, r.path);
    if (["POST", "PUT", "PATCH", "DELETE"].includes(m)) {
      const clean = r.path.replace(/\/$/, "");
      req.request.body = { mode: "raw", raw: defaultBodyFor(clean, m) };
    }
    layerMap.get(folder).push(req);
  }
}

for (const items of layerMap.values()) {
  items.sort((a, b) => a.name.localeCompare(b.name));
}

const LAYER_ORDER = [
  "0-Smoke-Public",
  "1-Store-Read-Model",
  "2-Commerce-Messaging-Orders",
  "3-Customer-Auth-GDPR",
  "4-CRM",
  "5-Admin",
  "6-Employee-SalesPWA",
  "7-Integrations-Ops",
];

const folders = LAYER_ORDER.filter((k) => layerMap.has(k)).map((name) => ({
  name,
  description: "See postman/PROTOCOL.ar.md for layer purpose and when to run.",
  item: layerMap.get(name),
}));

const allItems = [];
for (const r of routes) {
  for (const m of r.methods) {
    const req = makeRequest(m, r.path);
    if (["POST", "PUT", "PATCH", "DELETE"].includes(m)) {
      const clean = r.path.replace(/\/$/, "");
      req.request.body = { mode: "raw", raw: defaultBodyFor(clean, m) };
    }
    allItems.push(req);
  }
}
allItems.sort((a, b) => a.name.localeCompare(b.name));

folders.push({
  name: "Z-Full-Inventory-All-Endpoints",
  description:
    "نفس المسارات مكررة في مجلد واحد للمراجعة الشاملة أو Runner. 401/403 متوقع بدون كوكيز/رؤوس.",
  item: allItems,
});

const collection = {
  info: {
    name: "ClalMobile API — طبقات فحص (Layers QA)",
    description:
      "مولّد تلقائياً: `node scripts/postman/build-collection.mjs`. البروتوكول: `postman/PROTOCOL.ar.md`.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    version: { major: 1, minor: 0, patch: 0 },
  },
  item: folders,
  variable: [{ key: "baseUrl", value: "http://localhost:3000", type: "string" }],
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(collection, null, 2), "utf8");
console.log("Wrote", out, "folders:", folders.length, "total request entries:", allItems.length);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void 0;
}
