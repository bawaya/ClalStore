function createHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;
  const page = document.body.dataset.page;
  const activeLabel = page === "home" ? "الرئيسية" : "الهواتف";

  const mainNav = STORE_PROTOTYPE_DATA.nav
    .map(
      (item) =>
        `<a class="nav-link ${item.label === activeLabel ? "is-current" : ""}" href="${item.href}">${item.label}</a>`,
    )
    .join("");

  const supportNav = STORE_PROTOTYPE_DATA.supportNav
    .map(
      (item) =>
        `<a class="support-link" href="${item.href}">${item.label}</a>`,
    )
    .join("");

  const serviceHighlights = STORE_PROTOTYPE_DATA.serviceHighlights
    .map((item) => `<span class="service-chip">${item}</span>`)
    .join("");

  header.innerHTML = `
    <div class="header-utility">
      <div class="service-strip">${serviceHighlights}</div>
      <span class="prototype-badge">نموذج تنفيذ مستقل</span>
    </div>
    <div class="topbar">
      <div class="brand-block">
        <div class="brand-mark">ك</div>
        <div>
          <div class="brand-name">متجر كلال</div>
          <div class="brand-subtitle">نموذج بصري مستقل قبل التطبيق على المشروع</div>
        </div>
      </div>
      <div class="support-nav">${supportNav}</div>
    </div>
    <nav class="main-nav">
      ${mainNav}
      <a class="button button-primary button-small" href="./product.html">منتج مقنع</a>
    </nav>
  `;
}

function createFooter() {
  const footer = document.getElementById("site-footer");
  if (!footer) return;

  footer.innerHTML = `
    <div class="footer-grid">
      <div>
        <span class="eyebrow">خلاصة الرؤية</span>
        <h3>متجر واضح لا يخلط بين العوالم التجارية</h3>
        <p>
          هذا النموذج يعرض كيف يمكن تحويل المتجر إلى بنية احترافية: أقسام
          واضحة، صفحات موحدة، وصفحة منتج تحسم القرار.
        </p>
      </div>
      <div>
        <span class="eyebrow">مبدأ التنفيذ</span>
        <ul class="footer-list">
          <li>فصل التصفح عن البيع التكميلي</li>
          <li>توحيد القوالب</li>
          <li>البدء بالنموذج قبل نقل التصميم</li>
        </ul>
      </div>
    </div>
  `;
}

function renderCategoryCards() {
  const target = document.getElementById("home-categories");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.categories
    .map(
      (item) => `
        <article class="category-card">
          <div class="category-card__icon">${item.icon}</div>
          <h3>${item.title}</h3>
          <p class="category-card__summary">${item.summary}</p>
          <p class="category-card__detail">${item.detail}</p>
        </article>
      `,
    )
    .join("");
}

function renderHomeFlow() {
  const target = document.getElementById("home-flow");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.homeFlow
    .map(
      (item, index) => `
        <article class="flow-card">
          <span class="flow-card__index">0${index + 1}</span>
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
        </article>
      `,
    )
    .join("");
}

function productCard(item) {
  return `
    <article class="product-card product-card--${item.accent || "ruby"}">
      <div class="product-card__visual">
        <span class="badge-pill">${item.badge}</span>
        <div class="device-tile" aria-hidden="true"></div>
      </div>
      <div class="product-card__body">
        <div class="product-card__meta">${item.brand}</div>
        <h3>${item.title}</h3>
        <p>${item.summary || item.note}</p>
        <div class="product-card__footer">
          <strong>${item.price} ₪</strong>
          <a href="./product.html">افتح المنتج</a>
        </div>
      </div>
    </article>
  `;
}

function renderFeaturedPhones() {
  const target = document.getElementById("featured-phones");
  if (!target) return;
  target.innerHTML = STORE_PROTOTYPE_DATA.homeProducts.map(productCard).join("");
}

function renderPlans() {
  const target = document.getElementById("plan-board");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.plans
    .map(
      (plan) => `
        <article class="plan-card">
          <div class="plan-card__price">${plan.price} ₪</div>
          <h3>${plan.title}</h3>
          <p>${plan.summary}</p>
          <ul>
            ${plan.perks.map((perk) => `<li>${perk}</li>`).join("")}
          </ul>
        </article>
      `,
    )
    .join("");
}

