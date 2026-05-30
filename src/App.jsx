import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Nav from './components/Nav';
import Home from './pages/Home';
import Horario from './pages/Horario';
import Apuntes from './pages/Apuntes';
import Asistente from './pages/Asistente';
import Tareas from './pages/Tareas';
import Calificaciones from './pages/Calificaciones';
import ChatsGrupos from './pages/ChatsGrupos';
import Analisis from './pages/Analisis';
import { ScheduleProvider } from './context/ScheduleContext';
import { ChatProvider } from './context/ChatContext';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { NotificationProvider } from './context/NotificationContext';
import { GroupChatProvider } from './context/GroupChatContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

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
    <AuthProvider>
      <ScheduleProvider>
        <TaskProvider>
          <NotificationProvider>
            <ChatProvider>
              <GroupChatProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/*" element={
                      <ProtectedRoute>
                        <div className="app-container">
                          <Nav isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
                          <Routes>
                            <Route path="/dashboard" element={<Home />} />
                            <Route path="/horario" element={<Horario />} />
                            <Route path="/apuntes" element={<Apuntes />} />
                            <Route path="/asistente" element={<Asistente />} />
                            <Route path="/tareas" element={<Tareas />} />
                            <Route path="/calificaciones" element={<Calificaciones />} />
                            <Route path="/chats" element={<ChatsGrupos />} />
                            <Route path="/analisis" element={<Analisis />} />
                          </Routes>
                        </div>
                      </ProtectedRoute>
                    } />
                  </Routes>
                </BrowserRouter>
              </GroupChatProvider>
            </ChatProvider>
          </NotificationProvider>
        </TaskProvider>
      </ScheduleProvider>
    </AuthProvider>
  );
}

export default App;
