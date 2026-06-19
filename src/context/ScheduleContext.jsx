import { createContext, useContext, useState, useEffect } from 'react';
import { processScheduleImage } from '../utils/aiVisionProcessor';
import { generateStudyPlan } from '../utils/aiProcessor';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { getSafeLocalStorage } from '../utils/storageSecurity';

export const predefBlocks = [
  { index: 1, start: '08:15', end: '08:55', startH: 8, startM: 15, endH: 8, endM: 55 },
  { index: 2, start: '08:56', end: '09:35', startH: 8, startM: 56, endH: 9, endM: 35 },
  { index: 3, start: '09:45', end: '10:25', startH: 9, startM: 45, endH: 10, endM: 25 },
  { index: 4, start: '10:26', end: '11:05', startH: 10, startM: 26, endH: 11, endM: 5 },
  { index: 5, start: '11:15', end: '11:55', startH: 11, startM: 15, endH: 11, endM: 55 },
  { index: 6, start: '11:56', end: '12:35', startH: 11, startM: 56, endH: 12, endM: 35 },
  { index: 7, start: '12:45', end: '13:25', startH: 12, startM: 45, endH: 13, endM: 25 },
  { index: 8, start: '13:26', end: '14:05', startH: 13, startM: 26, endH: 14, endM: 5 },
  { index: 9, start: '14:15', end: '14:55', startH: 14, startM: 15, endH: 14, endM: 55 },
  { index: 10, start: '14:56', end: '15:35', startH: 14, startM: 56, endH: 15, endM: 35 },
  { index: 11, start: '15:45', end: '16:25', startH: 15, startM: 45, endH: 16, endM: 25 },
  { index: 12, start: '16:26', end: '17:05', startH: 16, startM: 26, endH: 17, endM: 5 },
  { index: 13, start: '17:15', end: '17:55', startH: 17, startM: 15, endH: 17, endM: 55 },
  { index: 14, start: '17:56', end: '18:35', startH: 17, startM: 56, endH: 18, endM: 35 },
  { index: 15, start: '18:40', end: '19:20', startH: 18, startM: 40, endH: 19, endM: 20 },
  { index: 16, start: '19:21', end: '20:00', startH: 19, startM: 21, endH: 20, endM: 0 },
  { index: 17, start: '20:51', end: '21:30', startH: 20, startM: 51, endH: 21, endM: 30 },
  { index: 18, start: '21:40', end: '22:20', startH: 21, startM: 40, endH: 22, endM: 20 }
];

const ScheduleContext = createContext();

export const useSchedule = () => useContext(ScheduleContext);

