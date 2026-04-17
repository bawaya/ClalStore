#!/bin/bash
# ============================================================
# ClalMobile - Project Map Generator
# ============================================================
# Purpose: Generate a complete project map so every new season
#          starts with full knowledge of what came before.
# Usage:   bash clalmobile-project-map.sh [project-root]
# Output:  PROJECT_MAP.md in the project root
# ============================================================

set -euo pipefail

# --- Config ---
PROJECT_ROOT="${1:-.}"
OUTPUT_FILE="$PROJECT_ROOT/PROJECT_MAP.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Colors for terminal
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🗺️  ClalMobile Project Map Generator${NC}"
echo -e "${YELLOW}Scanning: $PROJECT_ROOT${NC}"
echo ""

# --- Start output ---
cat > "$OUTPUT_FILE" << 'HEADER'
# 🗺️ ClalMobile - Project Map
> Auto-generated project map for season continuity and test planning.
> Every new season MUST read this file before starting any work.

---

HEADER

echo "Generated: $TIMESTAMP" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# ============================================================
# SECTION 1: PROJECT RULES (IMMUTABLE)
# ============================================================
echo -e "${GREEN}[1/10] Writing immutable project rules...${NC}"
cat >> "$OUTPUT_FILE" << 'RULES'

## 1. 📜 Immutable Project Rules

These rules are **non-negotiable** across ALL seasons:

| # | Rule | Details |
|---|------|---------|
| 1 | **Responsiveness** | Every app works on mobile (tab nav, compact) AND desktop (sidebar, grids). Never mobile-only. |
| 2 | **useScreen() hook** | All responsive logic uses the custom `useScreen()` hook. No raw media queries. |
| 3 | **Strict TypeScript** | Zero TS errors before any phase is complete. `strict: true` in tsconfig. |
| 4 | **Images = uploaded files** | Images are uploaded files, never external URLs. |
| 5 | **RTL + Bilingual** | Full Arabic + Hebrew support. RTL layout throughout. |
| 6 | **Tailwind theming only** | All theming via Tailwind config. No inline style overrides for theming. |
| 7 | **Zustand state** | Zustand for ALL state management. No Redux, no Context for global state. |
| 8 | **Supabase only** | Supabase (PostgreSQL) exclusively for database access. |
| 9 | **Service files** | All external integrations routed through dedicated service files. |
| 10 | **Git hygiene** | Clean commits, deployment-ready at all times. |
| 11 | **Integration Hub** | 6-provider swappable architecture for all external services. |
| 12 | **Error boundaries** | Every route segment needs `error.tsx`. |

RULES

# ============================================================
# SECTION 2: TECH STACK
# ============================================================
echo -e "${GREEN}[2/10] Documenting tech stack...${NC}"
cat >> "$OUTPUT_FILE" << 'STACK'

## 2. 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS (RTL) |
| Database | Supabase (PostgreSQL) |
| Hosting | Cloudflare Pages |
| State | Zustand |
| WhatsApp | yCloud |
| Payments | Rivhit Gateway |
| AI | Claude API |
| Image Optimization | Disabled (Cloudflare Pages constraint) |

STACK

# ============================================================
# SECTION 3: DIRECTORY STRUCTURE
# ============================================================
echo -e "${GREEN}[3/10] Mapping directory structure...${NC}"
echo "" >> "$OUTPUT_FILE"
echo "## 3. 📁 Directory Structure" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

if command -v tree &> /dev/null; then
    tree "$PROJECT_ROOT" -I 'node_modules|.next|.git|.vercel|out|coverage|dist' \
         --dirsfirst -L 3 >> "$OUTPUT_FILE" 2>/dev/null || \
    find "$PROJECT_ROOT" -maxdepth 3 \
         -not -path '*/node_modules/*' \
         -not -path '*/.next/*' \
         -not -path '*/.git/*' \
         -not -name '*.lock' \
         | sort >> "$OUTPUT_FILE"
else
    find "$PROJECT_ROOT" -maxdepth 3 \
         -not -path '*/node_modules/*' \
         -not -path '*/.next/*' \
         -not -path '*/.git/*' \
         -not -name '*.lock' \
         | sort >> "$OUTPUT_FILE"
fi

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# ============================================================
# SECTION 4: DEEP STRUCTURE (key directories)
# ============================================================
echo -e "${GREEN}[4/10] Deep scanning key directories...${NC}"
echo "## 4. 📂 Deep Structure (Key Directories)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for dir in "app" "components" "lib" "hooks" "store" "services" "types" "utils" "supabase" "api"; do
    target="$PROJECT_ROOT/src/$dir"
    [ ! -d "$target" ] && target="$PROJECT_ROOT/$dir"
    if [ -d "$target" ]; then
        echo "### \`$dir/\`" >> "$OUTPUT_FILE"
        echo '```' >> "$OUTPUT_FILE"
        find "$target" -type f \
             -not -path '*/node_modules/*' \
             -not -name '*.map' \
             -not -name '*.lock' \
             | sort >> "$OUTPUT_FILE"
        echo '```' >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

