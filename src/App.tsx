import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { RecepcionApp } from './pages/recepcion/RecepcionApp';
import { PreTransfusionalApp } from './pages/pre-transfusional/PreTransfusionalApp';
import { UsoApp } from './pages/uso/UsoApp';
import { DisposicionApp } from './pages/disposicion/DisposicionApp';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recepcion" element={<RecepcionApp />} />
        <Route path="/pre-transfusional" element={<PreTransfusionalApp />} />
        <Route path="/uso" element={<UsoApp />} />
        <Route path="/disposicion" element={<DisposicionApp />} />
      </Routes>
    </Router>
  );
}
