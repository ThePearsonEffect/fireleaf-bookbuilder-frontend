// js/toast.js
export function showToast({ title = 'Notification', message = '', type = 'success', timeout = 2600 } = {}) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  toast.innerHTML = `
    <button class="toast__close" aria-label="Close">×</button>
    <div class="toast__title">${escapeHtml(title)}</div>
    <div class="toast__msg">${escapeHtml(message)}</div>
  `;

  const closeBtn = toast.querySelector('.toast__close');
  closeBtn.addEventListener('click', () => dismiss());

  container.appendChild(toast);

  const timer = setTimeout(() => dismiss(), timeout);

  function dismiss() {
    clearTimeout(timer);
    toast.style.animation = 'toast-out .16s ease-in forwards';
    setTimeout(() => toast.remove(), 160);
  }
}

function escapeHtml(s = '') {
  return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
