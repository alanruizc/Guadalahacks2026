
import sys, json, time, argparse, subprocess, tempfile, os
from collections import deque
from threading import Lock
 
try:
    from vosk import Model, KaldiRecognizer
except ImportError:
    print("pip install vosk")
    sys.exit(1)
 
try:
    from fastapi import FastAPI, UploadFile, File, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    import uvicorn
except ImportError:
    print("pip install fastapi uvicorn python-multipart")
    sys.exit(1)
 
# ── Constants ────────────────────────────────────────────────────────────────
 
SAMPLE_RATE   = 16000
COMMAND_TTL   = 10.0   # seconds waiting for recipient after SEND_MESSAGE
COPILOT_TTL   = 8.0    # seconds wake word stays active
 
COMMAND_MAP = {
    "mandar mensaje a": "SEND_MESSAGE",
}
 
# ── Shared state ─────────────────────────────────────────────────────────────
 
command_lock    = Lock()
command_history: deque = deque(maxlen=50)
 
pending_state = {
    "active_copilot":    False,
    "copilot_expires":   None,
    "awaiting_followup": None,
    "followup_expires":  None,
}
 
# Vosk recognizer is stateful — one shared instance per session
rec: KaldiRecognizer = None
 
# ── Helpers ──────────────────────────────────────────────────────────────────
 
def is_expired(expires) -> bool:
    return expires is None or time.time() > expires
 
 
def push_command(text: str, command: str, confidence: float, is_final: bool = True):
    entry = {
        "text":       text,
        "command":    command,
        "is_final":   is_final,
        "confidence": confidence,
        "timestamp":  time.time(),
    }
    with command_lock:
        command_history.appendleft(entry)
    return entry
 
 
def map_command(text: str):
    lower = text.lower()
    for phrase, cmd in COMMAND_MAP.items():
        if phrase in lower:
            return cmd, 0.95
    return None, 0.0
 
 
