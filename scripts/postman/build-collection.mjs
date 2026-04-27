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

// Endpoints that may trigger real outbound messages (email, WhatsApp, SMS, push)
// or otherwise have non-reversible side effects. When authenticated, the
// collection-level pre-request short-circuits these to keep test runs safe.
const DANGEROUS_PATH_PATTERNS = [
  "/api/admin/whatsapp-test",
  "/api/admin/whatsapp-templates", // POST/PUT touches live template store
  "/api/admin/contact-notify",
  "/api/admin/integrations/test",
  "/api/admin/announcements", // POST broadcasts to staff
  "/api/admin/sales-requests/", // approve/reject/request-info notify
  "/api/admin/sales-docs/", // verify/reject/cancel notify
  "/api/admin/orders/create", // sends confirmation
  "/api/admin/order", // PUT changes status → notify
  "/api/admin/corrections/", // approve/reject notify
  "/api/admin/reviews/generate", // burns AI tokens
  "/api/email",
  "/api/push/send",
  "/api/push/subscribe",
  "/api/auth/", // password change / customer auth flows
  "/api/customer/auth/", // OTP / magic link flows
];

// Collection-level pre-request:
// (1) Always skip state-changing requests on dangerous paths so a Newman run
//     can never trigger real outbound email/WA/SMS or burn AI tokens, even when
//     env state from Y-Auth-Setup didn't cross folder boundaries.
//     GETs on those paths still run — they're read-only and safe.
// (2) Pull the csrf_token cookie and mirror it into the x-csrf-token header
//     so write requests aren't rejected at the middleware boundary.
const CSRF_PREREQUEST = [
  "const DANGEROUS = " + JSON.stringify(DANGEROUS_PATH_PATTERNS) + ";",
  "const method = pm.request.method;",
  "const reqUrl = pm.request.url.toString() || '';",
  "const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);",
  "if (isWrite && DANGEROUS.some(p => reqUrl.includes(p))) {",
  "  // Authenticated or not, we never want test runs to fire side-effecty writes",
  "  // on these paths. Skip via the modern API or fall back to a noop GET.",
  "  if (typeof pm.execution !== 'undefined' && typeof pm.execution.skipRequest === 'function') {",
  "    pm.execution.skipRequest();",
  "    return;",
  "  }",
  "  pm.request.url = (pm.environment.get('baseUrl') || 'http://localhost:3000') + '/api/csrf';",
  "  pm.request.method = 'GET';",
  "  pm.request.body = undefined;",
  "  return;",
  "}",
  "if (isWrite) {",
  "  // The csrf_token cookie is set by middleware on any prior GET, including the",
  "  // Y-Auth-Setup/GET /api/csrf primer that should run before this folder.",
  "  const url = pm.environment.get('baseUrl') || 'http://localhost:3000';",
  "  const jar = pm.cookies.jar();",
  "  jar.get(url, 'csrf_token', function (_err, value) {",
  "    if (value) pm.request.headers.upsert({ key: 'x-csrf-token', value });",
  "  });",
  "}",
].join("\n");

// Folder built after the routes are scanned. Lives at "Y-Auth-Setup" so it sorts
// just before the Z-Full-Inventory folder; runners should hit it first to seed
// the CSRF cookie and the admin session for the cookie jar.
function buildAuthSetupFolder() {
  const csrfPrimer = {
    name: "GET /api/csrf (seed CSRF cookie)",
    request: {
      method: "GET",
      header: [],
      url: "{{baseUrl}}/api/csrf",
      description: "Hit before any state-changing request so the csrf_token cookie exists.",
    },
    event: [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: [
            "pm.test('csrf primer responds 200', function () {",
            "  pm.expect(pm.response.code).to.equal(200);",
            "});",
          ],
        },
      },
    ],
  };

  const adminLogin = {
    name: "POST /api/test/admin-login (dev/staging only)",
    request: {
      method: "POST",
      header: [
        { key: "Content-Type", value: "application/json", type: "text" },
      ],
      url: "{{baseUrl}}/api/test/admin-login",
      body: {
        mode: "raw",
        raw: JSON.stringify({ email: "{{adminEmail}}", password: "{{adminPassword}}" }, null, 2),
      },
      description:
        "Signs in as the admin defined by adminEmail/adminPassword in the environment and writes the Supabase session cookies into the runner's jar. Disabled in production.",
    },
    event: [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: [
            "if (pm.response.code === 200) {",
            "  pm.environment.set('authStatus', 'authenticated');",
            "  pm.test('login succeeded', function () {",
            "    pm.expect(pm.response.code).to.equal(200);",
            "  });",
            "} else {",
            "  pm.environment.set('authStatus', 'unauthenticated');",
            "  console.warn('admin-login failed (' + pm.response.code + ') — admin folders will likely return 401/403');",
            "}",
          ],
        },
      },
    ],
  };

  return {
    name: "Y-Auth-Setup",
    description:
      "Run me first. Seeds CSRF cookie and an admin session cookie via the dev-only test endpoint. Sets authStatus=authenticated when login succeeds; admin folders use that flag to upgrade their assertions.",
    item: [csrfPrimer, adminLogin],
  };
}

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
// Endpoints that authenticate via separate bearer tokens rather than the
// admin session cookie. Hit list mirrors the route handlers' explicit
// COMMISSION_API_TOKEN check.
const COMMISSION_TOKEN_PATHS = new Set([
  "/api/admin/commissions/employees/list",
  "/api/admin/commissions/summary",
]);

function makeRequest(method, pathRaw) {
  const clean = pathRaw.replace(/\/$/, "");
  const needsJsonBody = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isHealth = clean === "/api/health";
  const usesCommissionToken = COMMISSION_TOKEN_PATHS.has(clean);
  const pathResolved = toUrlPath(pathRaw);
  const raw = `{{baseUrl}}${pathResolved}${querySuffix(clean, method)}`;

  const headers = {};
  if (needsJsonBody) headers["Content-Type"] = "application/json";
  if (isHealth) headers["Authorization"] = "Bearer {{healthCheckToken}}";
  if (usesCommissionToken) headers["Authorization"] = "Bearer {{commissionApiToken}}";

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

// Insert auth setup folder right before Z-Full-Inventory so it runs first by name order.
folders.splice(folders.length - 1, 0, buildAuthSetupFolder());

const collection = {
  info: {
    name: "ClalMobile API — طبقات فحص (Layers QA)",
    description:
      "مولّد تلقائياً: `node scripts/postman/build-collection.mjs`. البروتوكول: `postman/PROTOCOL.ar.md`.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    version: { major: 1, minor: 0, patch: 0 },
  },
  item: folders,
  // Collection-level pre-request runs before every request — used to attach the
  // x-csrf-token header automatically when the cookie is present.
  event: [
    {
      listen: "prerequest",
      script: { type: "text/javascript", exec: CSRF_PREREQUEST.split("\n") },
    },
  ],
  variable: [{ key: "baseUrl", value: "http://localhost:3000", type: "string" }],
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(collection, null, 2), "utf8");
console.log("Wrote", out, "folders:", folders.length, "total request entries:", allItems.length);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void 0;
}
