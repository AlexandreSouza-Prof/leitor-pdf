/**
 * Main Application Orchestrator for Leitor Vocal PDF
 */

import { createIcons, icons } from 'lucide';
import { StorageManager } from './storageManager.js';
import { TTSEngine } from './ttsEngine.js';
import { PDFViewer } from './pdfViewer.js';

class App {
  constructor() {
    this.storage = StorageManager;
    this.preferences = this.storage.getPreferences();
    this.tts = new TTSEngine();
    this.pdfViewer = null;

    this.currentDocId = 'caderno-fotografia';
    this.currentPage = 1;
    this.totalPages = 1;
    this.currentParagraphs = [];

    this.initDOMElements();
    this.applyPreferences();
    this.initPDFViewer();
    this.initTTSEvents();
    this.initUIEventListeners();
    this.initKeyboardShortcuts();
    this.initDragAndDrop();

    // Render Lucide icons
    createIcons({ icons });

    // Auto-load sample document by default
    this.loadSamplePDF();
  }

  initDOMElements() {
    // Mode tabs
    this.tabReader = document.getElementById('btn-tab-reader');
    this.tabOriginal = document.getElementById('btn-tab-original');
    this.viewReader = document.getElementById('view-reader');
    this.viewOriginal = document.getElementById('view-original');

    // Sidebar
    this.sidebar = document.getElementById('study-sidebar');
    this.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    this.pagesList = document.getElementById('pages-list');
    this.progressText = document.getElementById('progress-text-pages');
    this.progressPercent = document.getElementById('progress-percent');
    this.progressBarFill = document.getElementById('progress-bar-fill');
    this.btnResumeReading = document.getElementById('btn-resume-reading');

    // Content containers
    this.originalContainer = document.getElementById('view-original');
    this.readerContainer = document.getElementById('reader-content');

    // Player controls
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.btnStop = document.getElementById('btn-stop');
    this.btnPrevPara = document.getElementById('btn-prev-paragraph');
    this.btnNextPara = document.getElementById('btn-next-paragraph');
    this.audioVisualizer = document.getElementById('audio-visualizer');
    this.playerTitle = document.getElementById('player-title');
    this.playerSubtitle = document.getElementById('player-subtitle');
    this.voiceSelect = document.getElementById('voice-select');

    // Speed chips
    this.speedChips = document.querySelectorAll('.speed-chip');

    // Page jump controls
    this.inputPageNum = document.getElementById('input-page-number');
    this.labelTotalPages = document.getElementById('label-total-pages');
    this.btnPrevPage = document.getElementById('btn-prev-page');
    this.btnNextPage = document.getElementById('btn-next-page');

    // Actions
    this.btnUploadFile = document.getElementById('btn-upload-file');
    this.fileInput = document.getElementById('file-input');

    // Themes & Font size
    this.themePills = document.querySelectorAll('.theme-pill');
    this.btnFontInc = document.getElementById('btn-font-inc');
    this.btnFontDec = document.getElementById('btn-font-dec');
  }