function renderBrands() {
  const target = document.getElementById("brand-strip");
  if (!target) return;
  target.innerHTML = STORE_PROTOTYPE_DATA.brands
    .map((brand) => `<span class="brand-pill">${brand}</span>`)
    .join("");
}

function renderDeals() {
  const target = document.getElementById("deals-grid");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.deals
    .map(
      (deal) => `
        <article class="deal-card">
          <span class="deal-card__state">${deal.state}</span>
          <h3>${deal.title}</h3>
          <p>${deal.summary}</p>
          <a href="./product.html">معاينة المسار</a>
        </article>
      `,
    )
    .join("");
}

function renderBundles(targetId, bundles) {
  const target = document.getElementById(targetId);
  if (!target) return;

  target.innerHTML = bundles
    .map(
      (bundle) => `
        <article class="bundle-card">
          <div class="bundle-card__value">${bundle.value}</div>
          <h3>${bundle.title}</h3>
          <p>${bundle.summary}</p>
        </article>
      `,
    )
    .join("");
}

function renderTrust() {
  const target = document.getElementById("trust-grid");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.trust
    .map(
      (item) => `
        <article class="trust-card">
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
        </article>
      `,
    )
    .join("");
}

function renderPhoneSubcategories() {
  const target = document.getElementById("phone-subcategories");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.phoneSubcategories
    .map(
      (item, index) =>
        `<button class="subnav-pill ${index === 0 ? "is-active" : ""}">${item}</button>`,
    )
    .join("");
}

function renderPhoneBrands() {
  const target = document.getElementById("phone-brands");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.brands
    .slice(0, 5)
    .map(
      (brand, index) =>
        `<button class="pill ${index === 1 ? "is-active" : ""}">${brand}</button>`,
    )
    .join("");
}

function renderCategoryProducts() {
  const target = document.getElementById("category-products");
  if (!target) return;
  target.innerHTML = STORE_PROTOTYPE_DATA.categoryProducts.map(productCard).join("");
}

function renderCategoryOverview() {
  const target = document.getElementById("category-overview");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.categoryOverview
    .map(
      (item) => `
        <article class="overview-card">
          <strong>${item.value}</strong>
          <span>${item.label}</span>
        </article>
      `,
    )
    .join("");
}

function renderProductBreadcrumb() {
  const target = document.getElementById("product-breadcrumb");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.productBreadcrumb
    .map((item, index, arr) => {
      const current = index === arr.length - 1;
      return `
        <span class="breadcrumb-item ${current ? "is-current" : ""}">${item}</span>
        ${current ? "" : '<span class="breadcrumb-separator">‹</span>'}
      `;
    })
    .join("");
}