export const ScheduleProvider = ({ children }) => {
  const [schedule, setSchedule] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [effectiveSchedule, setEffectiveSchedule] = useState(null);
  const [studyBlocks, setStudyBlocks] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();

  // Cargar el horario del usuario desde Supabase cuando inicia sesión
  useEffect(() => {
    if (!user) {
      setSchedule(null);
      setStudyBlocks([]);
      return;
    }
    
    const savedBlocks = getSafeLocalStorage(`academic_${user.id}_study_blocks`, user.id, null);
    if (savedBlocks) {
      setStudyBlocks(savedBlocks);
    } else {
      setStudyBlocks([]);
    }

    const fetchSchedule = async () => {
      if (user.id.startsWith('user-local-')) {
        const localSchedule = getSafeLocalStorage(`academic_${user.id}_schedule`, user.id, null);
        setSchedule(localSchedule);
        const localExceptions = getSafeLocalStorage(`academic_${user.id}_exceptions`, user.id, null);
        setExceptions(localExceptions ? localExceptions : []);
        return;
      }
      try {
        // Cargar planificación de estudio desde Supabase
        const { data: planData, error: planError } = await supabase
          .from('planificacion_estudio')
          .select('bloques_json')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!planError && planData && planData.bloques_json) {
          setStudyBlocks(planData.bloques_json);
          localStorage.setItem(`academic_${user.id}_study_blocks`, JSON.stringify(planData.bloques_json));
        }

        // Buscar el horario más reciente de este usuario
        const { data: horarioData, error: horarioError } = await supabase
          .from('horarios')
          .select('id_horario')
          .eq('user_id', user.id)
          .order('fecha_subida', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (horarioError && horarioError.code !== 'PGRST116') {
          throw horarioError;
        }

        if (horarioData) {
          // Buscar los bloques (ramos) de este horario
          const { data: bloquesData, error: bloquesError } = await supabase
            .from('bloques_clases')
            .select('*')
            .eq('id_horario', horarioData.id_horario);

          if (bloquesError) throw bloquesError;

          if (bloquesData) {
            const formattedSchedule = bloquesData.map((bloque) => {
              const [startH, startM] = bloque.hora_inicio.split(':').map(Number);
              const [endH, endM] = bloque.hora_fin.split(':').map(Number);
              const { top, height } = calculateVisuals(startH, startM, endH, endM);
              
              return {
                id: bloque.id_bloque,
                title: bloque.asignatura,
                day: bloque.dia_semana,
                startH, startM, endH, endM,
                top, height,
                type: bloque.tipo_color
              };
            });
            setSchedule(formattedSchedule);
            localStorage.setItem(`academic_${user.id}_schedule`, JSON.stringify(formattedSchedule));
          }

          // Cargar excepciones
          const { data: excData, error: excError } = await supabase
            .from('excepciones_horario')
            .select('*')
            .eq('user_id', user.id);
          
          if (excError) throw excError;

          if (excData) {
            setExceptions(excData);
            localStorage.setItem(`academic_${user.id}_exceptions`, JSON.stringify(excData));
          }
        } else {
          setSchedule(null);
          localStorage.removeItem(`academic_${user.id}_schedule`);
        }
      } catch (error) {
        console.warn("Fallo al conectar con Supabase. Usando horario local de respaldo. Error:", error?.message || error, "Código:", error?.code || 'N/A');
        const localSchedule = getSafeLocalStorage(`academic_${user.id}_schedule`, user.id, null);
        if (localSchedule) {
          setSchedule(localSchedule);
        } else {
          setSchedule(null);
        }

        const localExceptions = getSafeLocalStorage(`academic_${user.id}_exceptions`, user.id, null);
        if (localExceptions) {
          setExceptions(localExceptions);
        } else {
          setExceptions([]);
        }
      }
    };

    fetchSchedule();
  }, [user?.id]);

  // Computar effectiveSchedule cada vez que cambie el schedule o las excepciones
  useEffect(() => {
    if (!schedule) {
      setEffectiveSchedule(null);
      return;
    }
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - currentDay);
    
    const computed = schedule.map(cls => {
      const classDate = new Date(monday);
      classDate.setDate(classDate.getDate() + cls.day);
      
      const year = classDate.getFullYear();
      const month = String(classDate.getMonth() + 1).padStart(2, '0');
      const day = String(classDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      const isSuspended = exceptions.some(e => 
        e.id_bloque === cls.id && 
        e.fecha_excepcion === dateString && 
        e.tipo_excepcion === 'suspension'
      );
      
      return { ...cls, isSuspended, dateString };
    });
    
    setEffectiveSchedule(computed);
  }, [schedule, exceptions]);

  // Sync studyBlocks to localStorage and Supabase
  useEffect(() => {
    if (!user) return;

    localStorage.setItem(`academic_${user.id}_study_blocks`, JSON.stringify(studyBlocks));

    if (user.id.startsWith('user-local-')) return;

    const handler = setTimeout(async () => {
      try {
        await supabase
          .from('planificacion_estudio')
          .upsert({
            user_id: user.id,
            bloques_json: studyBlocks,
            updated_at: new Date().toISOString()
          });
      } catch (err) {
        console.warn("Fallo al guardar bloques de estudio en Supabase:", err);
      }
    }, 1200);

    return () => clearTimeout(handler);
  }, [studyBlocks, user?.id]);

  const reportClassSuspension = async (bloqueId, dateString) => {
    if (!user) return false;
    
    const localNewException = {
      id_excepcion: `exc-local-${Date.now()}`,
      user_id: user.id,
      id_bloque: bloqueId,
      fecha_excepcion: dateString,
      tipo_excepcion: 'suspension',
      descripcion: 'Reportado por el usuario'
    };

    setExceptions(prev => {
      const updated = [...prev, localNewException];
      localStorage.setItem(`academic_${user.id}_exceptions`, JSON.stringify(updated));
      return updated;
    });

    try {
      const { data, error } = await supabase
        .from('excepciones_horario')
        .insert([{
          user_id: user.id,
          id_bloque: bloqueId,
          fecha_excepcion: dateString,
          tipo_excepcion: 'suspension',
          descripcion: 'Reportado por el usuario'
        }])
        .select()
        .single();
        
      if (!error && data) {
        setExceptions(prev => {
          const replaced = prev.map(e => e.id_excepcion === localNewException.id_excepcion ? data : e);
          localStorage.setItem(`academic_${user.id}_exceptions`, JSON.stringify(replaced));
          return replaced;
        });
      }
    } catch (e) {
      console.warn("Fallo al conectar con Supabase. Guardado en local.", e);
    }
    return true;
  };

  const removeClassSuspension = async (bloqueId, dateString) => {
    if (!user) return false;
    
    setExceptions(prev => {
      const updated = prev.filter(e => 
        !(e.id_bloque === bloqueId && e.fecha_excepcion === dateString && e.tipo_excepcion === 'suspension')
      );
      localStorage.setItem(`academic_${user.id}_exceptions`, JSON.stringify(updated));
      return updated;
    });

    try {
      await supabase
        .from('excepciones_horario')
        .delete()
        .eq('user_id', user.id)
        .eq('id_bloque', bloqueId)
        .eq('fecha_excepcion', dateString)
        .eq('tipo_excepcion', 'suspension');
    } catch (e) {
      console.warn("Fallo al sincronizar eliminación con Supabase.", e);
    }
    return true;
  };

  const getColorType = (title) => {
    const types = ['cultura', 'tecnologias', 'ciber', 'proy-colab', 'formulacion', 'competencias', 'procesos', 'proy-noche'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return types[Math.abs(hash) % types.length];
  };

  const calculateVisuals = (startH, startM, endH, endM) => {
    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    let startIdx = -1;
    let endIdx = -1;
    let minStartDiff = Infinity;
    let minEndDiff = Infinity;

    for (let i = 0; i < predefBlocks.length; i++) {
      const b = predefBlocks[i];
      const bStart = b.startH * 60 + b.startM;
      const bEnd = b.endH * 60 + b.endM;

      const startDiff = Math.abs(bStart - startTotal);
      if (startDiff < minStartDiff) {
        minStartDiff = startDiff;
        startIdx = i;
      }

      const endDiff = Math.abs(bEnd - endTotal);
      if (endDiff < minEndDiff) {
        minEndDiff = endDiff;
        endIdx = i;
      }
    }

    if (startIdx === -1) startIdx = 0;
    if (endIdx === -1 || endIdx < startIdx) endIdx = startIdx;

    return { 
      top: `calc(${startIdx} * var(--slot-height, 50px))`, 
      height: `calc((${endIdx - startIdx + 1}) * var(--slot-height, 50px) - 4px)` 
    };
  };

  const uploadAndProcessImage = async (file) => {
    if (!user) {
      alert("Debes iniciar sesión para subir un horario.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const extractedData = await processScheduleImage(file);
      
      if (Array.isArray(extractedData) && extractedData.length > 0) {
        const finalSchedule = extractedData.map((cls, idx) => {
          const { top, height } = calculateVisuals(cls.startH, cls.startM, cls.endH, cls.endM);
          return {
            id: cls.id || `local-bloque-${Date.now()}-${idx}`,
            title: cls.title,
            day: cls.day,
            startH: cls.startH,
            startM: cls.startM,
            endH: cls.endH,
            endM: cls.endM,
            top,
            height,
            type: getColorType(cls.title)
          };
        });

        try {
          await supabase.from('horarios').delete().eq('user_id', user.id);

          const { data: newHorario, error: insertHorarioError } = await supabase
            .from('horarios')
            .insert([{ user_id: user.id }])
            .select()
            .single();

          if (insertHorarioError) throw insertHorarioError;

          const bloquesToInsert = finalSchedule.map(cls => ({
            id_horario: newHorario.id_horario,
            dia_semana: cls.day,
            hora_inicio: `${cls.startH.toString().padStart(2, '0')}:${cls.startM.toString().padStart(2, '0')}`,
            hora_fin: `${cls.endH.toString().padStart(2, '0')}:${cls.endM.toString().padStart(2, '0')}`,
            asignatura: cls.title,
            tipo_color: cls.type
          }));

          const { data: insertedBloques, error: insertBloquesError } = await supabase
            .from('bloques_clases')
            .insert(bloquesToInsert)
            .select();

          if (insertBloquesError) throw insertBloquesError;

          const dbSchedule = insertedBloques.map((bloque) => {
            const [startH, startM] = bloque.hora_inicio.split(':').map(Number);
            const [endH, endM] = bloque.hora_fin.split(':').map(Number);
            const { top, height } = calculateVisuals(startH, startM, endH, endM);
            
            return {
              id: bloque.id_bloque,
              title: bloque.asignatura,
              day: bloque.dia_semana,
              startH, startM, endH, endM,
              top, height,
              type: bloque.tipo_color
            };
          });

          setSchedule(dbSchedule);
          localStorage.setItem(`academic_${user.id}_schedule`, JSON.stringify(dbSchedule));
        } catch (dbError) {
          console.warn("Fallo al guardar horario en Supabase, guardando en localStorage local de respaldo:", dbError);
          setSchedule(finalSchedule);
          localStorage.setItem(`academic_${user.id}_schedule`, JSON.stringify(finalSchedule));
        }
      }
    } catch (error) {
      console.error("Error al procesar el horario:", error);
      alert(`Error al analizar el archivo: ${error.message || 'Desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveFullSchedule = async (newSchedule) => {
    if (!user) return false;
    
    // Format visual coordinates for every block in the new schedule
    const formattedSchedule = newSchedule.map(cls => {
      const { top, height } = calculateVisuals(cls.startH, cls.startM, cls.endH, cls.endM);
      return {
        ...cls,
        id: cls.id || 'block-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        top,
        height
      };
    });

    if (user.id.startsWith('user-local-')) {
      setSchedule(formattedSchedule);
      localStorage.setItem(`academic_${user.id}_schedule`, JSON.stringify(formattedSchedule));
      return true;
    }

    try {
      // 1. Delete old schedules in database
      await supabase.from('horarios').delete().eq('user_id', user.id);

      // 2. Create a new schedule entry
      const { data: newHorario, error: insertHorarioError } = await supabase
        .from('horarios')
        .insert([{ user_id: user.id }])
        .select()
        .single();

      if (insertHorarioError) throw insertHorarioError;

      // 3. Insert class blocks
      if (formattedSchedule.length > 0) {
        const bloquesToInsert = formattedSchedule.map(cls => ({
          id_horario: newHorario.id_horario,
          dia_semana: cls.day,
          hora_inicio: `${cls.startH.toString().padStart(2, '0')}:${cls.startM.toString().padStart(2, '0')}`,
          hora_fin: `${cls.endH.toString().padStart(2, '0')}:${cls.endM.toString().padStart(2, '0')}`,
          asignatura: cls.title,
          tipo_color: cls.type || 'linear-gradient(135deg, #8b5cf6, #38bdf8)'
        }));

        const { data: insertedBloques, error: insertBloquesError } = await supabase
          .from('bloques_clases')
          .insert(bloquesToInsert)
          .select();

        if (insertBloquesError) throw insertBloquesError;

        // 4. Update local state using blocks from the DB (so they have real id_bloque)
        const dbSchedule = insertedBloques.map((bloque) => {
          const [startH, startM] = bloque.hora_inicio.split(':').map(Number);
          const [endH, endM] = bloque.hora_fin.split(':').map(Number);
          const { top, height } = calculateVisuals(startH, startM, endH, endM);
          
          return {
            id: bloque.id_bloque,
            title: bloque.asignatura,
            day: bloque.dia_semana,
            startH, startM, endH, endM,
            top, height,
            type: bloque.tipo_color
          };
        });

        setSchedule(dbSchedule);
        localStorage.setItem(`academic_${user.id}_schedule`, JSON.stringify(dbSchedule));
      } else {
        setSchedule([]);
        localStorage.setItem(`academic_${user.id}_schedule`, JSON.stringify([]));
      }
      return true;
    } catch (error) {
      console.warn("Fallo al guardar el horario en Supabase, guardando en local como respaldo:", error);
      setSchedule(formattedSchedule);
      localStorage.setItem(`academic_${user.id}_schedule`, JSON.stringify(formattedSchedule));
      return true;
    }
  };

  const clearSchedule = async () => {
    if (user) {
      localStorage.removeItem(`academic_${user.id}_schedule`);
      localStorage.removeItem(`academic_${user.id}_study_blocks`);
      try {
        await supabase.from('horarios').delete().eq('user_id', user.id);
        if (!user.id.startsWith('user-local-')) {
          await supabase.from('planificacion_estudio').delete().eq('user_id', user.id);
        }
      } catch (e) {
        console.warn("No se pudo sincronizar eliminación de horario con Supabase.", e);
      }
    }
    setSchedule(null);
    setStudyBlocks([]);
  };

  const clearStudyBlocks = async () => {
    setStudyBlocks([]);
    if (user) {
      localStorage.setItem(`academic_${user.id}_study_blocks_cleared`, 'true');
      localStorage.removeItem(`academic_${user.id}_study_blocks`);
      if (!user.id.startsWith('user-local-')) {
        try {
          await supabase.from('planificacion_estudio').delete().eq('user_id', user.id);
        } catch (e) {
          console.warn("No se pudo sincronizar eliminación de bloques de estudio con Supabase.", e);
        }
      }
    }
  };

  const updateStudyBlock = (blockId, newDay, newStartH, newStartM, newEndH, newEndM) => {
    const { top, height } = calculateVisuals(newStartH, newStartM, newEndH, newEndM);
    setStudyBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          day: newDay,
          startH: newStartH,
          startM: newStartM,
          endH: newEndH,
          endM: newEndM,
          top,
          height
        };
      }
      return b;
    }));
  };

  const deleteStudyBlock = (blockId) => {
    setStudyBlocks(prev => prev.filter(b => b.id !== blockId));
  };


  const updateClass = async (classId, newDay, newStartH, newStartM, newEndH, newEndM) => {
    const { top, height } = calculateVisuals(newStartH, newStartM, newEndH, newEndM);
    let updatedSchedule = null;
    
    setSchedule(prev => {
      if (!prev) return prev;
      const next = prev.map(c => {
        if (c.id === classId) {
          return {
            ...c,
            day: newDay,
            startH: newStartH,
            startM: newStartM,
            endH: newEndH,
            endM: newEndM,
            top,
            height
          };
        }
        return c;
      });
      updatedSchedule = next;
      return next;
    });

    if (user && updatedSchedule) {
      localStorage.setItem(`academic_${user.id}_schedule`, JSON.stringify(updatedSchedule));
      
      const isNumericId = typeof classId === 'number' || !isNaN(Number(classId));
      if (isNumericId) {
        try {
          const startTimeStr = `${newStartH.toString().padStart(2, '0')}:${newStartM.toString().padStart(2, '0')}`;
          const endTimeStr = `${newEndH.toString().padStart(2, '0')}:${newEndM.toString().padStart(2, '0')}`;
          await supabase.from('bloques_clases')
            .update({
              dia_semana: newDay,
              hora_inicio: startTimeStr,
              hora_fin: endTimeStr
            })
            .eq('id_bloque', Number(classId));
        } catch (e) {
          console.warn("Could not sync class drag and drop to Supabase:", e);
        }
      }
    }
  };

  const findAvailableBlocks = (currentSchedule) => {
    const availableBlocks = [];
    const validSchedule = (currentSchedule || []).filter(c => !c.isSuspended);

    for (let day = 0; day < 5; day++) {
      for (const b of predefBlocks) {
        const hasClass = validSchedule.some(cls => {
          if (cls.day !== day) return false;
          const clsStart = cls.startH * 60 + cls.startM;
          const clsEnd = cls.endH * 60 + cls.endM;
          const bStart = b.startH * 60 + b.startM;
          const bEnd = b.endH * 60 + b.endM;
          return Math.max(clsStart, bStart) < Math.min(clsEnd, bEnd);
        });

        if (!hasClass) {
          availableBlocks.push({
            day,
            startH: b.startH,
            startM: b.startM,
            endH: b.endH,
            endM: b.endM,
            durationMins: 40
          });
        }
      }
    }
    return availableBlocks;
  };

  const generateStudyRoutine = async (pendingTasks, force = false) => {
    if (user && force) {
      localStorage.removeItem(`academic_${user.id}_study_blocks_cleared`);
    }
    const isCleared = user ? localStorage.getItem(`academic_${user.id}_study_blocks_cleared`) === 'true' : false;
    if (isCleared && !force) {
      return;
    }
    if (!pendingTasks || pendingTasks.length === 0) {
      setStudyBlocks([]);
      if (user) {
        localStorage.removeItem(`academic_${user.id}_study_blocks`);
      }
      return;
    }
    
    setIsProcessing(true);
    try {
      const freeBlocks = findAvailableBlocks(effectiveSchedule);
      let aiBlocks;
      try {
        aiBlocks = await generateStudyPlan(freeBlocks, pendingTasks);
      } catch (aiErr) {
        console.warn("Groq failed, scheduling locally:", aiErr);
        aiBlocks = [];
        let blockIdx = 0;
        const sortedTasks = [...pendingTasks].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
        
        for (const task of sortedTasks) {
          const neededHours = task.estimatedTime || 2;
          const blocksNeeded = Math.ceil((neededHours * 60) / 40);
          
          for (let b = 0; b < blocksNeeded; b++) {
            if (blockIdx >= freeBlocks.length) break;
            const fb = freeBlocks[blockIdx++];
            aiBlocks.push({
              day: fb.day,
              startH: fb.startH,
              startM: fb.startM,
              endH: fb.endH,
              endM: fb.endM,
              taskTitle: task.title,
              priority: task.priorityScore > 80 ? 'high' : 'medium',
              reason: 'Asignado automáticamente en ventana libre.'
            });
          }
        }
      }
      
      if (Array.isArray(aiBlocks)) {
        // --- VALIDACIÓN DE TRASLAPE Y VENTANA LIBRE ---
        // Asegurar que los bloques sugeridos coincidan con un bloque en freeBlocks
        const validatedBlocks = aiBlocks.filter(b => {
          return freeBlocks.some(fb => 
            fb.day === b.day &&
            fb.startH === b.startH &&
            fb.startM === b.startM &&
            fb.endH === b.endH &&
            fb.endM === b.endM
          );
        });

        // Si todos los bloques de la IA resultan inválidos por traslaparse (o alucinación),
        // recurrimos a nuestra asignación determinista local para no dejar la vista en blanco
        let finalBlocks = validatedBlocks;
        if (finalBlocks.length === 0 && pendingTasks.length > 0) {
          console.warn("AI generated blocks were filtered out. Using deterministic backup scheduler.");
          let blockIdx = 0;
          const sortedTasks = [...pendingTasks].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
          
          for (const task of sortedTasks) {
            const neededHours = task.estimatedTime || 2;
            const blocksNeeded = Math.ceil((neededHours * 60) / 40);
            
            for (let b = 0; b < blocksNeeded; b++) {
              if (blockIdx >= freeBlocks.length) break;
              const fb = freeBlocks[blockIdx++];
              finalBlocks.push({
                day: fb.day,
                startH: fb.startH,
                startM: fb.startM,
                endH: fb.endH,
                endM: fb.endM,
                taskTitle: task.title,
                priority: task.priorityScore > 80 ? 'high' : 'medium',
                reason: 'Asignado automáticamente en ventana libre (Respaldo local).'
              });
            }
          }
        }

        const formattedBlocks = finalBlocks.map((b, i) => {
          const { top, height } = calculateVisuals(b.startH, b.startM, b.endH, b.endM);
          return {
            id: `study-${Date.now()}-${i}`,
            title: b.taskTitle || 'Estudio',
            day: b.day,
            startH: b.startH,
            startM: b.startM,
            endH: b.endH,
            endM: b.endM,
            top,
            height,
            isStudyBlock: true,
            priority: b.priority || 'medium',
            reason: b.reason || 'Bloque de estudio sugerido'
          };
        });
        setStudyBlocks(formattedBlocks);
        if (user) {
          localStorage.setItem(`academic_${user.id}_study_blocks`, JSON.stringify(formattedBlocks));
        }
      }
    } catch (error) {
      console.error("Error generating study routine:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScheduleContext.Provider value={{ 
      schedule, 
      effectiveSchedule,
      studyBlocks,
      predefBlocks,
      isProcessing, 
      uploadAndProcessImage, 
      clearSchedule,
      clearStudyBlocks,
      updateStudyBlock,
      deleteStudyBlock,
      updateClass,
      saveFullSchedule,
      generateStudyRoutine,
      reportClassSuspension,
      removeClassSuspension,
      getColorType,
      calculateVisuals
    }}>
      {children}
    </ScheduleContext.Provider>
  );
};
