"use client";

import { useScreen } from "@/lib/hooks";
import { Toggle } from "@/components/admin/shared";
import type { WebsiteContent, Hero, SubPage } from "@/types/database";
import { SECTIONS } from "./types";
import { HeaderSectionEditor } from "./HeaderSectionEditor";
import { HeroSectionEditor } from "./HeroSectionEditor";
import { BannersSectionEditor } from "./BannersSectionEditor";
import { StatsSectionEditor } from "./StatsSectionEditor";
import { FeaturesSectionEditor } from "./FeaturesSectionEditor";
import { FAQSectionEditor } from "./FAQSectionEditor";
import { CTASectionEditor } from "./CTASectionEditor";
import { FooterSectionEditor } from "./FooterSectionEditor";
import { SubPagesSectionEditor } from "./SubPagesSectionEditor";

export type SectionListProps = {
  sections: WebsiteContent[];
  expanded: string | null;
  saving: string | null;
  scr: ReturnType<typeof useScreen>;
  // Section operations
  getSection: (key: string) => WebsiteContent | undefined;
  toggle: (key: string) => void;
  toggleVisibility: (key: string) => Promise<void>;
  saveSection: (sectionKey: string, updates: Partial<WebsiteContent>) => Promise<void>;
  // Heroes (Banners)
  heroes: Hero[];
  heroesLoading: boolean;
  onHeroAdd: () => void;
  onHeroEdit: (h: Hero) => void;
  onHeroToggle: (id: string, active: boolean) => void;
  onHeroDelete: (id: string) => void;
  // Sub Pages
  subPages: SubPage[];
  subPagesLoading: boolean;
  onSubPageAdd: () => void;
  onSubPageEdit: (p: SubPage) => void;
  onSubPageToggle: (id: string, visible: boolean) => void;
  onSubPageDelete: (id: string) => void;
};

export function SectionList({
  sections, expanded, saving, scr,
  getSection, toggle, toggleVisibility, saveSection,
  heroes, heroesLoading, onHeroAdd, onHeroEdit, onHeroToggle, onHeroDelete,
  subPages, subPagesLoading, onSubPageAdd, onSubPageEdit, onSubPageToggle, onSubPageDelete,
}: SectionListProps) {
  return (
    <div className="space-y-2">
      {SECTIONS.map(({ key, icon, label, desc }) => {
        const section = getSection(key);
        const isExpanded = expanded === key;
        const isBanners = key === "banners";
        const isSubPages = key === "subpages";
        const noToggle = isBanners || isSubPages;

        return (
          <div key={key} className="card overflow-hidden transition-all" style={{ borderColor: isExpanded ? "rgba(196,16,64,0.3)" : undefined }}>
            {/* Section Header */}
            <div
              className="flex items-center justify-between cursor-pointer"
              style={{ padding: scr.mobile ? "12px 14px" : "16px 20px" }}
              onClick={() => toggle(key)}
            >
              <div className="flex items-center gap-2">
                {!noToggle && section && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Toggle value={section.is_visible} onChange={() => toggleVisibility(key)} />
                  </div>
                )}
                <span className="transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", fontSize: 14, color: "#71717a" }}>
                  ◀
                </span>
              </div>
              <div className="flex-1 text-right mr-3">
                <div className="font-bold" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                  {icon} {label}
                </div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                  {desc}
                  {!noToggle && section && (
                    <span className="mr-2">
                      {section.is_visible ? <span className="text-state-success">● مرئي</span> : <span className="text-state-error">● مخفي</span>}
                    </span>
                  )}
                  {isSubPages && <span className="mr-2 text-brand">{subPages.length} صفحات</span>}
                </div>
              </div>
            </div>

            {/* Section Body */}
            {isExpanded && (
              <div className="border-t border-surface-border" style={{ padding: scr.mobile ? "14px" : "20px" }}>
                {key === "header" && <HeaderSectionEditor section={section} onSave={(u) => saveSection("header", u)} saving={saving === "header"} scr={scr} />}
                {key === "hero" && <HeroSectionEditor section={section} onSave={(u) => saveSection("hero", u)} saving={saving === "hero"} scr={scr} />}
                {key === "banners" && <BannersSectionEditor heroes={heroes} loading={heroesLoading} onAdd={onHeroAdd} onEdit={onHeroEdit} onToggle={onHeroToggle} onDelete={onHeroDelete} scr={scr} />}
                {key === "stats" && <StatsSectionEditor section={section} onSave={(u) => saveSection("stats", u)} saving={saving === "stats"} scr={scr} />}
                {key === "features" && <FeaturesSectionEditor section={section} onSave={(u) => saveSection("features", u)} saving={saving === "features"} scr={scr} />}
                {key === "faq" && <FAQSectionEditor section={section} onSave={(u) => saveSection("faq", u)} saving={saving === "faq"} scr={scr} />}
                {key === "cta" && <CTASectionEditor section={section} onSave={(u) => saveSection("cta", u)} saving={saving === "cta"} scr={scr} />}
                {key === "footer" && <FooterSectionEditor section={section} onSave={(u) => saveSection("footer", u)} saving={saving === "footer"} scr={scr} />}
                {key === "subpages" && <SubPagesSectionEditor pages={subPages} loading={subPagesLoading} onAdd={onSubPageAdd} onEdit={onSubPageEdit} onToggle={onSubPageToggle} onDelete={onSubPageDelete} scr={scr} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
