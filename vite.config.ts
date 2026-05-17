import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRÍTICO: Evita que Vite corrompa los binarios de MediaPipe y TensorFlow
  assetsInclude: ['**/*.task', '**/*.tflite', '**/*.json'],
});