let PRODUCTS = [];

/* ============================================================
   Tiện ích
   ============================================================ */

const formatPrice = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

// Chặn ký tự HTML trong dữ liệu JSON để tránh vỡ giao diện
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
));

/* ============================================================
   Tham chiếu DOM
   ============================================================ */

const grid = document.getElementById('product-grid');
const emptyState = document.getElementById('empty-state');
const resultCount = document.getElementById('result-count');
const sizeFilter = document.getElementById('filter-size');
const usageFilter = document.getElementById('filter-usage');
const resetBtn = document.getElementById('reset-filters');

/* ============================================================
   Nạp dữ liệu từ Supabase
   ============================================================ */

async function loadProducts() {
  try {
    const config = window.SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey) {
      throw new Error('Chưa cấu hình Supabase URL và anon key trong supabase-config.js');
    }

    const endpoint = `${config.url.replace(/\/$/, '')}/rest/v1/product_gach_men`
      + '?select=id,external_code,name,size,usage,price,image,surface,material,origin,per_box,warranty,description'
      + '&order=id.asc';
    const res = await fetch(endpoint, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || data?.hint || `Supabase HTTP ${res.status}`);
    }
    if (!Array.isArray(data)) throw new Error('Supabase không trả về danh sách sản phẩm');

    PRODUCTS = data.map((p) => ({
      ...p,
      id: p.external_code || String(p.id),
      perBox: p.per_box || '',
    }));
    renderProducts();
  } catch (err) {
    showLoadError(err);
  }
}

function showLoadError(err) {
  resultCount.textContent = '';
  emptyState.hidden = false;
  emptyState.classList.add('load-error');
  emptyState.innerHTML = `
    <strong>Không tải được sản phẩm từ Supabase</strong>
    <span>Chi tiết lỗi: ${esc(err.message)}</span>
    <span>Kiểm tra <code>supabase-config.js</code>, quyền SELECT của bảng và mở website qua máy chủ HTTP.</span>`;
}

/* ============================================================
   Hiển thị danh sách + bộ lọc
   ============================================================ */

function getFilteredProducts() {
  const size = sizeFilter.value;
  const usage = usageFilter.value;

  return PRODUCTS.filter((p) =>
    (size === 'all' || p.size === size) &&
    (usage === 'all' || p.usage === usage)
  );
}

function renderProducts() {
  const list = getFilteredProducts();

  grid.innerHTML = list.map((p) => `
    <button type="button" class="product-card" data-id="${esc(p.id)}">
      <div class="tile-thumb">
        <img src="${esc(p.image)}" alt="Mẫu ${esc(p.name)}" loading="lazy">
        <span class="usage-badge">${esc(p.usage)}</span>
      </div>
      <div class="card-body">
        <h2>${esc(p.name)}</h2>
        <p class="card-meta">Kích thước: ${esc(p.size)}</p>
        <p class="card-price">${formatPrice(p.price)} <span>/ m²</span></p>
      </div>
    </button>
  `).join('');

  emptyState.classList.remove('load-error');
  emptyState.textContent = 'Không tìm thấy sản phẩm nào phù hợp với bộ lọc của bạn.';
  emptyState.hidden = list.length > 0;
  resultCount.textContent = `Hiển thị ${list.length} / ${PRODUCTS.length} sản phẩm`;
}

grid.addEventListener('click', (e) => {
  const card = e.target.closest('.product-card');
  if (card) openModal(card.dataset.id);
});

sizeFilter.addEventListener('change', renderProducts);
usageFilter.addEventListener('change', renderProducts);

resetBtn.addEventListener('click', () => {
  sizeFilter.value = 'all';
  usageFilter.value = 'all';
  renderProducts();
});

/* ============================================================
   Modal chi tiết sản phẩm
   ============================================================ */

const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
let lastFocused = null;

// Chỉ hiện dòng thông số nếu Supabase có trường đó
const specRow = (label, value) =>
  value ? `<tr><th>${label}</th><td>${esc(value)}</td></tr>` : '';

function openModal(id) {
  const p = PRODUCTS.find((item) => item.id === id);
  if (!p) return;

  lastFocused = document.activeElement;

  modalBody.innerHTML = `
    <div class="modal-image">
      <img src="${esc(p.image)}" alt="Mẫu ${esc(p.name)}">
    </div>
    <div class="modal-info">
      <h2 id="modal-title">${esc(p.name)}</h2>
      <p class="modal-code">Mã sản phẩm: ${esc(p.id)}</p>
      <p class="modal-price">${formatPrice(p.price)} <span>/ m²</span></p>
      <p class="modal-desc">${esc(p.description || '')}</p>
      <table class="spec-table">
        <tbody>
          ${specRow('Kích thước', p.size)}
          ${specRow('Ứng dụng', p.usage)}
          ${specRow('Bề mặt', p.surface)}
          ${specRow('Chất liệu', p.material)}
          ${specRow('Quy cách', p.perBox)}
          ${specRow('Xuất xứ', p.origin)}
          ${specRow('Bảo hành', p.warranty)}
        </tbody>
      </table>
      <p class="modal-note">
        Gọi <strong>028 3812 3456</strong> để được báo giá theo số m² thực tế và kiểm tra tồn kho.
      </p>
    </div>
  `;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modalClose.focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
}

modalClose.addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();   // bấm ra ngoài để đóng
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.hidden) closeModal();
});

/* ---------- Khởi chạy ---------- */

loadProducts();
