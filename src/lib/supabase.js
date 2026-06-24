import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-project.supabase.co"
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("Faltan las credenciales de Supabase en el archivo .env. Entrando en modo local/sin conexión.");
}

const isStandalone = typeof window !== 'undefined' && (
  window.matchMedia('(display-mode: standalone)').matches || 
  window.navigator.standalone
);

const customStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    
    if (isStandalone) {
      return localStorage.getItem(key);
    } else {
      // En navegador normal: verificar inactividad de 30 minutos al restaurar sesión
      const lastActive = localStorage.getItem('academic_session_last_active');
      if (lastActive) {
        const diffMs = Date.now() - parseInt(lastActive, 10);
        const diffMins = diffMs / 1000 / 60;
        if (diffMins > 30) {
          // Sesión expirada por inactividad
          localStorage.removeItem(key);
          localStorage.removeItem('academic_session_last_active');
          return null;
        }
      }
      return localStorage.getItem(key);
    }
  },
  setItem: (key, value) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
    if (!isStandalone) {
      localStorage.setItem('academic_session_last_active', Date.now().toString());
    }
  },
  removeItem: (key) => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
    localStorage.removeItem('academic_session_last_active');
  }
};

// Registrar eventos de actividad para mantener la sesión viva en navegador normal
if (typeof window !== 'undefined' && !isStandalone) {
  const updateActivity = () => {
    localStorage.setItem('academic_session_last_active', Date.now().toString());
  };
  
  let throttleTimer = null;
  const throttledUpdate = () => {
    if (throttleTimer) return;
    throttleTimer = setTimeout(() => {
      updateActivity();
      throttleTimer = null;
    }, 5000); // Actualizar máximo una vez cada 5 segundos
  };

  window.addEventListener('mousemove', throttledUpdate);
  window.addEventListener('keydown', throttledUpdate);
  window.addEventListener('click', throttledUpdate);
  window.addEventListener('touchstart', throttledUpdate);
  
  updateActivity();
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true
  }
})