function renderProductHero() {
  const target = document.getElementById("product-hero");
  if (!target) return;
  const product = STORE_PROTOTYPE_DATA.product;

  target.innerHTML = `
    <div class="product-stage">
      <div class="product-gallery-art" aria-hidden="true">
        <span class="gallery-device gallery-device--back"></span>
        <span class="gallery-device gallery-device--front"></span>
        <span class="gallery-reflection"></span>
      </div>
      <div class="product-gallery-strip">
        <span class="gallery-thumb is-active"></span>
        <span class="gallery-thumb"></span>
        <span class="gallery-thumb"></span>
      </div>
    </div>
    <div class="product-summary">
      <span class="eyebrow">${product.brand}</span>
      <h1>${product.title}</h1>
      <span class="badge-pill">${product.badge}</span>
      <p>${product.description}</p>
      <div class="product-price-row">
        <strong>${product.price} ₪</strong>
        <span>أو ${product.monthly} ₪ شهريًا</span>
      </div>
      <div class="summary-trust">
        ${STORE_PROTOTYPE_DATA.purchaseHighlights
          .map((item) => `<span class="summary-chip">${item}</span>`)
          .join("")}
      </div>
      <div class="option-stack">
        <div>
          <h3>الألوان</h3>
          <div class="option-pills">
            ${product.options.colors
              .map(
                (color, index) =>
                  `<button class="option-pill ${index === 0 ? "is-active" : ""}">${color}</button>`,
              )
              .join("")}
          </div>
        </div>
        <div>
          <h3>السعة</h3>
          <div class="option-pills">
            ${product.options.storage
              .map(
                (storage, index) =>
                  `<button class="option-pill ${index === 1 ? "is-active" : ""}">${storage}</button>`,
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProductMain() {
  const target = document.getElementById("product-main");
  if (!target) return;
  const product = STORE_PROTOTYPE_DATA.product;

  target.innerHTML = `
    <article class="spec-card">
      <span class="eyebrow">المواصفات الأساسية</span>
      <div class="spec-list">
        ${product.specs
          .map(
            (spec) => `
              <div class="spec-row">
                <strong>${spec.label}</strong>
                <span>${spec.value}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </article>
    <article class="narrative-card">
      <span class="eyebrow">منهج الصفحة</span>
      <h2>كيف تقنع الصفحة بدل أن تشتت</h2>
      <p>
        هذه الصفحة لا تبدأ بجدار طويل من التفاصيل، بل تقدم المنتج بشكل بصري قوي،
        ثم تعطي السعر، ثم المواصفات الأساسية، ثم تفتح البيع التكميلي في المكان
        الصحيح.
      </p>
    </article>
  `;
}

function renderPurchasePanel() {
  const target = document.getElementById("purchase-panel");
  if (!target) return;
  const product = STORE_PROTOTYPE_DATA.product;

  target.innerHTML = `
    <div class="purchase-card">
      <span class="eyebrow">صندوق الحسم</span>
      <div class="purchase-card__price">${product.price} ₪</div>
      <p>السعر واضح، والتقسيط حاضر، والثقة قريبة من زر القرار.</p>
      <div class="purchase-badges">
        <span class="purchase-badge">تسليم منظم</span>
        <span class="purchase-badge">تقسيط شهري</span>
        <span class="purchase-badge">مسار شراء واضح</span>
      </div>
      <button class="button button-primary button-block">أضف إلى السلة</button>
      <button class="button button-secondary button-block">أضف مع باقة</button>
      <ul class="purchase-points">
        <li>ضمان رسمي</li>
        <li>شحن منظم</li>
        <li>تتبع واضح</li>
      </ul>
    </div>
  `;
}

function renderReasonGrid() {
  const target = document.getElementById("reason-grid");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.productReasons
    .map(
      (reason) => `
        <article class="reason-card">
          <h3>${reason.title}</h3>
          <p>${reason.summary}</p>
        </article>
      `,
    )
    .join("");
}

function renderComplementaryStack() {
  const target = document.getElementById("complementary-stack");
  if (!target) return;

  target.innerHTML = STORE_PROTOTYPE_DATA.complementary
    .map(
      (item) => `
        <article class="complementary-card">
          <h3>${item.title}</h3>
          <p>${item.summary}</p>
          <button class="button button-secondary button-small">${item.action}</button>
        </article>
      `,
    )
    .join("");
}

function renderRelatedProducts() {
  const target = document.getElementById("related-products");
  if (!target) return;
  target.innerHTML = STORE_PROTOTYPE_DATA.relatedProducts.map(productCard).join("");
}

function initHomePage() {
  renderHomeFlow();
  renderCategoryCards();
  renderFeaturedPhones();
  renderPlans();
  renderBrands();
  renderDeals();
  renderBundles("bundle-grid", STORE_PROTOTYPE_DATA.bundles);
  renderTrust();
}

function initCategoryPage() {
  renderPhoneSubcategories();
  renderPhoneBrands();
  renderCategoryOverview();
  renderCategoryProducts();
  renderBundles("category-accessories", STORE_PROTOTYPE_DATA.categoryAccessories);
}

function initProductPage() {
  renderProductBreadcrumb();
  renderProductHero();
  renderProductMain();
  renderPurchasePanel();
  renderReasonGrid();
  renderComplementaryStack();
  renderRelatedProducts();
}

function initPage() {
  createHeader();
  createFooter();

  const page = document.body.dataset.page;
  if (page === "home") initHomePage();
  if (page === "category") initCategoryPage();
  if (page === "product") initProductPage();
}

initPage();
