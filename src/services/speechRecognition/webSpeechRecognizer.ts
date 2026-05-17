type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isWebSpeechAvailable(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export class WebSpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private active = false;
  private onFinalRef: ((text: string) => void) | null = null;

  start(onFinal: (text: string) => void): boolean {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return false;

    this.stop();
    this.onFinalRef = onFinal;
    this.active = true;

    const recognition = new Ctor();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal && result[0]?.transcript) {
          this.onFinalRef?.(result[0].transcript);
        }
      }
    };

    recognition.onend = () => {
      if (this.active && this.recognition === recognition) {
        try {
          recognition.start();
        } catch {
          // Reinicio tras onend; ignorar si el navegador rechaza
        }
      }
    };

    recognition.onerror = () => {
      // El motor suele recuperarse solo vía onend
    };

    this.recognition = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      this.recognition = null;
      this.active = false;
      return false;
    }
  }

  stop(): void {
    this.active = false;
    this.onFinalRef = null;
    if (this.recognition) {
      this.recognition.onend = null;
      try {
        this.recognition.stop();
      } catch {
        // ya detenido
      }
      this.recognition = null;
    }
  }
}
