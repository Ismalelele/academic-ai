import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const TaskContext = createContext();

export const useTasks = () => useContext(TaskContext);

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Cargar tareas al montar el componente o cambiar el usuario
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    const fetchTasks = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('tareas')
        .select('*')
        .eq('user_id', user.id)
        .order('fecha_creacion', { ascending: true });

      if (error) {
        console.error("Error al cargar tareas:", error);
      } else if (data) {
        // Mapear la data de BD al formato de la UI
        const formattedTasks = data.map(t => ({
          id: t.id_tarea,
          title: t.titulo,
          status: t.estado,
          tag: t.etiqueta,
          priority: t.prioridad
        }));
        setTasks(formattedTasks);
      }
      setIsLoading(false);
    };

    fetchTasks();
  }, [user]);

  // Añadir una nueva tarea
  const addTask = async (title, status, tag, priority = 'low') => {
    if (!user) return null;

    // Insertar en Supabase (generará un UUID por defecto)
    const { data, error } = await supabase
      .from('tareas')
      .insert([{
        user_id: user.id,
        titulo: title,
        estado: status,
        etiqueta: tag,
        prioridad: priority
      }])
      .select()
      .single();

    if (error) {
      console.error("Error al crear tarea:", error);
      return null;
    }

    // Actualizar estado local
    const newTask = {
      id: data.id_tarea,
      title: data.titulo,
      status: data.estado,
      tag: data.etiqueta,
      priority: data.prioridad
    };
    
    setTasks(prev => [...prev, newTask]);
    return newTask;
  };

  // Actualizar el estado (status) u otras propiedades de una tarea
  const updateTaskStatus = async (taskId, newStatus) => {
    if (!user) return false;

    // Actualizar localmente rápido (Optimistic UI)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    // Guardar en Supabase
    const { error } = await supabase
      .from('tareas')
      .update({ estado: newStatus })
      .eq('id_tarea', taskId)
      .eq('user_id', user.id);

    if (error) {
      console.error("Error al actualizar tarea:", error);
      // Podríamos revertir el cambio local si falla
      return false;
    }
    return true;
  };

  // Eliminar una tarea individual
  const deleteTask = async (taskId) => {
    if (!user) return false;

    // Eliminar localmente
    setTasks(prev => prev.filter(t => t.id !== taskId));

    // Eliminar en Supabase
    const { error } = await supabase
      .from('tareas')
      .delete()
      .eq('id_tarea', taskId)
      .eq('user_id', user.id);

    if (error) {
      console.error("Error al eliminar tarea:", error);
      return false;
    }
    return true;
  };

  // Eliminar múltiples tareas
  const deleteMultipleTasks = async (taskIds) => {
    if (!user || taskIds.length === 0) return false;

    // Eliminar localmente
    setTasks(prev => prev.filter(t => !taskIds.includes(t.id)));

    // Eliminar en Supabase
    const { error } = await supabase
      .from('tareas')
      .delete()
      .in('id_tarea', taskIds)
      .eq('user_id', user.id);

    if (error) {
      console.error("Error al eliminar múltiples tareas:", error);
      return false;
    }
    return true;
  };

  return (
    <TaskContext.Provider value={{
      tasks,
      isLoading,
      addTask,
      updateTaskStatus,
      deleteTask,
      deleteMultipleTasks
    }}>
      {children}
    </TaskContext.Provider>
  );
};
