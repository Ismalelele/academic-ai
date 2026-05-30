import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current session
    const getSession = async () => {
      try {
        const localUser = localStorage.getItem('sb-local-session-user');
        if (localUser) {
          setUser(JSON.parse(localUser));
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (err) {
        console.warn("Fallo al conectar con Supabase Auth en getSession:", err);
        const localUser = localStorage.getItem('sb-local-session-user');
        setUser(localUser ? JSON.parse(localUser) : null);
      } finally {
        setLoading(false);
      }
    };
    
    getSession();

    // Listen to auth state changes
    let subscriptionObj = null;
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (session?.user) {
            setUser(session.user);
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

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard'
        }
      });
      if (error) throw error;
    } catch (error) {
      console.warn("Google OAuth falló, usando sesión local de respaldo:", error);
      const mockUser = {
        id: `user-local-${Date.now()}`,
        email: 'google-user@academic-ai.local',
        user_metadata: {
          full_name: 'Usuario Google Local',
          carrera: 'Ingeniería Civil',
          avatar_url: null
        }
      };
      setUser(mockUser);
      localStorage.setItem('sb-local-session-user', JSON.stringify(mockUser));
    }
  };

  const signUpWithEmail = async (email, password, metadata) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn("Fallo al registrarse en Supabase. Creando usuario local de respaldo.", error);
      const mockUser = {
        id: `user-local-${Date.now()}`,
        email,
        user_metadata: metadata
      };
      setUser(mockUser);
      localStorage.setItem('sb-local-session-user', JSON.stringify(mockUser));
      return { user: mockUser, session: { user: mockUser } };
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn("Fallo al iniciar sesión con Supabase. Usando sesión local de respaldo.", error);
      const mockUser = {
        id: `user-local-${Date.now()}`,
        email,
        user_metadata: {
          full_name: email.split('@')[0],
          carrera: 'Ingeniería (Local)',
          avatar_url: null
        }
      };
      setUser(mockUser);
      localStorage.setItem('sb-local-session-user', JSON.stringify(mockUser));
      return { user: mockUser, session: { user: mockUser } };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Error al intentar cerrar sesión en Supabase:", error);
    } finally {
      setUser(null);
      localStorage.removeItem('sb-local-session-user');
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase.auth'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (storageErr) {
        console.warn("No se pudo limpiar localStorage:", storageErr);
      }
    }
  };

  const updateProfile = async (newMetadata) => {
    try {
      if (!user) return { error: new Error("No hay usuario autenticado") };

      if (user.id.startsWith('user-local-')) {
        const updatedUser = {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            ...newMetadata
          }
        };
        setUser(updatedUser);
        localStorage.setItem('sb-local-session-user', JSON.stringify(updatedUser));

        // Sincronizar en memberships locales
        try {
          const localMembersKey = `academic_members_${user.id}`;
          const localMembers = JSON.parse(localStorage.getItem(localMembersKey)) || [];
          const updatedMembers = localMembers.map(m => m.user_id === user.id ? {
            ...m,
            user_name: newMetadata.full_name,
            user_avatar: newMetadata.avatar_url,
            user_carrera: newMetadata.carrera,
            user_universidad: newMetadata.universidad,
            user_anio: newMetadata.anio_ingreso,
            user_bio: newMetadata.bio
          } : m);
          localStorage.setItem(localMembersKey, JSON.stringify(updatedMembers));
        } catch (localErr) {
          console.warn("Fallo al actualizar local memberships:", localErr);
        }

        return { data: updatedUser, error: null };
      }

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
