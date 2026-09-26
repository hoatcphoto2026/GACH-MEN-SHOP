const form = document.getElementById('product-form');
const listEl = document.getElementById('admin-list');
const countEl = document.getElementById('admin-count');
const statusEl = document.getElementById('form-status');
const banner = document.getElementById('server-banner');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('field-image');
const preview = document.getElementById('image-preview');
const imagePath = document.getElementById('field-image-path');
const editingId = document.getElementById('editing-id');
const formTitle = document.getElementById('form-title');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-edit');

const formatPrice = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
));

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('is-error', isError);
}

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

async function checkServer() {
  try {
    await api('/api/health');
    banner.hidden = true;
    return true;
  } catch {
    banner.hidden = false;
    banner.innerHTML = 'Trang quản lý cần máy chủ có quyền <strong>ghi file</strong>. Trong thư mục gach-men hãy chạy <code>py server.py</code> rồi mở <code>http://localhost:8000/admin.html</code>.';
    return false;
  }
}

function showPreview(src) {
  preview.src = src;
  preview.hidden = !src;
}

async function handleFile(file) {
  if (!file) return;
  const okType = /image\/(jpeg|png|webp|svg\+xml)/.test(file.type) || /\.(jpe?g|png|webp|svg)$/i.test(file.name);
  if (!okType) {
    setStatus('Chỉ nhận file JPG, PNG, WEBP hoặc SVG.', true);
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    setStatus('Ảnh tối đa 8MB.', true);
    return;
  }
  setStatus('Đang tải ảnh...');
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được file'));
    reader.readAsDataURL(file);
  });
  showPreview(data);
  const uploaded = await api('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, data }),
  });
  imagePath.value = uploaded.image;
  setStatus('Đã nhận ảnh. Điền thông tin rồi bấm lưu.');
}

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('is-drag');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-drag'));
dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-drag');
  const file = e.dataTransfer.files[0];
  try { await handleFile(file); } catch (err) { setStatus(err.message, true); }
});
fileInput.addEventListener('change', async () => {
  try { await handleFile(fileInput.files[0]); } catch (err) { setStatus(err.message, true); }
  fileInput.value = '';
});

function fillForm(p) {
  editingId.value = p ? p.id : '';
  document.getElementById('field-name').value = p ? p.name : '';
  document.getElementById('field-size').value = p ? p.size : '600x600mm';
  document.getElementById('field-usage').value = p ? p.usage : 'Lát Nền';
  document.getElementById('field-price').value = p ? p.price : '';
  document.getElementById('field-description').value = p ? p.description : '';
  document.getElementById('field-surface').value = p ? p.surface : '';
  document.getElementById('field-material').value = p ? p.material : '';
  document.getElementById('field-perBox').value = p ? p.perBox : '';
  document.getElementById('field-origin').value = p ? p.origin : 'Việt Nam';
  document.getElementById('field-warranty').value = p ? p.warranty : '';
  imagePath.value = p ? p.image : '';
  showPreview(p ? p.image : '');
  formTitle.textContent = p ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới';
  saveBtn.textContent = p ? 'Lưu thay đổi' : 'Thêm sản phẩm';
  cancelBtn.hidden = !p;
}

function collectForm() {
  return {
    name: document.getElementById('field-name').value,
    size: document.getElementById('field-size').value,
    usage: document.getElementById('field-usage').value,
    price: Number(document.getElementById('field-price').value),
    description: document.getElementById('field-description').value,
    surface: document.getElementById('field-surface').value,
    material: document.getElementById('field-material').value,
    perBox: document.getElementById('field-perBox').value,
    origin: document.getElementById('field-origin').value,
    warranty: document.getElementById('field-warranty').value,
    image: imagePath.value,
  };
}

async function loadList() {
  const products = await api('/api/products');
  countEl.textContent = `${products.length} sản phẩm`;
  listEl.innerHTML = products.map((p) => `
    <article class="admin-item">
      <img src="${esc(p.image)}" alt="">
      <div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.size)} · ${esc(p.usage)} · ${formatPrice(p.price)}/m²</p>
      </div>
      <div class="admin-item-actions">
        <button type="button" class="btn-edit" data-edit="${esc(p.id)}">Sửa</button>
        <button type="button" class="btn-delete" data-delete="${esc(p.id)}">Xóa</button>
      </div>
    </article>
  `).join('');
}

listEl.addEventListener('click', async (e) => {
  const del = e.target.closest('[data-delete]');
  const edit = e.target.closest('[data-edit]');
  try {
    if (del) {
      const id = del.dataset.delete;
      if (!confirm('Xóa sản phẩm này khỏi website?')) return;
      await api('/api/products/' + encodeURIComponent(id), { method: 'DELETE' });
      if (editingId.value === id) fillForm(null);
      setStatus('Đã xóa sản phẩm.');
      await loadList();
    }
    if (edit) {
      const products = await api('/api/products');
      const p = products.find((item) => item.id === edit.dataset.edit);
      if (p) {
        fillForm(p);
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  } catch (err) {
    setStatus(err.message, true);
  }
});

cancelBtn.addEventListener('click', () => {
  fillForm(null);
  setStatus('');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (!imagePath.value) {
      setStatus('Hãy kéo thả hoặc chọn ảnh trước.', true);
      return;
    }
    const payload = collectForm();
    const id = editingId.value;
    if (id) {
      await api('/api/products/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setStatus('Đã lưu thay đổi. Vào cửa hàng để xem.');
    } else {
      await api('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setStatus('Đã thêm sản phẩm. Vào cửa hàng để xem.');
    }
    fillForm(null);
    await loadList();
  } catch (err) {
    setStatus(err.message, true);
  }
});

(async () => {
  const ok = await checkServer();
  if (!ok) return;
  try {
    await loadList();
  } catch (err) {
    setStatus(err.message, true);
  }
})();
