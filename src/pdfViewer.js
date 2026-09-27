/**
 * PDFViewer: Controls PDF.js rendering, text layer synchronization,
 * and Reader Mode extraction with word-by-word highlight mapping.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set official PDF.js Web Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class PDFViewer {
  constructor({ originalContainer, readerContainer, onParagraphClick }) {
    this.originalContainer = originalContainer;
    this.readerContainer = readerContainer;
    this.onParagraphClick = onParagraphClick;

    this.pdfDoc = null;
    this.currentDocId = 'default';
    this.currentPageNum = 1;
    this.totalNumPages = 0;
    this.scale = 1.35; // Default crisp scale for desktop viewing

    this.currentParagraphs = []; // Formatted text blocks for current page
    this.activeHighlightEl = null;
    this.activeParagraphEl = null;
    this.currentOriginalParaIndex = -1;

    this.renderTask = null;
  }

  async loadDocument(source, docId = 'document') {
    if (this.renderTask) {
      try {
        await this.renderTask.promise;
      } catch (e) {
        // Cancelled or finished
      }
    }

    this.currentDocId = docId;
    let loadingTask;
    if (typeof source === 'string') {
      loadingTask = pdfjsLib.getDocument({ url: source });
    } else {
      loadingTask = pdfjsLib.getDocument({ data: source });
    }

    this.pdfDoc = await loadingTask.promise;
    this.totalNumPages = this.pdfDoc.numPages;
    return {
      numPages: this.totalNumPages,
      docId: this.currentDocId
    };
  }

  async renderPage(pageNumber) {
    if (!this.pdfDoc || pageNumber < 1 || pageNumber > this.totalNumPages) {
      return null;
    }

    this.currentPageNum = pageNumber;
    const page = await this.pdfDoc.getPage(pageNumber);

    // 1. Extract raw text items for building semantic paragraphs
    const textContent = await page.getTextContent();
    const parsedData = this.parseTextContent(textContent);
    this.currentParagraphs = parsedData.paragraphs;

    // 2. Render Original View (Canvas + TextLayer)
    await this.renderOriginalView(page, textContent);

    // 3. Render Reader View (Typography-first Kindle/book mode)
    this.renderReaderView(this.currentParagraphs);

    return {
      pageNumber,
      paragraphs: this.currentParagraphs,
      totalPages: this.totalNumPages
    };
  }

  /**
   * Intelligently groups raw PDF text items into coherent paragraphs and sentences.
   */
  parseTextContent(textContent) {
    const items = textContent.items;
    if (!items || items.length === 0) {
      return { paragraphs: [] };
    }

    const validItems = items.filter(it => it.str && it.str.trim() !== '');
    if (validItems.length === 0) {
      return { paragraphs: [] };
    }

    // 1. Sort items top-to-bottom (Y descending in PDF space), then left-to-right (X ascending)
    validItems.sort((a, b) => {
      const dy = Math.round(b.transform[5]) - Math.round(a.transform[5]);
      if (Math.abs(dy) > 5) return dy;
      return a.transform[4] - b.transform[4];
    });

    // 2. Group items into lines
    const rawLines = [];
    let currentLine = [];
    let lastY = null;

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      const y = Math.round(item.transform[5]);
      if (lastY === null || Math.abs(y - lastY) <= 6) {
        currentLine.push(item);
      } else {
        if (currentLine.length > 0) {
          currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
          rawLines.push({ text: currentLine.map(it => it.str).join(' ').trim(), y: lastY });
        }
        currentLine = [item];
      }
      lastY = y;
    }
    if (currentLine.length > 0) {
      currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
      rawLines.push({ text: currentLine.map(it => it.str).join(' ').trim(), y: lastY });
    }

    // 3. Group lines into blocks using vertical spacing and punctuation
    const rawBlocks = [];
    let currentBlock = [];
    let prevLineY = null;

    rawLines.forEach((line) => {
      const lineStr = line.text;
      if (!lineStr) return;

      const isHeader = lineStr.length < 50 && (
        /^\d+(\.\d+)*\s+[A-Z]/.test(lineStr) ||
        (lineStr.toUpperCase() === lineStr && lineStr.length > 4)
      );

      const hasGap = prevLineY !== null && Math.abs(prevLineY - line.y) > 22;

      if (isHeader || hasGap) {
        if (currentBlock.length > 0) {
          rawBlocks.push({ text: currentBlock.join(' '), isHeader: false });
          currentBlock = [];
        }
        if (isHeader) {
          rawBlocks.push({ text: lineStr, isHeader: true });
        } else {
          currentBlock.push(lineStr);
        }
      } else {
        currentBlock.push(lineStr);
        if (/[.:!?]$/.test(lineStr) && currentBlock.join(' ').length > 80) {
          rawBlocks.push({ text: currentBlock.join(' '), isHeader: false });
          currentBlock = [];
        }
      }
      prevLineY = line.y;
    });

    if (currentBlock.length > 0) {
      rawBlocks.push({ text: currentBlock.join(' '), isHeader: false });
    }

    // 4. Split raw blocks into coherent sentence-level reading units
    const paragraphs = [];
    rawBlocks.forEach((block) => {
      if (block.isHeader) {
        paragraphs.push(this.createParagraphObject(paragraphs.length, block.text, true));
      } else {
        const sentences = this.splitIntoSentences(block.text);
        if (sentences.length === 0) {
          sentences.push(block.text);
        }
        sentences.forEach((s) => {
          paragraphs.push(this.createParagraphObject(paragraphs.length, s, false));
        });
      }
    });

    return { paragraphs };
  }

  /**
   * Intelligently splits Portuguese text into sentences without breaking
   * numbered headers, abbreviations, or hyphenated line breaks.
   */
  splitIntoSentences(text) {
    if (!text || text.trim().length === 0) return [];

    // 1. Un-hyphenate words broken across lines (e.g. "foto- gráfica" -> "fotográfica")
    let clean = text.replace(/(\b[a-zA-ZÀ-ÿ]+)-\s+([a-zA-ZÀ-ÿ]+\b)/g, '$1$2');

    // 2. Normalize slashes in words like "conteudista/s" -> "conteudistas" or "e/ou" -> "e ou"
    clean = clean.replace(/(\b\w+)\/s\b/gi, '$1s');
    clean = clean.replace(/\//g, ' ');

    // 3. Protect numbered headers (e.g. "1. Enquadramento", "1.1 Introdução")
    clean = clean.replace(/(\b\d+(\.\d+)*)\.(\s+)/g, '$1§DOT§$3');

    // 4. Protect common abbreviations so they don't break mid-sentence
    clean = clean.replace(/\b(pág|págs|art|arts|inc|prof|dr|dra|sr|sra|ex|etc|obs|cap|fig)\./gi, '$1§DOT§');

    // 5. Split on periods, exclamation marks, or question marks followed by space and capital letter or number
    const rawSentences = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9À-Ú])/);

    return rawSentences
      .map(s => s.replace(/§DOT§/g, '.').trim())
      .filter(s => s.length > 0);
  }

  createParagraphObject(index, text, isHeader = false) {
    // Break paragraph text into word token positions for accurate boundary highlighting
    const words = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      words.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return {
      index,
      text,
      isHeader,
      words
    };
  }

  /**
   * Renders high-DPI Canvas with official TextLayer overlay
   */
  async renderOriginalView(page, textContent) {
    const container = this.originalContainer;
    container.innerHTML = '';

    const viewport = page.getViewport({ scale: this.scale });
    const outputScale = window.devicePixelRatio || 1;

    // Wrapper for relative positioning of TextLayer over Canvas
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'pdf-page-wrapper';
    pageWrapper.style.width = `${Math.floor(viewport.width)}px`;
    pageWrapper.style.height = `${Math.floor(viewport.height)}px`;

    // 1. Canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-canvas';
    const ctx = canvas.getContext('2d');
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    // 2. Text Layer Div
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
    textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

    pageWrapper.appendChild(canvas);
    pageWrapper.appendChild(textLayerDiv);
    container.appendChild(pageWrapper);

    // Render Canvas
    const renderContext = {
      canvasContext: ctx,
      transform: transform,
      viewport: viewport
    };

    this.renderTask = page.render(renderContext);
    await this.renderTask.promise;

    // Render Text Layer
    try {
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: viewport
      });
      await textLayer.render();
      this.annotateOriginalSpans(textLayerDiv);
      this.attachOriginalTextClickEvents(textLayerDiv);
    } catch (err) {
      console.warn('TextLayer render warning:', err);
    }
  }

  annotateOriginalSpans(textLayerDiv) {
    const spans = Array.from(textLayerDiv.querySelectorAll('span'));
    let spanCursor = 0;

    this.currentParagraphs.forEach((para) => {
      para.originalSpans = [];
      const cleanPara = para.text.toLowerCase().replace(/\s+/g, ' ').trim();

      for (let i = spanCursor; i < spans.length; i++) {
        const spanText = spans[i].textContent.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!spanText) continue;

        if (cleanPara.includes(spanText) || spanText.includes(cleanPara)) {
          spans[i].dataset.paragraphIndex = String(para.index);
          para.originalSpans.push(spans[i]);
          spanCursor = i + 1;
        } else if (para.originalSpans.length > 0) {
          break;
        }
      }
    });
  }

  attachOriginalTextClickEvents(textLayerDiv) {
    textLayerDiv.addEventListener('click', (e) => {
      const target = e.target.closest('span');
      if (target) {
        if (target.dataset.paragraphIndex !== undefined) {
          const pIdx = parseInt(target.dataset.paragraphIndex, 10);
          if (!isNaN(pIdx) && this.onParagraphClick) {
            this.onParagraphClick(pIdx);
            return;
          }
        }
        const clickedText = target.textContent.trim();
        if (clickedText.length > 0) {
          const matchIndex = this.currentParagraphs.findIndex(p => p.text.includes(clickedText));
          if (matchIndex >= 0 && this.onParagraphClick) {
            this.onParagraphClick(matchIndex);
          }
        }
      }
    });
  }

  /**
   * Renders Reader Mode (Clean book / Kindle experience with interactive word spans)
   */
  renderReaderView(paragraphs) {
    const container = this.readerContainer;
    container.innerHTML = '';

    if (paragraphs.length === 0) {
      container.innerHTML = `
        <div class="reader-empty">
          <p>Esta página não possui texto selecionável ou é composta por ilustrações.</p>
        </div>
      `;
      return;
    }

    const docFrag = document.createDocumentFragment();

    paragraphs.forEach((para) => {
      const pEl = document.createElement(para.isHeader ? 'h3' : 'p');
      pEl.className = `reader-paragraph ${para.isHeader ? 'reader-heading' : ''}`;
      pEl.dataset.paragraphIndex = para.index;

      // Play button hint for this paragraph
      const playBtn = document.createElement('button');
      playBtn.className = 'para-play-btn';
      playBtn.title = 'Ouvir a partir deste parágrafo';
      playBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      `;
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onParagraphClick) {
          this.onParagraphClick(para.index);
        }
      });
      pEl.appendChild(playBtn);

      // Wrap each word in a span so boundary highlights can glow word-by-word
      const textWrapper = document.createElement('span');
      textWrapper.className = 'para-content';

      // We render words and preserved whitespace
      let html = '';
      let lastIndex = 0;
      para.words.forEach((w, wIdx) => {
        // Space before word
        if (w.start > lastIndex) {
          html += para.text.substring(lastIndex, w.start);
        }
        html += `<span class="reader-word" data-word-idx="${wIdx}" data-start="${w.start}" data-end="${w.end}">${escapeHtml(w.word)}</span>`;
        lastIndex = w.end;
      });
      if (lastIndex < para.text.length) {
        html += para.text.substring(lastIndex);
      }

      textWrapper.innerHTML = html;
      pEl.appendChild(textWrapper);

      // Clicking paragraph starts reading from it
      pEl.addEventListener('click', () => {
        if (this.onParagraphClick) {
          this.onParagraphClick(para.index);
        }
      });

      docFrag.appendChild(pEl);
    });

    container.appendChild(docFrag);
  }

  /**
   * Word-by-word highlight synchronization with steady viewport
   */
  highlightBoundary({ paragraphIndex, charIndex, charLength }) {
    const originalViewEl = document.getElementById('view-original');
    const readerViewEl = document.getElementById('view-reader');
    const isOriginalActive = originalViewEl && originalViewEl.classList.contains('active');
    const isReaderActive = readerViewEl && readerViewEl.classList.contains('active');

    // 1. If Original PDF view is active, highlight the exact sentence smoothly
    if (isOriginalActive) {
      this.highlightOriginalView(paragraphIndex);
    }

    // 2. If Reader Mode is active, update the typography highlight
    if (isReaderActive) {
      if (this.activeParagraphEl && this.activeParagraphEl.dataset.paragraphIndex !== String(paragraphIndex)) {
        this.activeParagraphEl.classList.remove('active-reading-paragraph');
      }

      const currentParaEl = this.readerContainer.querySelector(`[data-paragraph-index="${paragraphIndex}"]`);
      if (currentParaEl && currentParaEl !== this.activeParagraphEl) {
        currentParaEl.classList.add('active-reading-paragraph');
        this.activeParagraphEl = currentParaEl;

        // Smooth scroll in reader mode only if outside comfort viewport
        const scrollContainer = document.getElementById('viewport-scroll');
        if (scrollContainer) {
          const paraRect = currentParaEl.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          const isVisible = (
            paraRect.top >= containerRect.top + 70 &&
            paraRect.bottom <= containerRect.bottom - 100
          );
          if (!isVisible) {
            currentParaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }

      // Word highlight in Reader mode
      if (this.activeHighlightEl) {
        this.activeHighlightEl.classList.remove('karaoke-highlight');
        this.activeHighlightEl = null;
      }

      if (currentParaEl) {
        const words = currentParaEl.querySelectorAll('.reader-word');
        for (let i = 0; i < words.length; i++) {
          const wStart = parseInt(words[i].dataset.start, 10);
          const wEnd = parseInt(words[i].dataset.end, 10);

          if (charIndex >= wStart && charIndex <= wEnd) {
            words[i].classList.add('karaoke-highlight');
            this.activeHighlightEl = words[i];
            break;
          }
        }
      }
    }
  }

  highlightOriginalView(paragraphIndex) {
    const textLayer = this.originalContainer.querySelector('.textLayer');
    if (!textLayer) return;

    if (this.currentOriginalParaIndex === paragraphIndex) {
      return; // Already highlighted smoothly on this sentence, no unnecessary DOM changes
    }
    this.currentOriginalParaIndex = paragraphIndex;

    // Clear previous highlights
    const previous = textLayer.querySelectorAll('.original-word-highlight');
    previous.forEach(s => s.classList.remove('original-word-highlight'));

    const para = this.currentParagraphs[paragraphIndex];
    if (!para || !para.originalSpans || para.originalSpans.length === 0) return;

    // Highlight all spans for this sentence
    para.originalSpans.forEach(s => s.classList.add('original-word-highlight'));

    // Steady, gentle scroll: ONLY scroll if sentence is not comfortably in view
    const firstSpan = para.originalSpans[0];
    const scrollContainer = document.getElementById('viewport-scroll');
    if (firstSpan && scrollContainer) {
      const spanRect = firstSpan.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      const isVisible = (
        spanRect.top >= containerRect.top + 70 &&
        spanRect.bottom <= containerRect.bottom - 110
      );

      if (!isVisible) {
        firstSpan.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }

  clearHighlights() {
    this.currentOriginalParaIndex = -1;
    if (this.activeHighlightEl) {
      this.activeHighlightEl.classList.remove('karaoke-highlight');
      this.activeHighlightEl = null;
    }
    if (this.activeParagraphEl) {
      this.activeParagraphEl.classList.remove('active-reading-paragraph');
      this.activeParagraphEl = null;
    }
    const origHighs = this.originalContainer.querySelectorAll('.original-word-highlight');
    origHighs.forEach(el => el.classList.remove('original-word-highlight'));
  }

  setZoom(delta) {
    const newScale = Math.max(0.8, Math.min(2.5, this.scale + delta));
    if (newScale !== this.scale) {
      this.scale = newScale;
      this.renderPage(this.currentPageNum);
    }
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
