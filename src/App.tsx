import { useState } from 'react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { CameraFeed } from './components/Camera/CameraFeed';

function App() {
  const [porcentajeFatiga, setPorcentajeFatiga] = useState<number>(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      {/* Capturamos los cambios numéricos aquí */}
      <CameraFeed onFatigaChange={setPorcentajeFatiga} />
      
      {/* Pasamos el estado numérico directo a tu panel */}
      <Dashboard fatiga={porcentajeFatiga} />
    </div>
  );
}

export default App;