// =====================================================
// ClalMobile — PDF Export Utility
// Client-side PDF generation using browser print API
// No external dependencies — works on Edge runtime
// =====================================================

"use client";

interface PDFOptions {
  title: string;
  subtitle?: string;
  filename?: string;
  orientation?: "portrait" | "landscape";
}

/**
 * Export a DOM element or HTML content to PDF using browser print dialog.
 * This is the most reliable cross-browser approach without server-side deps.
 */
export function exportToPDF(
  content: string | HTMLElement,
  options: PDFOptions
) {
  const html = typeof content === "string" ? content : content.outerHTML;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("يرجى السماح بالنوافذ المنبثقة لتصدير PDF");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${options.title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
          font-family: 'Tajawal', Arial, sans-serif;
          direction: rtl;
          color: #1a1a2e;
          background: #fff;
          padding: 20mm;
          font-size: 12px;
          line-height: 1.6;
        }

        .pdf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid #c41040;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }

        .pdf-header h1 {
          font-size: 22px;
          font-weight: 800;
          color: #c41040;
        }

        .pdf-header .date {
          font-size: 11px;
          color: #666;
        }

        .pdf-subtitle {
          font-size: 14px;
          color: #666;
          margin-bottom: 16px;
          text-align: right;
        }

        .pdf-content { margin-top: 10px; }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 11px;
        }

        th {
          background: #c41040;
          color: #fff;
          padding: 8px 10px;
          text-align: right;
          font-weight: 700;
        }

        td {
          padding: 6px 10px;
          border-bottom: 1px solid #e2e8f0;
          text-align: right;
        }

        tr:nth-child(even) { background: #f8fafc; }
        tr:hover { background: #fff3f5; }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
          margin: 16px 0;
        }

        .stat-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }

        .stat-card .value {
          font-size: 24px;
          font-weight: 800;
          color: #c41040;
        }

        .stat-card .label {
          font-size: 10px;
          color: #666;
          margin-top: 2px;
        }

        .pdf-footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 9px;
          color: #999;
        }

        @media print {
          body { padding: 10mm; }
          @page { 
            size: ${options.orientation === "landscape" ? "landscape" : "portrait"};
            margin: 10mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="pdf-header">
        <div>
          <h1>ClalMobile — ${options.title}</h1>
          ${options.subtitle ? `<div class="pdf-subtitle">${options.subtitle}</div>` : ""}
        </div>
        <div class="date">${new Date().toLocaleDateString("ar-IL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
      </div>
      
      <div class="pdf-content">
        ${html}
      </div>

      <div class="pdf-footer">
        تم التصدير من نظام ClalMobile — ${new Date().toLocaleString("ar-IL")}
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 300);
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

/**
 * Generate a stats-based PDF report
 */
export function exportReportPDF(stats: Record<string, string | number>[], tableHeaders: string[], title: string) {
  let rows = "";
  stats.forEach((row) => {
    rows += "<tr>";
    tableHeaders.forEach((header) => {
      rows += `<td>${row[header] ?? ""}</td>`;
    });
    rows += "</tr>";
  });

  const headerCells = tableHeaders.map((h) => `<th>${h}</th>`).join("");

  const content = `
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  exportToPDF(content, { title, orientation: "landscape" });
}

/**
 * Generate a stats card PDF with key metrics
 */
export function exportStatsPDF(
  cards: { label: string; value: string | number }[],
  title: string,
  extraHTML?: string
) {
  const statsCards = cards.map((c) => `
    <div class="stat-card">
      <div class="value">${c.value}</div>
      <div class="label">${c.label}</div>
    </div>
  `).join("");

  const content = `
    <div class="stat-grid">${statsCards}</div>
    ${extraHTML || ""}
  `;

  exportToPDF(content, { title });
}
