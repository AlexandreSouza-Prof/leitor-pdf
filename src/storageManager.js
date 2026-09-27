/**
 * Storage Manager for Leitor Vocal PDF
 * Manages user preferences, reading positions, and history in localStorage
 */

const STORAGE_KEY_PREFS = 'leitor_pdf_preferences_v1';
const STORAGE_KEY_HISTORY = 'leitor_pdf_history_v1';

export class StorageManager {
  static getDefaultPreferences() {
    return {
      theme: 'dark', // 'light' | 'sepia' | 'dark'
      fontSize: 18, // px for Reader mode
      rate: 1.0, // Speech rate (0.5 to 2.5)
      voiceURI: '', // Selected voice identifier
      viewMode: 'reader', // 'original' | 'reader'
      autoScroll: true,
      highlightColor: 'warm' // 'warm' | 'cyan' | 'green'
    };
  }

  static getPreferences() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        return { ...this.getDefaultPreferences(), ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load preferences:', e);
    }
    return this.getDefaultPreferences();
  }

  static savePreferences(prefs) {
    try {
      const current = this.getPreferences();
      const updated = { ...current, ...prefs };
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn('Failed to save preferences:', e);
    }
  }

  static getDocumentHistory(docId) {
    try {
      const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '{}');
      return allHistory[docId] || {
        currentPage: 1,
        lastParagraphIndex: 0,
        pagesRead: {},
        updatedAt: Date.now()
      };
    } catch (e) {
      console.warn('Failed to load document history:', e);
      return { currentPage: 1, lastParagraphIndex: 0, pagesRead: {}, updatedAt: Date.now() };
    }
  }

  static saveDocumentHistory(docId, data) {
    try {
      const allHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '{}');
      const current = allHistory[docId] || { pagesRead: {} };
      allHistory[docId] = {
        ...current,
        ...data,
        pagesRead: { ...(current.pagesRead || {}), ...(data.pagesRead || {}) },
        updatedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(allHistory));
    } catch (e) {
      console.warn('Failed to save document history:', e);
    }
  }

  static markPageAsRead(docId, pageNumber, isRead = true) {
    const history = this.getDocumentHistory(docId);
    history.pagesRead[pageNumber] = isRead;
    this.saveDocumentHistory(docId, history);
    return history;
  }
}
