from faster_whisper import WhisperModel
import sounddevice as sd
import numpy as np
from collections import deque
import threading

model = WhisperModel("base", device="cpu", compute_type="int8")
SAMPLE_RATE = 16000
buffer = deque(maxlen=SAMPLE_RATE * 5)  # 3-second rolling buffer

def audio_callback(indata, frames, time, status):
    buffer.extend(indata[:, 0])

def transcribe_loop():
    while True:
        if len(buffer) == buffer.maxlen:
            audio = np.array(buffer, dtype=np.float32)
            segments, _ = model.transcribe(audio, language="en")
            for segment in segments:
                print(f">> {segment.text}")

with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, callback=audio_callback):
    t = threading.Thread(target=transcribe_loop, daemon=True)
    t.start()
    input("Press Enter to stop...\n")