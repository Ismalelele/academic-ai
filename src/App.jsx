import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Nav from './components/Nav';
import Home from './pages/Home';
import Horario from './pages/Horario';
import Herramientas from './pages/Herramientas';
import Asistente from './pages/Asistente';
import Tareas from './pages/Tareas';
import { ScheduleProvider } from './context/ScheduleContext';
import { ChatProvider } from './context/ChatContext';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <ScheduleProvider>
      <ChatProvider>
        <BrowserRouter>
          <div className="app-container">
            <Nav isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/horario" element={<Horario />} />
              <Route path="/herramientas" element={<Herramientas />} />
              <Route path="/asistente" element={<Asistente />} />
              <Route path="/tareas" element={<Tareas />} />
            </Routes>
          </div>
        </BrowserRouter>
      </ChatProvider>
    </ScheduleProvider>
  );
}

export default App;
