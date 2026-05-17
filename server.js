// server.js — Mini servidor Express para alertas WhatsApp via Twilio
// Colócalo en la raíz del proyecto: Guadalahacks2026/server.js
//
// Instalación (una sola vez):
//   npm install express twilio cors dotenv
//
// Crea un archivo .env en la raíz con:
//   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   ← número del Sandbox de Twilio
//
// Ejecución:
//   node server.js

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import twilio from 'twilio';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' })); // Puerto de Vite
app.use(express.json());

// ─── CONTACTOS ───────────────────────────────────────────────────────────────
// Agrega aquí los números en formato internacional con prefijo whatsapp:
// IMPORTANTE: Cada número debe haber aceptado el Sandbox de Twilio enviando
//             "join <palabra>" al número del Sandbox (ver consola de Twilio).
const CONTACTOS = [
  'whatsapp:+5213321133186', // Contacto 1  ← reemplaza con número real
  'whatsapp:+5213211039639',
];

// ─── CLIENTE TWILIO ──────────────────────────────────────────────────────────
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_FROM; // whatsapp:+14155238886

// ─── ENDPOINT ────────────────────────────────────────────────────────────────
app.post('/send-alert', async (req, res) => {
  const { nivelFatiga } = req.body;

  if (typeof nivelFatiga !== 'number') {
    return res.status(400).json({ error: 'nivelFatiga debe ser un número' });
  }

  const mensaje = `🚨 ALERTA Drive Copilot 🚨\n\nEl conductor presenta un nivel de fatiga del ${nivelFatiga}%.\nPor favor comuníquese con él o ella de inmediato.\n\n⏰ ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`;

  try {
    const resultados = await Promise.allSettled(
      CONTACTOS.map((to) =>
        client.messages.create({ from: FROM, to, body: mensaje })
      )
    );

    const enviados = resultados.filter((r) => r.status === 'fulfilled').length;
    const fallidos = resultados.filter((r) => r.status === 'rejected').length;

    console.log(`[Alert] Fatiga: ${nivelFatiga}% | Enviados: ${enviados} | Fallidos: ${fallidos}`);



    resultados.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[Error contacto ${i}]:`, r.reason?.message || r.reason);
      }
    });


    res.json({ ok: true, enviados, fallidos });
  } catch (err) {
    console.error('[Alert] Error inesperado:', err);
    res.status(500).json({ error: 'Error enviando mensajes' });
  }
});

// ─── INICIO ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor de alertas corriendo en http://localhost:${PORT}`);
});
