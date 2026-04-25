import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Nav from './components/Nav';
import Home from './pages/Home';
import Horario from './pages/Horario';
import Herramientas from './pages/Herramientas';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <BrowserRouter>
      <div className="app-container">
        <Nav isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/horario" element={<Horario />} />
          <Route path="/herramientas" element={<Herramientas />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