  applyPreferences() {
    // 1. Theme
    document.body.className = `theme-${this.preferences.theme}`;
    this.themePills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.theme === this.preferences.theme);
    });

    // 2. Font Size
    document.documentElement.style.setProperty('--reader-font-size', `${this.preferences.fontSize}px`);

    // 3. View Mode
    this.switchViewMode(this.preferences.viewMode || 'reader');

    // 4. Rate
    this.tts.setRate(this.preferences.rate);
    this.speedChips.forEach(chip => {
      chip.classList.toggle('active', parseFloat(chip.dataset.speed) === this.preferences.rate);
    });
  }

  initPDFViewer() {
    this.pdfViewer = new PDFViewer({
      originalContainer: this.originalContainer,
      readerContainer: this.readerContainer,
      onParagraphClick: (index) => {
        this.tts.playFromIndex(index);
      }
    });
  }

  initTTSEvents() {
    // Populate voice dropdown when pt-BR voices are ready
    this.tts.onVoicesReady = (ptVoices) => {
      this.populateVoiceDropdown(ptVoices);
    };

    // Word-by-word karaoke synchronization
    this.tts.onBoundary = (data) => {
      this.pdfViewer.highlightBoundary(data);
    };

    // Paragraph changed
    this.tts.onParagraphStart = (index) => {
      this.playerTitle.textContent = `Lendo parágrafo ${index + 1} de ${this.currentParagraphs.length}`;
      this.playerSubtitle.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
      
      // Save last read position in history
      this.storage.saveDocumentHistory(this.currentDocId, {
        currentPage: this.currentPage,
        lastParagraphIndex: index
      });
    };

    // State change (Play, Pause, Stop)
    this.tts.onStateChange = ({ isPlaying, isPaused, currentIndex }) => {
      this.updatePlayPauseIcon(isPlaying && !isPaused);
      if (isPlaying && !isPaused) {
        this.audioVisualizer.classList.add('playing');
      } else {
        this.audioVisualizer.classList.remove('playing');
      }

      if (!isPlaying) {
        this.playerTitle.textContent = 'Pronto para leitura';
        this.playerSubtitle.textContent = `Página ${this.currentPage} selecionada. Clique para ouvir.`;
        this.pdfViewer.clearHighlights();
      }
    };

    // Finished whole page
    this.tts.onFinished = () => {
      // Mark current page as read
      this.storage.markPageAsRead(this.currentDocId, this.currentPage, true);
      this.updateSidebarProgress();

      // If there is a next page, automatically advance and read!
      if (this.currentPage < this.totalPages) {
        this.goToPage(this.currentPage + 1, true);
      }
    };

    // Cross-page navigation when reaching end or start
    this.tts.onNextPageRequested = () => {
      if (this.currentPage < this.totalPages) {
        this.goToPage(this.currentPage + 1, true);
      }
    };

    this.tts.onPrevPageRequested = () => {
      if (this.currentPage > 1) {
        this.goToPage(this.currentPage - 1, true);
      }
    };
  }

  populateVoiceDropdown(ptVoices) {
    this.voiceSelect.innerHTML = '';

    if (ptVoices.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Voz padrão do navegador';
      this.voiceSelect.appendChild(opt);
      return;
    }

    ptVoices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.uri;

      const genderIcon = v.gender === 'feminina' ? '👩' : (v.gender === 'masculina' ? '👨' : '🗣️');
      let typeTag = '';
      if (v.isNeural) {
        typeTag = ' ✨ (Neural)';
      } else if (v.isOnline) {
        typeTag = ' 🌐 (Online)';
      } else {
        typeTag = ' 💻 (Local)';
      }
      opt.textContent = `${genderIcon} ${v.name}${typeTag}`;

      if (this.preferences.voiceURI && v.uri === this.preferences.voiceURI) {
        opt.selected = true;
        this.tts.setVoiceByUri(v.uri);
      } else if (!this.preferences.voiceURI && v.isNeural) {
        opt.selected = true;
        this.tts.setVoiceByUri(v.uri);
      }

      this.voiceSelect.appendChild(opt);
    });

    if (!this.preferences.voiceURI && this.voiceSelect.value) {
      this.tts.setVoiceByUri(this.voiceSelect.value);
    }
  }

  async loadSamplePDF() {
    this.playerTitle.textContent = 'Carregando caderno de exemplo...';
    try {
      const result = await this.pdfViewer.loadDocument('./exemplo.pdf', 'caderno-fotografia');
      this.handleDocumentLoaded(result);
    } catch (err) {
      console.warn('Could not load sample PDF directly:', err);
      this.playerTitle.textContent = 'Clique em "Abrir PDF" para carregar um arquivo';
    }
  }

  async loadFile(file) {
    this.playerTitle.textContent = `Carregando ${file.name}...`;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const docId = `pdf_${file.name.replace(/\s+/g, '_')}_${file.size}`;
      const result = await this.pdfViewer.loadDocument(arrayBuffer, docId);
      this.handleDocumentLoaded(result);
    } catch (err) {
      alert('Erro ao carregar o arquivo PDF. Verifique se o arquivo não está corrompido.');
      console.error(err);
    }
  }

  handleDocumentLoaded({ numPages, docId }) {
    this.totalPages = numPages;
    this.currentDocId = docId;
    this.labelTotalPages.textContent = `/ ${numPages}`;
    this.inputPageNum.max = numPages;

    // Check saved progress
    const history = this.storage.getDocumentHistory(this.currentDocId);
    const startPage = history.currentPage && history.currentPage <= numPages ? history.currentPage : 1;

    this.renderSidebarPageList();
    this.updateSidebarProgress();
    this.goToPage(startPage, false);
  }

  async goToPage(pageNum, autoPlay = false) {
    if (pageNum < 1 || pageNum > this.totalPages) return;

    this.tts.stop();
    this.currentPage = pageNum;
    this.inputPageNum.value = pageNum;

    // Render page
    const pageData = await this.pdfViewer.renderPage(pageNum);
    if (!pageData) return;

    this.currentParagraphs = pageData.paragraphs;
    this.tts.loadParagraphs(this.currentParagraphs);

    this.updateActivePageInSidebar();

    if (autoPlay) {
      this.tts.playFromIndex(0);
    } else {
      this.playerTitle.textContent = `Página ${pageNum} pronta`;
      this.playerSubtitle.textContent = `${this.currentParagraphs.length} blocos de texto identificados. Clique para ouvir.`;
    }
  }

  updatePlayPauseIcon(isPlaying) {
    const iconContainer = this.btnPlayPause;
    iconContainer.innerHTML = isPlaying
      ? '<i data-lucide="pause"></i>'
      : '<i data-lucide="play"></i>';
    createIcons({ icons });
  }

  switchViewMode(mode) {
    this.preferences.viewMode = mode;
    this.storage.savePreferences({ viewMode: mode });

    if (mode === 'original') {
      this.tabOriginal.classList.add('active');
      this.tabReader.classList.remove('active');
      this.viewOriginal.classList.add('active');
      this.viewReader.classList.remove('active');
    } else {
      this.tabReader.classList.add('active');
      this.tabOriginal.classList.remove('active');
      this.viewReader.classList.add('active');
      this.viewOriginal.classList.remove('active');
    }
  }

  renderSidebarPageList() {
    this.pagesList.innerHTML = '';
    const history = this.storage.getDocumentHistory(this.currentDocId);

    const fragment = document.createDocumentFragment();
    for (let p = 1; p <= this.totalPages; p++) {
      const btn = document.createElement('button');
      btn.className = `page-item-btn ${p === this.currentPage ? 'active' : ''}`;
      btn.dataset.page = p;

      const isRead = history.pagesRead && history.pagesRead[p];
      btn.innerHTML = `
        <span>Página ${p}</span>
        <span class="page-badge ${isRead ? 'read' : ''}">${isRead ? '✓ Lida' : ''}</span>
      `;

      btn.addEventListener('click', () => {
        this.goToPage(p, false);
      });

      fragment.appendChild(btn);
    }
    this.pagesList.appendChild(fragment);
  }

  updateActivePageInSidebar() {
    const buttons = this.pagesList.querySelectorAll('.page-item-btn');
    buttons.forEach(btn => {
      const p = parseInt(btn.dataset.page, 10);
      btn.classList.toggle('active', p === this.currentPage);
    });
  }

  updateSidebarProgress() {
    const history = this.storage.getDocumentHistory(this.currentDocId);
    const readCount = Object.values(history.pagesRead || {}).filter(Boolean).length;
    const percent = this.totalPages > 0 ? Math.round((readCount / this.totalPages) * 100) : 0;

    this.progressText.textContent = `Páginas lidas: ${readCount} / ${this.totalPages}`;
    this.progressPercent.textContent = `${percent}%`;
    this.progressBarFill.style.width = `${percent}%`;

    // Refresh page badges
    const buttons = this.pagesList.querySelectorAll('.page-item-btn');
    buttons.forEach(btn => {
      const p = parseInt(btn.dataset.page, 10);
      const isRead = history.pagesRead && history.pagesRead[p];
      const badge = btn.querySelector('.page-badge');
      if (badge) {
        badge.className = `page-badge ${isRead ? 'read' : ''}`;
        badge.textContent = isRead ? '✓ Lida' : '';
      }
    });
  }

  initUIEventListeners() {
    // Mode Tabs
    this.tabReader.addEventListener('click', () => this.switchViewMode('reader'));
    this.tabOriginal.addEventListener('click', () => this.switchViewMode('original'));

    // Sidebar Toggle
    this.btnToggleSidebar.addEventListener('click', () => {
      this.sidebar.classList.toggle('collapsed');
    });

    // Resume reading button
    this.btnResumeReading.addEventListener('click', () => {
      const history = this.storage.getDocumentHistory(this.currentDocId);
      if (history.currentPage) {
        this.goToPage(history.currentPage, false);
        if (history.lastParagraphIndex !== undefined) {
          setTimeout(() => {
            this.tts.playFromIndex(history.lastParagraphIndex);
          }, 300);
        }
      }
    });

    // Play / Pause / Stop
    this.btnPlayPause.addEventListener('click', () => {
      this.tts.togglePlayPause();
    });

    this.btnStop.addEventListener('click', () => {
      this.tts.stop();
    });

    // Skip paragraph controls
    this.btnPrevPara.addEventListener('click', () => {
      this.tts.previous();
    });

    this.btnNextPara.addEventListener('click', () => {
      this.tts.next();
    });

    // Page navigation
    this.btnPrevPage.addEventListener('click', () => {
      if (this.currentPage > 1) this.goToPage(this.currentPage - 1, false);
    });

    this.btnNextPage.addEventListener('click', () => {
      if (this.currentPage < this.totalPages) this.goToPage(this.currentPage + 1, false);
    });

    this.inputPageNum.addEventListener('change', (e) => {
      const p = parseInt(e.target.value, 10);
      if (!isNaN(p)) this.goToPage(p, false);
    });

    // Speed chips
    this.speedChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.speedChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const rate = parseFloat(chip.dataset.speed);
        this.tts.setRate(rate);
        this.storage.savePreferences({ rate });
      });
    });

    // Voice Selection
    this.voiceSelect.addEventListener('change', (e) => {
      const uri = e.target.value;
      this.tts.setVoiceByUri(uri);
      this.storage.savePreferences({ voiceURI: uri });
      // If idle, start reading immediately with the selected voice for instant feedback
      if (!this.tts.isPlaying && this.currentParagraphs.length > 0) {
        const idx = this.tts.currentIndex >= 0 ? this.tts.currentIndex : 0;
        this.tts.playFromIndex(idx);
      }
    });

    // Theme Picker
    this.themePills.forEach(pill => {
      pill.addEventListener('click', () => {
        const theme = pill.dataset.theme;
        this.themePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        document.body.className = `theme-${theme}`;
        this.storage.savePreferences({ theme });
      });
    });

    // Font Size Adjusters
    this.btnFontInc.addEventListener('click', () => {
      let size = (this.preferences.fontSize || 18) + 2;
      if (size > 28) size = 28;
      this.preferences.fontSize = size;
      document.documentElement.style.setProperty('--reader-font-size', `${size}px`);
      this.storage.savePreferences({ fontSize: size });
    });

    this.btnFontDec.addEventListener('click', () => {
      let size = (this.preferences.fontSize || 18) - 2;
      if (size < 14) size = 14;
      this.preferences.fontSize = size;
      document.documentElement.style.setProperty('--reader-font-size', `${size}px`);
      this.storage.savePreferences({ fontSize: size });
    });

    // Upload button
    this.btnUploadFile.addEventListener('click', () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type === 'application/pdf') {
        this.loadFile(file);
      }
    });
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts if focus is in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.tts.togglePlayPause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.tts.next();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.tts.previous();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        const newRate = Math.min(2.5, +(this.tts.rate + 0.25).toFixed(2));
        this.tts.setRate(newRate);
        this.storage.savePreferences({ rate: newRate });
        this.updateSpeedChipActive(newRate);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const newRate = Math.max(0.5, +(this.tts.rate - 0.25).toFixed(2));
        this.tts.setRate(newRate);
        this.storage.savePreferences({ rate: newRate });
        this.updateSpeedChipActive(newRate);
      }
    });
  }

  updateSpeedChipActive(rate) {
    this.speedChips.forEach(chip => {
      chip.classList.toggle('active', parseFloat(chip.dataset.speed) === rate);
    });
  }

  initDragAndDrop() {
    const overlay = document.getElementById('dropzone-overlay');
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      overlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        overlay.classList.remove('active');
        dragCounter = 0;
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('active');

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          this.loadFile(file);
        } else {
          alert('Por favor, solte um arquivo PDF válido.');
        }
      }
    });
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.leitorApp = new App();
});
