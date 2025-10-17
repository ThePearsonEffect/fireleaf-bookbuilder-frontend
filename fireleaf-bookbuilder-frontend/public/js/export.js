import { Api } from './api.js';
// js/export.js

// -------------------------------------------------------------
// Imports
// -------------------------------------------------------------
import { showToast } from './toast.js';
import { CONFIG } from './config.js';
import { showAlert } from './ui.js';

// -------------------------------------------------------------
// Simple FIFO download queue (one job at a time)
// -------------------------------------------------------------
/**
 * @typedef {Object} DownloadJob
 * @property {string} apiPath          - Endpoint that returns a file stream/blob
 * @property {string} fileName         - File name to save (e.g., 'book.pdf')
 * @property {any}    [body]           - Optional JSON body or raw string body
 * @property {Object} [headers]        - Optional headers (merged with JSON when body given)
 * @property {HTMLElement} [button]    - Optional button to disable while downloading
 */

const __downloadQueue = /** @type {DownloadJob[]} */([]);
let __downloadActive = false;

/**
 * Enqueue a download job. Only one runs at a time.
 * @param {DownloadJob} job
 */
export function enqueueDownload(job) {
  const id = `${job.apiPath}::${job.fileName}::${Date.now()}`;
  __downloadQueue.push({ id, ...job });

  if (__downloadQueue.length > 1) {
    showToast({
      title: 'Queued',
      message: `${job.fileName} added to downloads queue (${__downloadQueue.length - 1} ahead).`,
      type: 'success',
      timeout: 2200
    });
  }
  __runNextDownload();
}

async function __runNextDownload() {
  if (__downloadActive || __downloadQueue.length === 0) return;
  __downloadActive = true;

  const job = __downloadQueue.shift();
  const { apiPath, fileName, body, headers, button } = job;

  try {
    if (button) button.disabled = true;

    showToast({ title: 'Starting download', message: fileName, type: 'success', timeout: 1400 });
    await downloadWithProgress({ apiPath, fileName, body, headers });
    showToast({ title: 'Download ready', message: `${fileName} saved.`, type: 'success' });
  } catch (e) {
    console.error('Download failed:', e);
    showToast({ title: 'Download failed', message: String(e?.message || e), type: 'error' });
  } finally {
    if (button) button.disabled = false;
    __downloadActive = false;
    if (__downloadQueue.length > 0) __runNextDownload();
  }
}

// -------------------------------------------------------------
// Streaming download with progress + toast notifications
// -------------------------------------------------------------
/**
 * Stream a file with progress UI. Supports optional JSON body/headers.
 * Looks for #downloadStatus / #downloadBar / #downloadPct in the DOM (optional).
 * Falls back to blob if streaming isn’t supported.
 *
 * @param {{ apiPath: string, fileName: string, body?: any, headers?: Record<string,string> }} arg
 */
export async function downloadWithProgress({ apiPath, fileName, body, headers }) {
  const statusEl = document.getElementById('downloadStatus');
  const barEl    = document.getElementById('downloadBar');
  const pctEl    = document.getElementById('downloadPct');
  const wrap     = statusEl?.querySelector?.('.progress-wrap');

  const setActive = (on) => statusEl?.classList?.toggle('active', !!on);
  const setPct = (v) => {
    const n = Math.max(0, Math.min(100, Math.round(v)));
    if (barEl) barEl.style.width = n + '%';
    if (wrap)  wrap.setAttribute('aria-valuenow', String(n));
    if (pctEl) pctEl.textContent = n + '%';
  };

  setActive(true);
  setPct(0);
  if (pctEl) pctEl.textContent = 'Preparing…';

  // Build fetch init, supporting optional JSON or raw body + headers
  const fetchInit = { method: 'POST' };
  if (body !== undefined) {
    fetchInit.headers = { 'Content-Type': 'application/json', ...(headers || {}) };
    fetchInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  } else if (headers) {
    fetchInit.headers = headers;
  }

  const res = await fetch(apiPath, fetchInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const length = Number(res.headers.get('content-length') || 0);
  const reader = res.body?.getReader?.();

  // Fallback if streaming unsupported
  if (!reader) {
    const blob = await res.blob();
    await saveBlob(blob, fileName);
    setPct(100);
    if (pctEl) pctEl.textContent = 'Done';
    setTimeout(() => setActive(false), 900);
    return;
  }

  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (length) setPct((received / length) * 100);
  }

  const blob = new Blob(chunks);
  await saveBlob(blob, fileName);

  setPct(100);
  if (pctEl) pctEl.textContent = 'Done';
  setTimeout(() => setActive(false), 900);
}

