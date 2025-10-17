// components/Tabs.js
export class AppTabs extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  connectedCallback() {
    const tabDefs = Array.from(this.querySelectorAll('[data-tab]'));
    const root = document.createElement('div');
    root.innerHTML = `
      <style>
        :host { display:block; font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; }
        .bar { display:flex; gap:.5rem; border-bottom:1px solid #e5e7eb; margin-bottom:1rem; flex-wrap:wrap; }
        .btn {
          appearance:none; border:0; background:transparent; padding:.6rem .9rem; border-radius:8px 8px 0 0;
          font-weight:600; color:#6b7280; cursor:pointer; position:relative; outline:none;
        }
        .btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; border-radius:10px 10px 0 0; }
        .btn.is-active { color:#111827; }
        .btn.is-active::after {
          content:''; position:absolute; left:0; right:0; bottom:-1px; height:2px; background:#111827;
        }
        ::slotted(.tab-pane) { display:none; }
        ::slotted(.tab-pane.is-active) { display:block; }
      </style>
      <div class="bar" role="tablist" aria-label="Application Tabs"></div>
      <slot></slot>
    `;
    this.shadowRoot.append(root);

    const bar = this.shadowRoot.querySelector('.bar');

    // Build shadow buttons from light-DOM <button data-tab="...">
    tabDefs.forEach((srcBtn) => {
      const id  = srcBtn.getAttribute('data-tab');
      const lbl = srcBtn.getAttribute('data-label') || srcBtn.textContent || id;

      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.type = 'button';
      btn.textContent = lbl;
      btn.dataset.target = id;

      // ARIA wiring
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', id);
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', '-1'); // active one becomes 0 later

      // Mouse & Keyboard
      btn.addEventListener('click', () => this.showTab(id));
      btn.addEventListener('keydown', this._onKeyDown);

      bar.appendChild(btn);
    });

    // Initialize panes ARIA
    this.querySelectorAll('.tab-pane').forEach(pane => {
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('tabindex', '0'); // focusable for screen readers
      pane.setAttribute('aria-hidden', 'true');
      // aria-labelledby is set on activation in showTab()
    });

    // initial tab via hash or first
    const initial = (location.hash || '').replace('#','') || tabDefs[0]?.getAttribute('data-tab');
    if (initial) this.showTab(initial);
  }

  _allButtons() {
    return Array.from(this.shadowRoot.querySelectorAll('.btn'));
  }

  _onKeyDown(e) {
    const buttons = this._allButtons();
    const currentIndex = buttons.indexOf(e.currentTarget);

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.showTab(e.currentTarget.dataset.target);
        break;
      case 'ArrowRight':
      case 'ArrowDown': {
        e.preventDefault();
        const next = buttons[(currentIndex + 1) % buttons.length];
        next.focus();
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        e.preventDefault();
        const prev = buttons[(currentIndex - 1 + buttons.length) % buttons.length];
        prev.focus();
        break;
      }
      case 'Home':
        e.preventDefault();
        buttons[0].focus();
        break;
      case 'End':
        e.preventDefault();
        buttons[buttons.length - 1].focus();
        break;
    }
  }

  showTab(id) {
    // Activate buttons
    const buttons = this._allButtons();
    buttons.forEach((b) => {
      const active = b.dataset.target === id;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
      b.setAttribute('tabindex', active ? '0' : '-1');
      if (active) b.focus({ preventScroll: true });
    });

    // Show/hide panes
    this.querySelectorAll('.tab-pane').forEach((p) => {
      const active = p.id === id;
      p.classList.toggle('is-active', active);
      p.setAttribute('aria-hidden', active ? 'false' : 'true');

      if (active) {
        // Link pane to the active tab via aria-labelledby
        const activeBtn = this.shadowRoot.querySelector(`.btn[data-target="${id}"]`);
        if (activeBtn) p.setAttribute('aria-labelledby', activeBtn.id || (activeBtn.id = `tab-${id}`));
      }
    });

    // Keep URL in sync
    history.replaceState(null, '', `#${id}`);

    // Broadcast change
    this.dispatchEvent(new CustomEvent('tabs:change', { detail: { id } }));

    // Optional: if you want a "Reset All" tab to trigger an action
    if (id === 'reset-all') {
      this.dispatchEvent(new CustomEvent('tabs:reset'));
      // Optionally jump back to first real tab after firing:
      const firstReal = this._allButtons().find(b => b.dataset.target !== 'reset-all');
      if (firstReal) this.showTab(firstReal.dataset.target);
    }
  }
}

customElements.define('app-tabs', AppTabs);
