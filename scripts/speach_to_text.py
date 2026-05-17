import sys, json, queue, argparse, threading
 
try:
    import sounddevice as sd
    from vosk import Model, KaldiRecognizer
except ImportError:
    print("pip install vosk sounddevice")
    sys.exit(1)
 
SAMPLE_RATE = 16000
BLOCK_SIZE  = 2000
 
audio_queue = queue.Queue()
stop_event  = threading.Event()
 
 
def callback_audio(indata, frames, time_info, status):
    audio_queue.put(bytes(indata))
 
 
def hilo_reconocimiento(rec):
    active_copilot=False
    mandar_mensaje=False

    commands=[]

    while not stop_event.is_set():
        try:
            datos = audio_queue.get(timeout=0.5)
        except queue.Empty:
            continue
 
        if rec.AcceptWaveform(datos):
            texto = json.loads(rec.Result()).get("text", "").strip()
            if "copiloto" in texto.lower():
                active_copilot=True
                commands.append("copiloto")
                print(texto)

            if mandar_mensaje:
                mandar_mensaje=False
                commands.append(texto)
                print(texto) 

            if "mandar mensaje a" in texto.lower() and active_copilot:
                active_copilot=False
                mandar_mensaje=True
                commands.append("mandar mensaje a")
                print(texto)      

    print(commands)     
 
    texto_f = json.loads(rec.FinalResult()).get("text", "").strip()
    if texto_f:
        print(texto_f)
 
 
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--modelo", "-m", default="modelo")
    parser.add_argument("--dispositivo", "-d", type=int, default=None)
    args = parser.parse_args()
 
    try:
        modelo = Model(args.modelo)
    except Exception as e:
        print(f"Error cargando modelo: {e}")
        sys.exit(1)
 
    rec = KaldiRecognizer(modelo, SAMPLE_RATE)
    rec.SetWords(False)
    rec.SetMaxAlternatives(0)
 
    hilo = threading.Thread(
        target=hilo_reconocimiento,
        args=(rec,),
        daemon=True
    )
    hilo.start()
 
    try:
        with sd.RawInputStream(
            samplerate=SAMPLE_RATE,
            blocksize=BLOCK_SIZE,
            device=args.dispositivo,
            dtype="int16",
            channels=1,
            callback=callback_audio,
        ):
            hilo.join()
    except KeyboardInterrupt:
        stop_event.set()
        hilo.join()
    except Exception as e:
        print(f"Error de audio: {e}")
        stop_event.set()
        sys.exit(1)
 
 
if __name__ == "__main__":
    main()
