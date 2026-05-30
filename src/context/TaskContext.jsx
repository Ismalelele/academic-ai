import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export const calculatePriorityScore = (task) => {
  let score = 0;
  
  // 1. Urgency based on deadline
  if (task.deadline) {
    const today = new Date();
    const deadlineDate = new Date(task.deadline);
    const timeDiff = deadlineDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) score += 100; // Overdue
    else if (daysDiff <= 1) score += 60; // Due today or tomorrow
    else if (daysDiff <= 3) score += 40;
    else if (daysDiff <= 7) score += 20;
    else score += 5;
  }
  
  // 2. Estimated time
  if (task.estimatedTime) {
    score += task.estimatedTime * 2; // e.g., 5 hours = +10 score
  }
  
  // 3. Manual priority (1 to 5)
  if (task.manualPriority) {
    score += task.manualPriority * 5; 
  }
  
  // 4. Weight by type
  const typeBonus = {
    'Prueba': 50,
    'Examen': 50,
    'Proyecto': 40,
    'Exposición': 30,
    'Tarea': 15,
    'Lectura': 5
  };
  score += typeBonus[task.type] || 10;
  
  return score;
};

const TaskContext = createContext();

export const useTasks = () => useContext(TaskContext);

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activityLog, setActivityLog] = useState([]);
  const { user } = useAuth();

  const addActivity = (action, taskTitle) => {
    if (!user) return;
    setActivityLog(prev => {
      if (prev.length > 0) {
        const last = prev[0];
        if (last.taskTitle === taskTitle) {
          const updatedLast = { 
            ...last, 
            action, // update to the latest action
            timestamp: new Date().toISOString(),
            updated: true
          };
          const newPrev = [updatedLast, ...prev.slice(1)];
          localStorage.setItem(`activity_log_${user.id}`, JSON.stringify(newPrev));
          return newPrev;
        }
      }

      const newLog = { id: Date.now(), action, taskTitle, timestamp: new Date().toISOString() };
      const updated = [newLog, ...prev].slice(0, 50);
      localStorage.setItem(`activity_log_${user.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  // Cargar tareas al montar el componente o cambiar el usuario
  useEffect(() => {
    if (!user) {
      setTasks([]);
      setActivityLog([]);
      setIsLoading(false);
      return;
    }
    
    const savedLog = localStorage.getItem(`activity_log_${user.id}`);
    if (savedLog) {
      setActivityLog(JSON.parse(savedLog));
    } else {
      setActivityLog([]);
    }

    const fetchTasks = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('tareas')
          .select('*')
          .eq('user_id', user.id)
          .order('fecha_creacion', { ascending: true });

        if (error) throw error;

        if (data) {
          // Mapear la data de BD al formato de la UI
          const formattedTasks = data.map(t => {
            const taskObj = {
              id: t.id_tarea,
              title: t.titulo,
              status: t.estado,
              tag: t.etiqueta,
              priority: t.prioridad, // keep legacy priority just in case
              deadline: t.fecha_entrega,
              estimatedTime: t.tiempo_estimado,
              type: t.tipo,
              manualPriority: t.prioridad_manual
            };
            taskObj.priorityScore = calculatePriorityScore(taskObj);
            return taskObj;
          });
          setTasks(formattedTasks);
          localStorage.setItem(`academic_tasks_${user.id}`, JSON.stringify(formattedTasks));
        }
      } catch (error) {
        console.warn("Fallo al conectar con Supabase para tareas. Usando respaldo local. Error:", error?.message || error, "Código:", error?.code || 'N/A');
        const savedTasks = localStorage.getItem(`academic_tasks_${user.id}`);
        if (savedTasks) {
          setTasks(JSON.parse(savedTasks));
        } else {
          setTasks([]);
        }
      }
      setIsLoading(false);
    };

    fetchTasks();
  }, [user]);

  // Añadir una nueva tarea/evaluación inteligente
  const addTask = async (title, status, tag, deadline, estimatedTime, type, manualPriority = 1) => {
    if (!user) return null;

    const localNewTask = {
      id: `task-local-${Date.now()}`,
      title,
      status,
      tag,
      priority: 'medium',
      deadline: deadline || null,
      estimatedTime: estimatedTime || 2,
      type: type || 'Tarea',
      manualPriority
    };
    localNewTask.priorityScore = calculatePriorityScore(localNewTask);

    // Actualizar estado local e historial inmediatamente
    setTasks(prev => {
      const updated = [...prev, localNewTask];
      localStorage.setItem(`academic_tasks_${user.id}`, JSON.stringify(updated));
      return updated;
    });
    addActivity("Creó la tarea", localNewTask.title);

    try {
      // Insertar en Supabase
      const { data, error } = await supabase
        .from('tareas')
        .insert([{
          user_id: user.id,
          titulo: title,
          estado: status,
          etiqueta: tag,
          fecha_entrega: deadline || null,
          tiempo_estimado: estimatedTime || 2,
          tipo: type || 'Tarea',
          prioridad_manual: manualPriority
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const dbTask = {
          id: data.id_tarea,
          title: data.titulo,
          status: data.estado,
          tag: data.etiqueta,
          priority: data.prioridad,
          deadline: data.fecha_entrega,
          estimatedTime: data.tiempo_estimado,
          type: data.tipo,
          manualPriority: data.prioridad_manual
        };
        dbTask.priorityScore = calculatePriorityScore(dbTask);

        // Reemplazar la tarea temporal local con los datos de Supabase (especialmente el id_tarea)
        setTasks(prev => {
          const replaced = prev.map(t => t.id === localNewTask.id ? dbTask : t);
          localStorage.setItem(`academic_tasks_${user.id}`, JSON.stringify(replaced));
          return replaced;
        });
        return dbTask;
      }
    } catch (error) {
      console.warn("Fallo al crear tarea en Supabase. Guardada localmente de respaldo.", error);
    }

    return localNewTask;
  };

  // Actualizar el estado (status) u otras propiedades de una tarea
  const updateTaskStatus = async (taskId, newStatus) => {
    if (!user) return false;

    // Actualizar localmente rápido (Optimistic UI)
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      localStorage.setItem(`academic_tasks_${user.id}`, JSON.stringify(updated));
      return updated;
    });

    const taskTitle = tasks.find(t => t.id === taskId)?.title || 'Desconocida';
    const statusText = newStatus === 'done' ? 'Completó' : (newStatus === 'in-progress' ? 'Empezó' : 'Marcó por hacer');
    addActivity(`${statusText} la tarea`, taskTitle);

    // Guardar en Supabase
    try {
      if (typeof taskId === 'string' && taskId.startsWith('task-local-')) {
        // La tarea fue creada sin conexión, no se actualiza en DB remota todavía
        return true;
      }

      const { error } = await supabase
        .from('tareas')
        .update({ estado: newStatus })
        .eq('id_tarea', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.warn("Fallo al actualizar tarea en Supabase. Se guardó localmente de respaldo.", error);
    }
    
    return true;
  };

  // Eliminar una tarea individual
  const deleteTask = async (taskId) => {
    if (!user) return false;

    // Eliminar localmente
    const taskTitle = tasks.find(t => t.id === taskId)?.title || 'Desconocida';
    addActivity("Eliminó la tarea", taskTitle);
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== taskId);
      localStorage.setItem(`academic_tasks_${user.id}`, JSON.stringify(updated));
      return updated;
    });

    // Eliminar en Supabase
    try {
      if (typeof taskId === 'string' && taskId.startsWith('task-local-')) {
        return true;
      }

      const { error } = await supabase
        .from('tareas')
        .delete()
        .eq('id_tarea', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.warn("Fallo al eliminar tarea en Supabase. Se eliminó localmente de respaldo.", error);
    }
    return true;
  };

  // Eliminar múltiples tareas
  const deleteMultipleTasks = async (taskIds) => {
    if (!user || taskIds.length === 0) return false;

    // Eliminar localmente
    addActivity("Eliminó", `${taskIds.length} tareas`);
    setTasks(prev => {
      const updated = prev.filter(t => !taskIds.includes(t.id));
      localStorage.setItem(`academic_tasks_${user.id}`, JSON.stringify(updated));
      return updated;
    });

    // Eliminar en Supabase
    try {
      const dbIds = taskIds.filter(id => !(typeof id === 'string' && id.startsWith('task-local-')));
      if (dbIds.length === 0) return true;

      const { error } = await supabase
        .from('tareas')
        .delete()
        .in('id_tarea', dbIds)
        .eq('user_id', user.id);

      if (error) throw error;
    } catch (error) {
      console.warn("Fallo al eliminar múltiples tareas en Supabase. Se eliminó localmente de respaldo.", error);
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
      deleteMultipleTasks,
      activityLog
    }}>
      {children}
    </TaskContext.Provider>
  );
};
