const config = window.SUPABASE_CONFIG || {};
const apiBase = (config.url || '').replace(/\/$/, '');
const bucket = 'product-images';
const sessionKey = 'gach-men-admin-session';
const form = document.getElementById('product-form');
const listEl = document.getElementById('admin-list');
const countEl = document.getElementById('admin-count');
const statusEl = document.getElementById('workspace-status');
const loginPanel = document.getElementById('login-panel');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const loginBtn = document.getElementById('login-btn');
const workspace = document.getElementById('admin-workspace');
const logoutBtn = document.getElementById('logout-btn');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('field-image');
const preview = document.getElementById('image-preview');
const imagePath = document.getElementById('field-image-path');
const editingId = document.getElementById('editing-id');
const formTitle = document.getElementById('form-title');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-edit');
let products = [];
let uploadingImage = false;

const formatPrice = (n) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
));

function setStatus(element, text, isError = false) {
  element.textContent = text;
  element.classList.toggle('is-error', isError);
}

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
  } catch {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
}

function saveSession(session) {
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(sessionKey);
}

async function readResponse(response) {
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!response.ok) {
    const reason = data?.message || data?.msg || data?.error_description || data?.error || `HTTP ${response.status}`;
    const hint = data?.hint ? ` (${data.hint})` : '';
    throw new Error(`${reason}${hint}`);
  }
  return data;
}

async function authRequest(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return readResponse(response);
}

async function currentSession() {
  const session = getSession();
  if (!session?.access_token || !session?.refresh_token) return null;
  if (session.expires_at > Date.now() + 60_000) return session;

  try {
    const refreshed = await authRequest('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const updated = {
      ...refreshed,
      expires_at: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
    };
    saveSession(updated);
    return updated;
  } catch (error) {
    clearSession();
    loginPanel.hidden = false;
    workspace.hidden = true;
    throw new Error(`Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại. (${error.message})`);
  }
}

async function supabaseRequest(path, options = {}) {
  const session = await currentSession();
  if (!session) throw new Error('Vui lòng đăng nhập lại để tiếp tục.');

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });
  return readResponse(response);
}

function showPreview(src) {
  preview.src = src;
  preview.hidden = !src;
}

function imageUrl(filePath) {
  if (!filePath) return '';
  if (/^https?:\/\//i.test(filePath) || filePath.startsWith('data:') || filePath.startsWith('blob:')) {
    return filePath;
  }
  return filePath;
}