def convert_to_pcm(audio_bytes: bytes) -> bytes:
    """Convert any audio format (webm/opus/ogg) to 16kHz mono PCM via ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_in:
        tmp_in.write(audio_bytes)
        tmp_in_path = tmp_in.name
 
    tmp_out_path = tmp_in_path + ".pcm"
 
    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", tmp_in_path,
                "-ar", str(SAMPLE_RATE),
                "-ac", "1",
                "-f", "s16le",
                tmp_out_path,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
        with open(tmp_out_path, "rb") as f:
            return f.read()
    finally:
        os.unlink(tmp_in_path)
        if os.path.exists(tmp_out_path):
            os.unlink(tmp_out_path)
 
 
def process_text(texto: str) -> dict:
    """Apply wake-word + command state machine to a recognized text segment."""
    if not texto:
        return None
 
    lower = texto.lower()
 
    with command_lock:
        # Expire stale states
        now = time.time()
        if pending_state["active_copilot"] and is_expired(pending_state["copilot_expires"]):
            pending_state["active_copilot"]  = False
            pending_state["copilot_expires"] = None
 
        if pending_state["awaiting_followup"] and is_expired(pending_state["followup_expires"]):
            expired = push_command("", pending_state["awaiting_followup"] + "_EXPIRED", 0.0)
            pending_state["awaiting_followup"] = None
            pending_state["followup_expires"]  = None
            return expired
 
        # Wake word
        if "copiloto" in lower:
            pending_state["active_copilot"]  = True
            pending_state["copilot_expires"] = now + COPILOT_TTL
            return push_command(texto, "WAKE_WORD", 0.99)
 
        if not pending_state["active_copilot"]:
            return None
 
        # Follow-up target (e.g. recipient name)
        if pending_state["awaiting_followup"]:
            parent = pending_state["awaiting_followup"]
            pending_state["awaiting_followup"] = None
            pending_state["followup_expires"]  = None
            pending_state["active_copilot"]    = False
            return push_command(texto, f"{parent}_TARGET", 0.90)
 
        # Known command
        command, confidence = map_command(texto)
        if command is None:
            return None
 
        if command == "SEND_MESSAGE":
            pending_state["awaiting_followup"] = "SEND_MESSAGE"
            pending_state["followup_expires"]  = now + COMMAND_TTL
            pending_state["active_copilot"]    = False
            return push_command(texto, "SEND_MESSAGE", confidence, is_final=False)
 
    return None
 
 
# ── FastAPI ──────────────────────────────────────────────────────────────────
 
app = FastAPI(title="Voice Command API")
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
 
 
@app.post("/audio-chunk")
async def receive_audio_chunk(file: UploadFile = File(...)):
    """
    Receives a raw audio chunk from the phone browser (webm/opus),
    converts it to PCM, runs Vosk, and returns any recognized command.
    """
    global rec
    if rec is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
 
    audio_bytes = await file.read()
    if not audio_bytes:
        return JSONResponse({"command": None})
 
    try:
        pcm = convert_to_pcm(audio_bytes)
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=422, detail="Audio conversion failed — is ffmpeg installed?")
 
    # Feed PCM to Vosk in chunks
    result_command = None
    chunk_size = 4000
 
    for i in range(0, len(pcm), chunk_size):
        chunk = pcm[i : i + chunk_size]
        if rec.AcceptWaveform(chunk):
            texto = json.loads(rec.Result()).get("text", "").strip()
            cmd = process_text(texto)
            if cmd:
                result_command = cmd
 
    # Also check partial final
    texto_p = json.loads(rec.PartialResult()).get("partial", "").strip()
    if texto_p and not result_command:
        # Return partial as info only, don't process as command yet
        return JSONResponse({
            "text":       texto_p,
            "command":    None,
            "is_final":   False,
            "confidence": 0.0,
            "partial":    True,
        })
 
    if result_command:
        return JSONResponse(result_command)
 
    return JSONResponse({"text": "", "command": None, "is_final": False, "confidence": 0.0})
 
 
@app.get("/command")
def get_latest_command():
    with command_lock:
        if not command_history:
            return {"text": "", "command": None, "is_final": False, "confidence": 0.0}
        return command_history[0]
 
 
@app.get("/status")
def get_status():
    with command_lock:
        now = time.time()
        return {
            "active_copilot":         pending_state["active_copilot"],
            "copilot_ttl_remaining":  max(0.0, (pending_state["copilot_expires"]  or now) - now),
            "awaiting_followup":      pending_state["awaiting_followup"],
            "followup_ttl_remaining": max(0.0, (pending_state["followup_expires"] or now) - now),
        }
 
 
@app.delete("/commands")
def clear_history():
    with command_lock:
        command_history.clear()
    return {"cleared": True}
 
 
# ── Entry point ──────────────────────────────────────────────────────────────
 
def main():
    global rec
 
    parser = argparse.ArgumentParser()
    parser.add_argument("--modelo", "-m", default="modelo")
    parser.add_argument("--host",         default="0.0.0.0")
    parser.add_argument("--port",         type=int, default=8000)
    parser.add_argument("--cert",         default=None, help="Path to cert.pem for HTTPS")
    parser.add_argument("--key",          default=None, help="Path to key.pem for HTTPS")
    args = parser.parse_args()
 
    try:
        modelo = Model(args.modelo)
    except Exception as e:
        print(f"Error cargando modelo: {e}")
        sys.exit(1)
 
    rec = KaldiRecognizer(modelo, SAMPLE_RATE)
    rec.SetWords(False)
    rec.SetMaxAlternatives(0)
 
    ssl_kwargs = {}
    if args.cert and args.key:
        ssl_kwargs = {"ssl_certfile": args.cert, "ssl_keyfile": args.key}
 
    uvicorn.run(app, host=args.host, port=args.port, **ssl_kwargs)
 
 
if __name__ == "__main__":
    main()