async function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Optional: expose globally for inline handlers
window.enqueueDownload = enqueueDownload;
window.downloadWithProgress = downloadWithProgress;

// -------------------------------------------------------------
// ExportManager (unchanged API; still works with your app)
// -------------------------------------------------------------
class ExportManager {
  constructor() {
    this.bookData = null;
  }

  setBookData(data) {
    this.bookData = data;
  }

  exportAsText() {
    if (!this.bookData) return showAlert('No book data to export', 'error');
    const textContent = this.generateTextContent();
    this.downloadFile(textContent, 'book.txt', CONFIG.EXPORT_FORMATS.TXT);
  }

  generateTextContent() {
    let content = '';
    const title = this.bookData.title || 'AI Generated Book';
    content += `${title}\n` + '='.repeat(title.length) + '\n\n';
    if (this.bookData.concept) content += 'CONCEPT\n-------\n' + this.bookData.concept + '\n\n';
    if (this.bookData.tableOfContents)
      content += 'TABLE OF CONTENTS\n-----------------\n' + this.bookData.tableOfContents + '\n\n';
    if (this.bookData.chapters?.length) {
      content += 'CHAPTERS\n--------\n\n';
      this.bookData.chapters.forEach((chapter, i) => {
        content += `Chapter ${i + 1}: ${chapter.title}\n`;
        content += '-'.repeat(`Chapter ${i + 1}: ${chapter.title}`.length) + '\n';
        content += this.stripHtml(chapter.content) + '\n\n';
      });
    }
    content += `\n\nGenerated by AI Book Generator on ${new Date().toLocaleString()}`;
    return content;
  }

  exportAsHtml() {
    if (!this.bookData) return showAlert('No book data to export', 'error');
    const htmlContent = this.generateHtmlContent(true);
    this.downloadFile(htmlContent, 'book.html', CONFIG.EXPORT_FORMATS.HTML);
  }

