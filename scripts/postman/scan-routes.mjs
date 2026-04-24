// Scans app/api (recursive) route.ts for exported HTTP handlers.
// Run: node scripts/postman/scan-routes.mjs
// Import: `import { scanRoutes } from './scan-routes.mjs'`
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../../app/api");
const reFn = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/g;
const reConst = /export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*=/g;

function walk(dir, acc) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, acc);
    else if (f.name === "route.ts") {
      const t = fs.readFileSync(p, "utf8");
      const m = new Set();
      let x;
      const rFn = new RegExp(reFn.source, "g");
      while ((x = rFn.exec(t)) !== null) m.add(x[1]);
      const rC = new RegExp(reConst.source, "g");
      while ((x = rC.exec(t)) !== null) m.add(x[1]);
      const rel = p
        .replace(/\\/g, "/")
        .replace(/.*\/app\/api\//, "/api/")
        .replace("/route.ts", "/");
      if (m.size) acc.push({ path: rel, methods: [...m].sort() });
    }
  }
}

export function scanRoutes() {
  const acc = [];
  walk(root, acc);
  acc.sort((a, b) => a.path.localeCompare(b.path));
  return { generatedAt: new Date().toISOString(), count: acc.length, routes: acc };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = scanRoutes();
  console.log(JSON.stringify(r, null, 2));
}
