#!/usr/bin/env python3
"""
Transcripción de voz en tiempo real (offline) usando Vosk.

Requisitos:
    pip install vosk sounddevice

Modelo español (recomendado):
    Descarga desde https://alphacephei.com/vosk/models
    Sugerido: vosk-model-es-0.42 (~1.4 GB, alta precisión)
    Ligero:   vosk-model-small-es-0.42 (~39 MB)

    Extrae el modelo y pasa la ruta con --modelo, o colócalo
    en la misma carpeta como 'modelo/'.
"""

import sys
import json
import queue
import argparse
import threading

try:
    import sounddevice as sd
    from vosk import Model, KaldiRecognizer
except ImportError:
    print("Faltan dependencias. Instálalas con:")
    print("  pip install vosk sounddevice")
    sys.exit(1)


# ── Configuración ────────────────────────────────────────────────────────────

SAMPLE_RATE   = 16000   # Hz requerido por Vosk
BLOCK_SIZE    = 2000    # muestras por bloque (~0.125 s) — más pequeño = más en vivo
CHANNELS      = 1       # mono

# ── Cola compartida entre callback y hilo de reconocimiento ─────────────────

audio_queue: queue.Queue = queue.Queue()
stop_event   = threading.Event()


def callback_audio(indata, frames, time_info, status):
    """Llamado por sounddevice en cada bloque capturado."""
    if status:
        print(f"[aviso sounddevice] {status}", file=sys.stderr)
    audio_queue.put(bytes(indata))


def hilo_reconocimiento(rec: KaldiRecognizer, mostrar_parcial: bool) -> None:
    """Lee bloques de la cola y los pasa al reconocedor Vosk."""
    print("\n🎙  Escuchando... (Ctrl+C para detener)\n")
    print("─" * 60)

    ultimo_parcial = ""

    while not stop_event.is_set():
        try:
            datos = audio_queue.get(timeout=0.5)
        except queue.Empty:
            continue

        if rec.AcceptWaveform(datos):
            # Limpiar línea parcial antes de imprimir resultado final
            if mostrar_parcial and ultimo_parcial:
                print(" " * (len(ultimo_parcial) + 5), end="\r")
            resultado = json.loads(rec.Result())
            texto = resultado.get("text", "").strip()
            if texto:
                print(f"✅ {texto}")
            ultimo_parcial = ""
        elif mostrar_parcial:
            parcial = json.loads(rec.PartialResult())
            texto_p = parcial.get("partial", "").strip()
            if texto_p and texto_p != ultimo_parcial:
                ultimo_parcial = texto_p
                # Limpiar línea y reescribir
                print(f"   \033[90m{texto_p}\033[0m" + " " * 10, end="\r", flush=True)

    # Vaciar lo que quede en el buffer
    resultado_final = json.loads(rec.FinalResult())
    texto_f = resultado_final.get("text", "").strip()
    if texto_f:
        print(f"\n✅ {texto_f}")


# ── Punto de entrada ─────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transcripción de voz offline con Vosk"
    )
    parser.add_argument(
        "--modelo", "-m",
        default="modelo",
        help="Ruta al directorio del modelo Vosk (default: ./modelo)"
    )
    parser.add_argument(
        "--dispositivo", "-d",
        type=int,
        default=None,
        help="Índice del dispositivo de entrada (default: micrófono por defecto)"
    )
    parser.add_argument(
        "--listar",
        action="store_true",
        help="Listar dispositivos de audio disponibles y salir"
    )
    parser.add_argument(
        "--sin-parcial",
        action="store_true",
        help="No mostrar resultados parciales (solo enunciados completos)"
    )
    args = parser.parse_args()

    # Listar dispositivos
    if args.listar:
        print(sd.query_devices())
        return

    # Cargar modelo
    print(f"⏳ Cargando modelo desde '{args.modelo}'...")
    try:
        modelo = Model(args.modelo)
    except Exception as e:
        print(f"\n❌ No se pudo cargar el modelo: {e}")
        print("\nDescarga un modelo español desde:")
        print("  https://alphacephei.com/vosk/models")
        print("y extráelo en la carpeta 'modelo/' (o indica la ruta con --modelo).")
        sys.exit(1)

    rec = KaldiRecognizer(modelo, SAMPLE_RATE)
    rec.SetWords(False)         # desactivar timestamps mejora velocidad
    rec.SetMaxAlternatives(0)   # sin alternativas = más rápido

    mostrar_parcial = not args.sin_parcial

    # Lanzar hilo de reconocimiento
    hilo = threading.Thread(
        target=hilo_reconocimiento,
        args=(rec, mostrar_parcial),
        daemon=True
    )
    hilo.start()

    # Abrir stream de audio
    try:
        with sd.RawInputStream(
            samplerate=SAMPLE_RATE,
            blocksize=BLOCK_SIZE,
            device=args.dispositivo,
            dtype="int16",
            channels=CHANNELS,
            callback=callback_audio,
        ):
            hilo.join()   # espera hasta KeyboardInterrupt
    except KeyboardInterrupt:
        print("\n\n⏹  Deteniendo...", flush=True)
        stop_event.set()
        hilo.join()
        print("Sesión terminada.")
    except Exception as e:
        print(f"\n❌ Error de audio: {e}")
        stop_event.set()
        sys.exit(1)


if __name__ == "__main__":
    main()