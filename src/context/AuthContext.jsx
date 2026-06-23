import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncGradesFromSupabase = async (userId) => {
    if (!userId || userId.startsWith('user-local-')) return;
    try {
      const { data, error } = await supabase
        .from('calificaciones')
        .select('*')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        data.forEach(item => {
          if (item.asignatura && item.notas_json) {
            localStorage.setItem(`academic_${userId}_grades_${item.asignatura}`, JSON.stringify(item.notas_json));
          }
        });
        console.log(`[Auth] Sincronizadas ${data.length} asignaturas de calificaciones desde Supabase.`);
      }
    } catch (err) {
      console.warn("[Auth] No se pudieron sincronizar las calificaciones desde Supabase (puede que la tabla no esté creada aún):", err?.message || err);
    }
  };

  useEffect(() => {
    // Obtener sesión actual real desde Supabase
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (session?.user) {
          setUser(session.user);
          syncGradesFromSupabase(session.user.id);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn("Fallo al conectar con Supabase Auth en getSession:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Escuchar cambios de estado de autenticación
    let subscriptionObj = null;
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (session?.user) {
            setUser(session.user);
            syncGradesFromSupabase(session.user.id);
          } else {
            setUser(null);
            clearAllUserData();
          }
        }
      );
      subscriptionObj = subscription;
    } catch (err) {
      console.warn("Fallo al registrar oyente de estado de autenticación:", err);
    }

    return () => {
      if (subscriptionObj) subscriptionObj.unsubscribe();
    };
  }, []);

  const clearAllUserData = async () => {
    console.log("[Auth] Iniciando limpieza total reactiva de almacenamiento y cachés...");

    // 1. Limpiar localStorage
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("Error al limpiar localStorage:", e);
    }

    // 2. Limpiar sessionStorage
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn("Error al limpiar sessionStorage:", e);
    }

    // 3. Eliminar base de datos IndexedDB 'AcademicAudioDB'
    try {
      if (window.indexedDB) {
        window.indexedDB.deleteDatabase('AcademicAudioDB');
      }
    } catch (e) {
      console.warn("Error al borrar IndexedDB:", e);
    }

    // 4. Limpiar Cache Storage
    try {
      if (window.caches) {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map(name => window.caches.delete(name)));
      }
    } catch (e) {
      console.warn("Error al borrar Cache Storage:", e);
    }

    // 5. Desregistrar Service Workers
    try {
      if (navigator.serviceWorker) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        registrations.forEach(registration => registration.unregister());
      }
    } catch (e) {
      console.warn("Error al desregistrar Service Workers:", e);
    }
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard',
        queryParams: {
          prompt: 'select_account'
        }
      }
    });
    if (error) throw error;
    return data;
  };

  const signUpWithEmail = async (email, password, metadata) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    if (error) {
      if (error.message === 'User already registered') {
        throw new Error('Este correo electrónico ya está registrado. Intenta iniciar sesión.');
      }
      throw error;
    }
    return data;
  };

  const signInWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      if (error.message === 'Invalid login credentials') {
        throw new Error('El correo o la contraseña son incorrectos, o la cuenta no existe. Por favor, regístrate.');
      }
      if (error.message === 'Email not confirmed') {
        throw new Error('Debes confirmar tu correo electrónico antes de iniciar sesión.');
      }
      throw error;
    }
    return data;
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Error al intentar cerrar sesión en Supabase:", error);
    } finally {
      setUser(null);
      await clearAllUserData();
    }
  };

  const updateProfile = async (newMetadata) => {
    try {
      if (!user) return { error: new Error("No hay usuario autenticado") };

      const { data, error } = await supabase.auth.updateUser({
        data: newMetadata
      });

      if (error) throw error;

      if (data?.user) {
        setUser(data.user);

        // Sincronizar en chat_miembros en Supabase
        try {
          await supabase
            .from('chat_miembros')
            .update({
              user_name: newMetadata.full_name,
              user_avatar: newMetadata.avatar_url,
              user_carrera: newMetadata.carrera,
              user_universidad: newMetadata.universidad,
              user_anio: newMetadata.anio_ingreso,
              user_bio: newMetadata.bio
            })
            .eq('user_id', data.user.id);
        } catch (cascadeErr) {
          console.warn("Fallo al actualizar chat_miembros en cascada:", cascadeErr);
        }
      }
      return { data: data?.user || null, error: null };
    } catch (error) {
      console.warn("Fallo al actualizar el perfil en Supabase:", error);
      return { data: null, error };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      signOut,
      updateProfile
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