async function handleFile(file) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    setStatus(statusEl, 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.', true);
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    setStatus(statusEl, 'Ảnh tối đa 8MB.', true);
    return;
  }

  uploadingImage = true;
  saveBtn.disabled = true;
  setStatus(statusEl, 'Đang tải ảnh lên Supabase Storage...');
  const previousImage = imagePath.value;
  try {
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const randomPart = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const objectPath = `products/${randomPart}.${extension}`;
    const response = await fetch(
      `${apiBase}/storage/v1/object/${bucket}/${objectPath}`,
      {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${(await currentSession()).access_token}`,
          'Content-Type': file.type,
          'x-upsert': 'false',
        },
        body: file,
      }
    );
    await readResponse(response);

    const publicUrl = `${apiBase}/storage/v1/object/public/${bucket}/${objectPath}`;
    imagePath.value = publicUrl;
    showPreview(publicUrl);
    setStatus(statusEl, 'Đã tải ảnh lên Storage. Bấm lưu để cập nhật sản phẩm.');
  } catch (error) {
    imagePath.value = previousImage;
    showPreview(imageUrl(previousImage));
    setStatus(statusEl, `Không tải được ảnh: ${error.message}`, true);
  } finally {
    uploadingImage = false;
    saveBtn.disabled = false;
  }
}

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('is-drag');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-drag'));
dropzone.addEventListener('drop', async (event) => {
  event.preventDefault();
  dropzone.classList.remove('is-drag');
  await handleFile(event.dataTransfer.files[0]);
});
fileInput.addEventListener('change', async () => {
  await handleFile(fileInput.files[0]);
  fileInput.value = '';
});

function fillForm(product) {
  editingId.value = product ? String(product.id) : '';
  document.getElementById('field-name').value = product ? product.name : '';
  document.getElementById('field-size').value = product ? product.size : '600x600mm';
  document.getElementById('field-usage').value = product ? product.usage : 'Lát Nền';
  document.getElementById('field-price').value = product ? product.price : '';
  document.getElementById('field-description').value = product ? product.description || '' : '';
  document.getElementById('field-surface').value = product ? product.surface || '' : '';
  document.getElementById('field-material').value = product ? product.material || '' : '';
  document.getElementById('field-perBox').value = product ? product.per_box || '' : '';
  document.getElementById('field-origin').value = product ? product.origin || '' : 'Việt Nam';
  document.getElementById('field-warranty').value = product ? product.warranty || '' : '';
  imagePath.value = product ? product.image || '' : '';
  showPreview(imageUrl(imagePath.value));
  formTitle.textContent = product ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới';
  saveBtn.textContent = product ? 'Lưu thay đổi' : 'Thêm sản phẩm';
  cancelBtn.hidden = !product;
}

function collectForm() {
  return {
    name: document.getElementById('field-name').value.trim(),
    size: document.getElementById('field-size').value,
    usage: document.getElementById('field-usage').value,
    price: Number(document.getElementById('field-price').value),
    description: document.getElementById('field-description').value.trim(),
    surface: document.getElementById('field-surface').value.trim(),
    material: document.getElementById('field-material').value.trim(),
    per_box: document.getElementById('field-perBox').value.trim(),
    origin: document.getElementById('field-origin').value.trim(),
    warranty: document.getElementById('field-warranty').value.trim(),
    image: imagePath.value,
  };
}

async function loadList() {
  setStatus(statusEl, 'Đang tải danh sách sản phẩm...');
  const result = await supabaseRequest(
    '/rest/v1/product_gach_men?select=id,external_code,name,size,usage,price,image,surface,material,origin,per_box,warranty,description&order=id.asc',
    { method: 'GET' }
  );
  if (!Array.isArray(result)) throw new Error('Supabase không trả về danh sách sản phẩm.');
  products = result;
  countEl.textContent = `${products.length} sản phẩm`;
  listEl.innerHTML = products.map((product) => `
    <article class="admin-item">
      <img src="${esc(imageUrl(product.image))}" alt="">
      <div>
        <h3>${esc(product.name)}</h3>
        <p>${esc(product.size)} · ${esc(product.usage)} · ${formatPrice(product.price)}/m²</p>
      </div>
      <div class="admin-item-actions">
        <button type="button" class="btn-edit" data-edit="${esc(product.id)}">Sửa</button>
        <button type="button" class="btn-delete" data-delete="${esc(product.id)}">Xóa</button>
      </div>
    </article>
  `).join('');
  setStatus(statusEl, '');
}

listEl.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const del = target.closest('[data-delete]');
  const edit = target.closest('[data-edit]');

  try {
    if (del) {
      const id = del.dataset.delete;
      if (!confirm('Xóa sản phẩm này khỏi website?')) return;
      const deleted = await supabaseRequest(
        `/rest/v1/product_gach_men?id=eq.${encodeURIComponent(id)}&select=id`,
        { method: 'DELETE', headers: { Prefer: 'return=representation' } }
      );
      if (!Array.isArray(deleted) || deleted.length !== 1) {
        throw new Error('Không tìm thấy sản phẩm hoặc tài khoản không có quyền xóa.');
      }
      if (editingId.value === id) fillForm(null);
      await loadList();
      setStatus(statusEl, 'Đã xóa sản phẩm khỏi Supabase.');
    } else if (edit) {
      const product = products.find((item) => String(item.id) === edit.dataset.edit);
      if (product) {
        fillForm(product);
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  } catch (error) {
    setStatus(statusEl, error.message, true);
  }
});

cancelBtn.addEventListener('click', () => {
  fillForm(null);
  setStatus(statusEl, '');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (uploadingImage) {
    setStatus(statusEl, 'Vui lòng đợi ảnh tải lên hoàn tất.', true);
    return;
  }
  if (!imagePath.value) {
    setStatus(statusEl, 'Hãy tải ảnh lên trước khi lưu sản phẩm.', true);
    return;
  }

  saveBtn.disabled = true;
  const payload = collectForm();
  const id = editingId.value;
  const successMessage = id
    ? 'Đã cập nhật sản phẩm trên Supabase.'
    : 'Đã thêm sản phẩm vào Supabase.';
  setStatus(statusEl, id ? 'Đang cập nhật sản phẩm...' : 'Đang thêm sản phẩm...');
  try {
    if (id) {
      const updated = await supabaseRequest(
        `/rest/v1/product_gach_men?id=eq.${encodeURIComponent(id)}&select=id`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        }
      );
      if (!Array.isArray(updated) || updated.length !== 1) {
        throw new Error('Không tìm thấy sản phẩm hoặc tài khoản không có quyền cập nhật.');
      }
    } else {
      const inserted = await supabaseRequest('/rest/v1/product_gach_men?select=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!Array.isArray(inserted) || inserted.length !== 1) {
        throw new Error('Supabase không xác nhận đã thêm sản phẩm.');
      }
    }
    fillForm(null);
    await loadList();
    setStatus(statusEl, successMessage);
  } catch (error) {
    setStatus(statusEl, error.message, true);
  } finally {
    saveBtn.disabled = false;
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!apiBase || !config.anonKey) {
    setStatus(loginStatus, 'Thiếu Supabase URL hoặc Publishable key trong supabase-config.js.', true);
    return;
  }

  loginBtn.disabled = true;
  setStatus(loginStatus, 'Đang đăng nhập...');
  try {
    const data = await authRequest('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value,
      }),
    });
    if (!data.access_token || !data.refresh_token) {
      throw new Error('Supabase không trả về phiên đăng nhập hợp lệ.');
    }
    saveSession({ ...data, expires_at: Date.now() + Number(data.expires_in || 3600) * 1000 });
    loginForm.reset();
    loginPanel.hidden = true;
    workspace.hidden = false;
    setStatus(loginStatus, '');
  } catch (error) {
    clearSession();
    setStatus(loginStatus, `Đăng nhập thất bại: ${error.message}`, true);
    loginPanel.hidden = false;
    workspace.hidden = true;
    loginBtn.disabled = false;
    return;
  }

  try {
    await loadList();
  } catch (error) {
    setStatus(statusEl, `Đăng nhập thành công nhưng không tải được danh sách: ${error.message}`, true);
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  const session = getSession();
  clearSession();
  loginPanel.hidden = false;
  workspace.hidden = true;
  products = [];
  listEl.replaceChildren();
  countEl.textContent = '';
  fillForm(null);
  setStatus(loginStatus, 'Đã đăng xuất.');

  if (session?.access_token) {
    try {
      const response = await fetch(`${apiBase}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      await readResponse(response);
    } catch (error) {
      setStatus(loginStatus, `Đã đăng xuất trên thiết bị, nhưng không thể thu hồi phiên trên máy chủ: ${error.message}`, true);
    }
  }
  document.getElementById('login-email').focus();
});

(async () => {
  if (!apiBase || !config.anonKey) {
    setStatus(loginStatus, 'Thiếu Supabase URL hoặc Publishable key trong supabase-config.js.', true);
    return;
  }
  if (!getSession()) return;
  loginPanel.hidden = true;
  workspace.hidden = false;
  try {
    await loadList();
  } catch (error) {
    setStatus(statusEl, `Không tải được danh sách sản phẩm: ${error.message}`, true);
  }
})();