  generateHtmlContent(includeStyles = false) {
    const title = this.bookData.title || 'AI Generated Book';
    const styles = includeStyles
      ? `<style>
        body { font-family: 'Georgia', serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
        .book-title { text-align: center; font-size: 2.5em; margin-bottom: .5em; color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 20px; }
        .concept { background:#f8f9fa; padding:20px; border-left: 4px solid #3498db; margin:20px 0; }
        .table-of-contents { background:#fff; padding:20px; border:1px solid #ddd; margin:20px 0; white-space:pre-wrap; }
        .chapter { margin: 40px 0; page-break-before: always; }
        .chapter-title { color:#2c3e50; border-bottom:2px solid #3498db; padding-bottom:10px; margin-bottom:20px; }
        .chapter-content { text-align: justify; }
        .footer { margin-top: 50px; padding-top: 20px; border-top:1px solid #ddd; text-align:center; color:#666; font-size:.9em; }
        .cover { text-align:center; margin: 10px 0 30px; }
        .cover img { max-width:100%; height:auto; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,.15); }
        @media print { .chapter { page-break-before: always; } }
      </style>`
      : '';

    let html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(title)}</title>${styles}</head><body>`;

    html += `<h1 class="book-title">${this.escapeHtml(title)}</h1>`;
    if (this.bookData.coverImage)
      html += `<div class="cover"><img src="${this.bookData.coverImage}" alt="Book cover"></div>`;
    if (this.bookData.concept)
      html += `<div class="concept"><h2>Concept</h2><p>${this.escapeHtml(this.bookData.concept).replace(/\n/g, '</p><p>')}</p></div>`;
    if (this.bookData.tableOfContents)
      html += `<div class="table-of-contents"><h2>Table of Contents</h2><pre>${this.escapeHtml(this.bookData.tableOfContents)}</pre></div>`;
    if (this.bookData.chapters?.length) {
      this.bookData.chapters.forEach((chapter, i) => {
        html += `<div class="chapter">
          <h2 class="chapter-title">Chapter ${i + 1}: ${this.escapeHtml(chapter.title)}</h2>
          <div class="chapter-content">${chapter.content}</div>
        </div>`;
      });
    }
    html += `<div class="footer">Generated by AI Book Generator on ${new Date().toLocaleString()}</div></body></html>`;
    return html;
  }

  exportAsMarkdown() {
    if (!this.bookData) return showAlert('No book data to export', 'error');
    const markdownContent = this.generateMarkdownContent();
    this.downloadFile(markdownContent, 'book.md', CONFIG.EXPORT_FORMATS.MARKDOWN);
  }

  generateMarkdownContent() {
    let md = '';
    if (this.bookData.title) md += `# ${this.bookData.title}\n\n`;
    if (this.bookData.coverImage) md += `![Cover](# "Cover image not embedded in MD export")\n\n`;
    if (this.bookData.concept) md += '## Concept\n\n' + this.bookData.concept + '\n\n';
    if (this.bookData.tableOfContents) {
      md += '## Table of Contents\n\n';
      this.bookData.tableOfContents.split('\n').forEach((line, i) => {
        if (line.trim()) md += `${i + 1}. ${line.trim()}\n`;
      });
      md += '\n';
    }
    if (this.bookData.chapters?.length) {
      this.bookData.chapters.forEach((chapter, i) => {
        md += `## Chapter ${i + 1}: ${chapter.title}\n\n`;
        md += this.stripHtml(chapter.content) + '\n\n---\n\n';
      });
    }
    md += `*Generated by AI Book Generator on ${new Date().toLocaleString()}*\n`;
    return md;
  }

  exportAsJson() {
    if (!this.bookData) return showAlert('No book data to export', 'error');
    const jsonData = {
      ...this.bookData,
      metadata: {
        ...(this.bookData.metadata || {}),
        exportedAt: new Date().toISOString(),
        version: '2.1',
        generator: 'AI Book Generator'
      }
    };
    this.downloadFile(JSON.stringify(jsonData, null, 2), 'book.json', CONFIG.EXPORT_FORMATS.JSON);
  }

  async exportAsPdf() {
    if (!this.bookData) return showAlert('No book data to export', 'error');
    const html = this.generateHtmlContent(true);
    if (window.html2pdf) {
      try {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-10000px';
        container.innerHTML = html;
        document.body.appendChild(container);
        await window.html2pdf().set({
          filename: 'book.pdf',
          margin: 10,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
        }).from(container).save();
        document.body.removeChild(container);
        showAlert('PDF exported successfully!', 'success');
        return;
      } catch (e) {
        console.error(e);
        showAlert('PDF export failed, using print fallback.', 'warning');
      }
    }
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    const timer = setInterval(() => {
      if (printWindow && printWindow.document.readyState === 'complete') {
        clearInterval(timer);
        printWindow.focus();
        printWindow.print();
      }
    }, 300);
  }

  downloadFile(content, filename, mimeType) {
    try {
      const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      showAlert(`Book exported as ${filename}`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showAlert('Export failed. Please try again.', 'error');
    }
  }

  stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getWordCount() {
    if (!this.bookData?.chapters) return 0;
    return this.bookData.chapters.reduce((t, ch) => {
      const txt = this.stripHtml(ch.content);
      return t + txt.split(/\s+/).filter(w => w.length).length;
    }, 0);
  }

  getReadingTime() {
    const wc = this.getWordCount();
    const minutes = Math.ceil(wc / 200);
    if (minutes < 60) return `${minutes} minutes`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} hour${h > 1 ? 's' : ''} ${m} minutes`;
  }

  getBookStatistics() {
    if (!this.bookData) return null;
    const wordCount = this.getWordCount();
    const chapterCount = this.bookData.chapters?.length || 0;
    const avgChapterLength = chapterCount ? Math.round(wordCount / chapterCount) : 0;
    const charCount = this.bookData.chapters?.reduce(
      (t, ch) => t + this.stripHtml(ch.content).length, 0
    ) || 0;
    return {
      wordCount,
      chapterCount,
      averageChapterLength: avgChapterLength,
      readingTime: this.getReadingTime(),
      characterCount: charCount
    };
  }
}

export const exportManager = new ExportManager();

