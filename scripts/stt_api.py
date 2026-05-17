from fastapi import FastAPI, WebSocket
from faster_whisper import WhisperModel
import numpy as np

app = FastAPI()
model = WhisperModel("base", device="cpu", compute_type="int8")

@app.websocket("/transcribe")
async def transcribe_audio(websocket: WebSocket):
    await websocket.accept()

    while True:
        # Receive raw audio bytes from the browser
        audio_bytes = await websocket.receive_bytes()

        # Convert to numpy float32 array Whisper expects
        audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0

        # Transcribe
        segments, _ = model.transcribe(audio_np, language="en")
        text = " ".join([s.text for s in segments])

        # Send text back to browser
        await websocket.send_text(text)