/**
 * TTSEngine: High-reliability Web Speech API controller
 * Handles Portuguese (pt-BR) voice selection, speech synthesis,
 * real-time boundary tracking for karaoke-style text highlighting,
 * and Chrome long-speech pause prevention.
 */

export class TTSEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.ptVoices = [];
    this.selectedVoice = null;
    this.rate = 1.0; // 0.5 - 2.5
    this.pitch = 1.0;
    this.volume = 1.0;

    this.paragraphs = []; // Array of { id, text, element }
    this.currentIndex = -1;
    this.activeUtterance = null;
    this.heartbeatTimer = null;

    this.isPlaying = false;
    this.isPaused = false;

    // Callbacks
    this.onBoundary = null; // ({ paragraphIndex, charIndex, charLength, word }) => {}
    this.onParagraphStart = null; // (paragraphIndex) => {}
    this.onParagraphEnd = null; // (paragraphIndex) => {}
    this.onStateChange = null; // ({ isPlaying, isPaused, currentIndex }) => {}
    this.onVoicesReady = null; // (ptVoices) => {}
    this.onFinished = null; // () => {}
    this.onNextPageRequested = null; // () => {}
    this.onPrevPageRequested = null; // () => {}

    this.initVoices();
  }

  initVoices() {
    const loadVoices = () => {
      this.voices = this.synth.getVoices() || [];
      this.filterPtVoices();
      if (this.onVoicesReady) {
        this.onVoicesReady(this.ptVoices);
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  filterPtVoices() {
    // Filter for Portuguese (Brazil or generic pt)
    const ptAll = this.voices.filter(v => 
      v.lang.toLowerCase().startsWith('pt-br') ||
      v.lang.toLowerCase().startsWith('pt_br') ||
      v.lang.toLowerCase().startsWith('pt')
    );

    // Annotate and classify gender
    this.ptVoices = ptAll.map(voice => {
      const nameLower = voice.name.toLowerCase();
      let gender = 'neutro';

      if (
        nameLower.includes('francisca') ||
        nameLower.includes('maria') ||
        nameLower.includes('letícia') ||
        nameLower.includes('leticia') ||
        nameLower.includes('luciana') ||
        nameLower.includes('heloisa') ||
        nameLower.includes('vitoria') ||
        nameLower.includes('vitória') ||
        nameLower.includes('female') ||
        nameLower.includes('brasil') ||
        nameLower.includes('brazil')
      ) {
        gender = 'feminina';
      } else if (
        nameLower.includes('antonio') ||
        nameLower.includes('antônio') ||
        nameLower.includes('daniel') ||
        nameLower.includes('felipe') ||
        nameLower.includes('male') ||
        nameLower.includes('ricardo') ||
        nameLower.includes('homem')
      ) {
        gender = 'masculina';
      }

      const isNeural = nameLower.includes('natural');
      const isOnline = nameLower.includes('online') || nameLower.includes('google');

      return {
        voice,
        name: voice.name,
        lang: voice.lang,
        uri: voice.voiceURI,
        gender,
        isNeural,
        isOnline
      };
    });

    // Auto-select preferred voice if not set
    if (!this.selectedVoice && this.ptVoices.length > 0) {
      const preferred = this.ptVoices.find(v => v.isNeural) ||
                        this.ptVoices.find(v => v.isOnline) ||
                        this.ptVoices[0];
      this.selectedVoice = preferred.voice;
    }
  }

  setVoiceByUri(uri) {
    const found = this.ptVoices.find(v => v.uri === uri);
    if (found) {
      this.selectedVoice = found.voice;
      // Immediately apply new voice if currently speaking or paused
      if (this.isPlaying && this.currentIndex >= 0) {
        const wasPaused = this.isPaused;
        this.speakParagraph(this.currentIndex);
        if (wasPaused) {
          this.pause();
        }
      }
    }
  }

  setRate(newRate) {
    this.rate = Math.max(0.5, Math.min(2.5, newRate));
    // If currently speaking, restart current paragraph with new speed
    if (this.isPlaying && !this.isPaused && this.currentIndex >= 0) {
      const curr = this.currentIndex;
      this.speakParagraph(curr);
    }
  }

  loadParagraphs(paragraphList) {
    this.stop();
    this.paragraphs = paragraphList;
    this.currentIndex = -1;
  }

  playFromIndex(index = 0) {
    if (this.paragraphs.length === 0) return;
    if (index < 0 || index >= this.paragraphs.length) index = 0;

    this.isPlaying = true;
    this.isPaused = false;
    this.speakParagraph(index);
    this.notifyState();
  }

  speakParagraph(index) {
    if (!this.isPlaying) return;
    if (index >= this.paragraphs.length) {
      this.stop();
      if (this.onFinished) this.onFinished();
      return;
    }

    this.stopHeartbeat();
    this.synth.cancel(); // Clear any ongoing speech

    this.currentIndex = index;
    const item = this.paragraphs[index];
    if (!item || !item.text || item.text.trim().length === 0) {
      this.speakParagraph(index + 1);
      return;
    }

    // Clean pronunciation pitfalls so the voice reads smoothly
    const speechText = item.text
      .replace(/(\b[a-zA-ZÀ-ÿ]+)-\s+([a-zA-ZÀ-ÿ]+\b)/g, '$1$2')
      .replace(/(\b\w+)\/s\b/gi, '$1s')
      .replace(/\//g, ' ')
      .replace(/([a-zA-ZÀ-ÿ])\(/g, '$1 (')
      .replace(/\)([a-zA-ZÀ-ÿ])/g, ') $1')
      .replace(/\s+/g, ' ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(speechText);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;
    utterance.lang = this.selectedVoice ? this.selectedVoice.lang : 'pt-BR';

    utterance.onstart = () => {
      this.startHeartbeat();
      if (this.onParagraphStart) {
        this.onParagraphStart(this.currentIndex);
      }
      this.notifyState();
    };

    utterance.onboundary = (event) => {
      if (!this.isPlaying || this.isPaused) return;
      if (this.onBoundary) {
        this.onBoundary({
          paragraphIndex: this.currentIndex,
          charIndex: event.charIndex,
          charLength: event.charLength || 1,
          name: event.name,
          text: item.text
        });
      }
    };

    utterance.onend = () => {
      this.stopHeartbeat();
      if (this.onParagraphEnd) {
        this.onParagraphEnd(this.currentIndex);
      }
      if (this.isPlaying && !this.isPaused) {
        // Move immediately to next paragraph
        this.speakParagraph(this.currentIndex + 1);
      }
    };

    utterance.onerror = (e) => {
      console.warn('TTS Utterance error:', e);
      this.stopHeartbeat();
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        // Try to continue
        if (this.isPlaying && !this.isPaused) {
          this.speakParagraph(this.currentIndex + 1);
        }
      }
    };

    this.activeUtterance = utterance;
    this.synth.speak(utterance);
  }

  pause() {
    if (this.isPlaying && !this.isPaused) {
      this.isPaused = true;
      this.stopHeartbeat();
      this.synth.pause();
      this.notifyState();
    }
  }

  resume() {
    if (this.isPlaying && this.isPaused) {
      this.isPaused = false;
      this.startHeartbeat();
      this.synth.resume();
      this.notifyState();
    } else if (!this.isPlaying && this.paragraphs.length > 0) {
      this.playFromIndex(this.currentIndex >= 0 ? this.currentIndex : 0);
    }
  }

  togglePlayPause() {
    if (!this.isPlaying) {
      this.playFromIndex(this.currentIndex >= 0 ? this.currentIndex : 0);
    } else if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.stopHeartbeat();
    this.synth.cancel();
    this.activeUtterance = null;
    this.notifyState();
  }

  next() {
    if (this.paragraphs.length === 0) {
      if (this.onNextPageRequested) this.onNextPageRequested();
      return;
    }
    if (!this.isPlaying) {
      const target = this.currentIndex >= 0 && this.currentIndex < this.paragraphs.length - 1
        ? this.currentIndex + 1
        : 0;
      this.playFromIndex(target);
      return;
    }
    if (this.currentIndex < this.paragraphs.length - 1) {
      this.playFromIndex(this.currentIndex + 1);
    } else if (this.onNextPageRequested) {
      this.onNextPageRequested();
    }
  }

  previous() {
    if (this.paragraphs.length === 0) {
      if (this.onPrevPageRequested) this.onPrevPageRequested();
      return;
    }
    if (!this.isPlaying) {
      const target = this.currentIndex > 0 ? this.currentIndex - 1 : 0;
      this.playFromIndex(target);
      return;
    }
    if (this.currentIndex > 0) {
      this.playFromIndex(this.currentIndex - 1);
    } else if (this.onPrevPageRequested) {
      this.onPrevPageRequested();
    } else {
      this.playFromIndex(0);
    }
  }

  /**
   * Heartbeat fix for Chromium browsers to prevent TTS freezing on long texts
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isPlaying && !this.isPaused && this.synth.speaking) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 12000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  notifyState() {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        currentIndex: this.currentIndex,
        totalParagraphs: this.paragraphs.length
      });
    }
  }
}