# ============================================================
# SECTION 5: API ROUTES
# ============================================================
echo -e "${GREEN}[5/10] Listing API routes...${NC}"
echo "## 5. 🔌 API Routes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

API_DIR="$PROJECT_ROOT/src/app/api"
[ ! -d "$API_DIR" ] && API_DIR="$PROJECT_ROOT/app/api"

if [ -d "$API_DIR" ]; then
    echo '```' >> "$OUTPUT_FILE"
    find "$API_DIR" -name 'route.ts' -o -name 'route.js' | sort | while read -r route; do
        # Extract the route path
        route_path=$(echo "$route" | sed "s|$API_DIR||" | sed 's|/route\.\(ts\|js\)$||')
        # Extract HTTP methods
        methods=$(grep -oE '(GET|POST|PUT|PATCH|DELETE)' "$route" 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')
        echo "  $route_path  [$methods]"
    done >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
else
    echo "> No API routes directory found." >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# ============================================================
# SECTION 6: DATABASE (Supabase migrations & tables)
# ============================================================
echo -e "${GREEN}[6/10] Scanning database schema...${NC}"
echo "## 6. 🗄️ Database Schema" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Find migration files
echo "### Migration Files" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
find "$PROJECT_ROOT" -path '*/migrations/*.sql' -o -path '*/supabase/migrations/*.sql' 2>/dev/null | sort >> "$OUTPUT_FILE" || echo "  No migration files found" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract table names from migrations
echo "### Tables (extracted from migrations)" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
find "$PROJECT_ROOT" -path '*/migrations/*.sql' 2>/dev/null -exec grep -ihE 'CREATE TABLE' {} \; 2>/dev/null | \
    sed 's/.*CREATE TABLE\s\+\(IF NOT EXISTS\s\+\)\?//' | \
    sed 's/\s*(.*$//' | \
    sort -u >> "$OUTPUT_FILE" || echo "  No tables found" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Check for duplicate migration numbers
echo "### ⚠️ Migration Health Check" >> "$OUTPUT_FILE"
DUPES=$(find "$PROJECT_ROOT" -path '*/migrations/*.sql' 2>/dev/null | \
    sed 's/.*\///' | cut -d'_' -f1 | sort | uniq -d)
if [ -n "$DUPES" ]; then
    echo "**DUPLICATE MIGRATION NUMBERS DETECTED:**" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
    echo "$DUPES" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
else
    echo "> ✅ No duplicate migration numbers." >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# ============================================================
# SECTION 7: COMPONENTS INVENTORY
# ============================================================
echo -e "${GREEN}[7/10] Inventorying components...${NC}"
echo "## 7. 🧩 Components" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

COMP_DIR="$PROJECT_ROOT/src/components"
[ ! -d "$COMP_DIR" ] && COMP_DIR="$PROJECT_ROOT/components"

if [ -d "$COMP_DIR" ]; then
    echo '```' >> "$OUTPUT_FILE"
    find "$COMP_DIR" -name '*.tsx' -o -name '*.jsx' | sort | while read -r comp; do
        rel_path=$(echo "$comp" | sed "s|$COMP_DIR/||")
        # Count lines
        lines=$(wc -l < "$comp")
        echo "  $rel_path  (${lines}L)"
    done >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
else
    echo "> No components directory found." >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# ============================================================
# SECTION 8: TYPES
# ============================================================
echo -e "${GREEN}[8/10] Mapping TypeScript types...${NC}"
echo "## 8. 📐 TypeScript Types" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo '```' >> "$OUTPUT_FILE"
FIND_DIRS=("$PROJECT_ROOT")
[ -d "$PROJECT_ROOT/src" ] && FIND_DIRS=("$PROJECT_ROOT/src" "$PROJECT_ROOT")
find "${FIND_DIRS[@]}" -maxdepth 4 \
     \( -name '*.types.ts' -o -name 'types.ts' -o -name '*.d.ts' \) \
     -not -path '*/node_modules/*' \
     -not -path '*/.next/*' 2>/dev/null | sort -u | while read -r tfile; do
    lines=$(wc -l < "$tfile")
    echo "  $tfile  (${lines}L)"
    # Extract type/interface names
    grep -oE '(export )?(type|interface|enum) [A-Z][A-Za-z0-9]+' "$tfile" 2>/dev/null | \
        sed 's/^/    → /' || true
done >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# ============================================================
# SECTION 9: STORES (Zustand)
# ============================================================
echo -e "${GREEN}[9/10] Mapping Zustand stores...${NC}"
echo "## 9. 🏪 Zustand Stores" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo '```' >> "$OUTPUT_FILE"
find "$PROJECT_ROOT" -path '*/store/*' -name '*.ts' \
     -not -path '*/node_modules/*' 2>/dev/null | sort | while read -r store; do
    rel=$(echo "$store" | sed "s|$PROJECT_ROOT/||")
    lines=$(wc -l < "$store")
    echo "  $rel  (${lines}L)"
    # Extract store name
    grep -oE 'create[(<]' "$store" 2>/dev/null | head -1 | sed 's/^/    → uses: /' || true
done >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# ============================================================
# SECTION 10: SEASON PROGRESS & KNOWN ISSUES
# ============================================================
echo -e "${GREEN}[10/10] Writing season progress...${NC}"
cat >> "$OUTPUT_FILE" << 'SEASONS'

## 10. 📊 Season Progress

| Season | Scope | Status | Key Deliverables |
|--------|-------|--------|-----------------|
| S0 | Infrastructure | ⏳ Next | Foundation, CI/CD, testing setup |
| S1 | Store/E-commerce | ✅ Complete | Product pages, cart, checkout |
| S2 | Admin Panel | ✅ Complete | Dashboard, products, Integration Hub (6 providers) |
| S3 | CRM | 🔄 ~75% | WhatsApp Inbox, AI replies, sentiment, RAG |
| S4 | AI Chatbots | ⏳ Not started | WhatsApp bot, WebChat |

## 11. ⚠️ Known Issues (Must Fix)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | Duplicate migration #011 | 🔴 High | Two files with number 011 — will fail in production |
| 2 | Permissive RLS on sub_pages | 🔴 High | `USING(true)` — no real access control |
| 3 | Missing error.tsx boundaries | 🟡 Medium | Route segments lack error boundaries |
| 4 | Single oversized types file | 🟡 Medium | Should be split per domain |
| 5 | No ESLint/Prettier config | 🟡 Medium | Code style not enforced |
| 6 | legacy-peer-deps workaround | 🟡 Medium | npm install uses --legacy-peer-deps |

## 12. 🧪 Test Planning Reference

Use sections 5-9 above to plan tests:
- **API Routes** (Section 5) → Integration tests for each endpoint
- **Database** (Section 6) → Migration tests, RLS policy tests
- **Components** (Section 7) → Unit tests with React Testing Library
- **Types** (Section 8) → Type-level tests with tsd or expect-type
- **Stores** (Section 9) → Zustand store unit tests

### Recommended test structure:
```
__tests__/
├── unit/
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   └── utils/
├── integration/
│   ├── api/
│   └── db/
└── e2e/
    ├── store/
    ├── admin/
    └── crm/
```

SEASONS

# ============================================================
# SECTION 13: PACKAGE.JSON SUMMARY
# ============================================================
echo "" >> "$OUTPUT_FILE"
echo "## 13. 📦 Dependencies Summary" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

PKG="$PROJECT_ROOT/package.json"
if [ -f "$PKG" ]; then
    echo "### Dependencies" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
    { grep -A 200 '"dependencies"' "$PKG" | grep -B 200 -m 1 '}' | head -50; } >> "$OUTPUT_FILE" || true
    echo '```' >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "### Dev Dependencies" >> "$OUTPUT_FILE"
    echo '```' >> "$OUTPUT_FILE"
    { grep -A 200 '"devDependencies"' "$PKG" | grep -B 200 -m 1 '}' | head -50; } >> "$OUTPUT_FILE" || true
    echo '```' >> "$OUTPUT_FILE"
else
    echo "> No package.json found." >> "$OUTPUT_FILE"
fi

# ============================================================
# SECTION 14: ENV VARS
# ============================================================
echo "" >> "$OUTPUT_FILE"
echo "## 14. 🔑 Environment Variables" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for envfile in ".env.example" ".env.local.example" ".env.template"; do
    if [ -f "$PROJECT_ROOT/$envfile" ]; then
        echo "### From \`$envfile\`" >> "$OUTPUT_FILE"
        echo '```' >> "$OUTPUT_FILE"
        { grep -v '^#' "$PROJECT_ROOT/$envfile" | grep '=' | sed 's/=.*/=***/'; } >> "$OUTPUT_FILE" || true
        echo '```' >> "$OUTPUT_FILE"
    fi
done

# Also scan for env vars used in code
echo "### Environment variables referenced in code" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"
grep -rhE 'process\.env\.[A-Z_]+' "$PROJECT_ROOT" --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null | \
    grep -oE 'process\.env\.[A-Z_]+' | \
    sort -u | \
    sed 's/process\.env\.//' >> "$OUTPUT_FILE" || echo "  None found" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

# ============================================================
# FOOTER
# ============================================================
cat >> "$OUTPUT_FILE" << 'FOOTER'

---

## 📌 How to Use This Map

1. **Starting a new season?** Read this entire file first.
2. **Writing tests?** Use sections 5-9 for coverage targets.
3. **Onboarding Claude?** Paste this file as context.
4. **Found an issue?** Add it to Section 11.
5. **Regenerate after changes:** `bash clalmobile-project-map.sh`

> ⚡ This file is auto-generated. Do not edit manually.
> Run `bash clalmobile-project-map.sh` to refresh.
FOOTER

echo ""
echo -e "${GREEN}✅ Project map generated: $OUTPUT_FILE${NC}"
echo -e "${CYAN}📄 $(wc -l < "$OUTPUT_FILE") lines written${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review the map: cat $OUTPUT_FILE"
echo "  2. Commit it to git: git add PROJECT_MAP.md && git commit -m 'docs: project map for season continuity'"
echo "  3. Use it as context for every new Claude session"
echo "  4. Use it as basis for writing tests"
