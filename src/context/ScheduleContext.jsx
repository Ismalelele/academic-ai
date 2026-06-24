import { createContext, useContext, useState, useEffect } from 'react';
import { processScheduleImage } from '../utils/aiVisionProcessor';
import { generateStudyPlan } from '../utils/aiProcessor';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { getSafeLocalStorage } from '../utils/storageSecurity';
import { parseICS } from '../utils/calendarParser';

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
        String(e.id_bloque) === String(cls.id) && 
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
        !(String(e.id_bloque) === String(bloqueId) && e.fecha_excepcion === dateString && e.tipo_excepcion === 'suspension')
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
    const types = ['cultura', 'tecnologias', 'ciber', 'proy-colab', 'formulacion', 'competencias', 'procesos', 'proy-noche', 'clr-rosa', 'clr-rojo', 'clr-cyan', 'clr-lima', 'clr-ambar', 'clr-fuchsia', 'clr-teal', 'clr-slate'];
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
      let extractedData = [];
      if (file.name.endsWith('.ics') || file.type === 'text/calendar') {
        const text = await file.text();
        extractedData = parseICS(text);
      } else {
        extractedData = await processScheduleImage(file);
      }
      
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
    // Restricción de 10 PM (22:00) para el inicio del bloque
    const bStartMins = Number(newStartH) * 60 + Number(newStartM);
    if (bStartMins > 22 * 60) {
      return { success: false, reason: 'Los bloques de estudio no deben crearse después de las 10 PM (22:00).' };
    }

    const bStart = Number(newStartH) * 60 + Number(newStartM);
    const bEnd = Number(newEndH) * 60 + Number(newEndM);

    if (bStart >= bEnd) {
      return { success: false, reason: 'La hora de inicio debe ser anterior a la hora de fin.' };
    }

    // Verificar colisión con clases
    const hasClassConflict = (effectiveSchedule || []).some(cls => {
      if (Number(cls.day) !== Number(newDay) || cls.isSuspended) return false;
      const clsStart = Number(cls.startH) * 60 + Number(cls.startM);
      const clsEnd = Number(cls.endH) * 60 + Number(cls.endM);
      return Math.max(bStart, clsStart) < Math.min(bEnd, clsEnd);
    });

    if (hasClassConflict) {
      return { success: false, reason: 'El bloque coincide con una clase programada.' };
    }

    // Verificar colisión con otros bloques de estudio
    const hasStudyConflict = studyBlocks.some(sb => {
      if (String(sb.id) === String(blockId) || Number(sb.day) !== Number(newDay)) return false;
      const sbStart = Number(sb.startH) * 60 + Number(sb.startM);
      const sbEnd = Number(sb.endH) * 60 + Number(sb.endM);
      return Math.max(bStart, sbStart) < Math.min(bEnd, sbEnd);
    });

    if (hasStudyConflict) {
      return { success: false, reason: 'El bloque se superpone con otro bloque de estudio.' };
    }

    const { top, height } = calculateVisuals(Number(newStartH), Number(newStartM), Number(newEndH), Number(newEndM));
    setStudyBlocks(prev => prev.map(b => {
      if (String(b.id) === String(blockId)) {
        return {
          ...b,
          day: Number(newDay),
          startH: Number(newStartH),
          startM: Number(newStartM),
          endH: Number(newEndH),
          endM: Number(newEndM),
          top,
          height
        };
      }
      return b;
    }));
    return { success: true };
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
        // Excluir bloques que inician después de las 10 PM (22:00)
        const bStartMins = b.startH * 60 + b.startM;
        if (bStartMins > 22 * 60) continue;

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

    // ─── FILTRO DE ELEGIBILIDAD ──────────────────────────────────────────────
    // Una tarea es elegible para planificarse SOLO si cumple las tres condiciones:
    //   1. No está en 'Bandeja de Entrada' (inbox) — ideas en bruto, no listas.
    //   2. Tiene una asignatura específica (distinta de 'General').
    //   3. Tiene una fecha de entrega definida.
    // Las tareas que no cumplan alguna condición se omiten silenciosamente.
    // ─────────────────────────────────────────────────────────────────────────
    const eligibleTasks = (pendingTasks || []).filter(task =>
      task.status !== 'inbox' &&
      task.tag !== 'General' &&
      task.deadline && task.deadline !== ''
    );

    if (eligibleTasks.length === 0) {
      // No hay nada planificable: limpiar el plan sin tocar el localStorage cleared flag
      setStudyBlocks([]);
      if (user) {
        localStorage.removeItem(`academic_${user.id}_study_blocks`);
      }
      return;
    }
    
    setIsProcessing(true);
    try {
      const freeBlocks = findAvailableBlocks(effectiveSchedule);

      // ─── ALGORITMO DE DISTRIBUCIÓN CON ESPACIADO (INTERLOCKING) ─────────────
      // Constantes de negocio:
      //   MAX_CONSECUTIVE: máximo de bloques seguidos por día antes de obligar descanso.
      //   BUFFER_MINS: minutos mínimos entre sesiones en el mismo día.
      // La distribución es round-robin entre días (Lun→Mar→Mié→…) para evitar
      // que un solo día quede saturado.
      // ────────────────────────────────────────────────────────────────────────
      const MAX_CONSECUTIVE = 2;   // máximo 2 bloques seguidos por día
      const BUFFER_MINS = 30;      // descanso obligatorio de al menos 30 minutos

      // Agrupar freeBlocks por día y ordenarlos cronológicamente
      const freeByDay = {};
      for (const fb of freeBlocks) {
        if (!freeByDay[fb.day]) freeByDay[fb.day] = [];
        freeByDay[fb.day].push(fb);
      }
      for (const day of Object.keys(freeByDay)) {
        freeByDay[day].sort((a, b) => (a.startH * 60 + a.startM) - (b.startH * 60 + b.startM));
      }

      // Función de selección de slots con control de espaciado y round-robin
      const pickBlocksWithSpacing = (neededCount) => {
        const picked = [];
        // Contadores de espaciado por día
        const consecByDay = {};   // { day: número de bloques consecutivos asignados }
        const lastEndByDay = {};  // { day: minutos del fin del último bloque asignado }
        // Punteros de posición por día para no reiniciar en cada llamada
        if (!pickBlocksWithSpacing._pointers) pickBlocksWithSpacing._pointers = {};
        const pointers = pickBlocksWithSpacing._pointers;

        const days = Object.keys(freeByDay).map(Number).sort();
        let dayIdx = 0;
        let maxPasses = freeBlocks.length * 2; // guardia anti-bucle infinito

        while (picked.length < neededCount && maxPasses-- > 0) {
          if (days.length === 0) break;
          const day = days[dayIdx % days.length];
          const slots = freeByDay[day];
          const ptr = pointers[day] || 0;

          if (ptr >= slots.length) {
            // Este día ya se agotó, quitar de la rotación
            days.splice(dayIdx % days.length, 1);
            if (days.length === 0) break;
            dayIdx = dayIdx % days.length;
            continue;
          }

          const fb = slots[ptr];
          const key = `${fb.day}-${fb.startH}-${fb.startM}`;
          const fbStartMins = fb.startH * 60 + fb.startM;
          const lastEnd = lastEndByDay[day] || 0;
          const consec = consecByDay[day] || 0;

          // Verificar si ya fue usado por otra tarea
          if (pickBlocksWithSpacing._used.has(key)) {
            pointers[day] = ptr + 1;
            dayIdx = (dayIdx + 1) % days.length;
            continue;
          }

          // Aplicar restricción de espaciado:
          // Si se alcanzó el máximo de consecutivos Y el gap con el bloque anterior
          // es menor al buffer, saltar al siguiente slot de este día.
          if (consec >= MAX_CONSECUTIVE && lastEnd > 0 && (fbStartMins - lastEnd) < BUFFER_MINS) {
            pointers[day] = ptr + 1;
            // No cambiar dayIdx: revisamos el siguiente slot del mismo día
            continue;
          }

          // Aceptar el bloque
          picked.push(fb);
          pickBlocksWithSpacing._used.add(key);
          pointers[day] = ptr + 1;
          // Actualizar contadores: si el bloque es contiguo (+0 min gap) → consecutivo
          consecByDay[day] = (lastEnd > 0 && fbStartMins - lastEnd <= 1) ? consec + 1 : 1;
          lastEndByDay[day] = fb.endH * 60 + fb.endM;

          // Avanzar al siguiente día (round-robin)
          dayIdx = (dayIdx + 1) % days.length;
        }
        return picked;
      };
      // Conjunto global de slots ya usados (compartido entre llamadas de la misma generación)
      pickBlocksWithSpacing._used = new Set();
      pickBlocksWithSpacing._pointers = {};

      let aiBlocks;
      try {
        aiBlocks = await generateStudyPlan(freeBlocks, eligibleTasks);
      } catch (aiErr) {
        console.warn("Groq failed, scheduling locally with spacing algorithm:", aiErr);
        aiBlocks = [];
        const sortedTasks = [...eligibleTasks].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

        for (const task of sortedTasks) {
          const neededHours = task.estimatedTime || 2;
          const blocksNeeded = Math.ceil((neededHours * 60) / 40);
          const picked = pickBlocksWithSpacing(blocksNeeded);
          for (const fb of picked) {
            aiBlocks.push({
              day: fb.day,
              startH: fb.startH,
              startM: fb.startM,
              endH: fb.endH,
              endM: fb.endM,
              taskTitle: task.title,
              priority: task.priorityScore > 80 ? 'high' : 'medium',
              reason: 'Asignado con espaciado automático en ventana libre.'
            });
          }
        }
      }

      if (Array.isArray(aiBlocks)) {
        // Validar que los bloques de la IA correspondan a slots realmente libres
        const validatedBlocks = aiBlocks.filter(b =>
          freeBlocks.some(fb =>
            fb.day === b.day &&
            fb.startH === b.startH &&
            fb.startM === b.startM &&
            fb.endH === b.endH &&
            fb.endM === b.endM
          )
        );

        // Asignación final con espaciado para la respuesta de la IA
        // (también cubre el caso de fallback local ya resuelto arriba)
        const processedBlocks = [];
        const usedFreeBlockKeys = new Set();
        // Reiniciar estado del espaciado para la pasada de la IA
        pickBlocksWithSpacing._used = usedFreeBlockKeys;
        pickBlocksWithSpacing._pointers = {};

        const sortedTasks = [...eligibleTasks].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

        for (const task of sortedTasks) {
          const neededHours = task.estimatedTime || 2;
          const blocksNeeded = Math.ceil((neededHours * 60) / 40);

          // Usar los bloques que la IA sugirió para esta tarea (si están validados)
          const taskAiBlocks = validatedBlocks.filter(b => b.taskTitle === task.title);
          const keptBlocks = [];
          for (const b of taskAiBlocks) {
            const key = `${b.day}-${b.startH}-${b.startM}`;
            if (keptBlocks.length < blocksNeeded && !usedFreeBlockKeys.has(key)) {
              keptBlocks.push(b);
              usedFreeBlockKeys.add(key);
            }
          }
          processedBlocks.push(...keptBlocks);

          // Completar con el algoritmo de espaciado si faltan bloques
          if (keptBlocks.length < blocksNeeded) {
            const extra = pickBlocksWithSpacing(blocksNeeded - keptBlocks.length);
            for (const fb of extra) {
              processedBlocks.push({
                day: fb.day,
                startH: fb.startH,
                startM: fb.startM,
                endH: fb.endH,
                endM: fb.endM,
                taskTitle: task.title,
                priority: task.priorityScore > 80 ? 'high' : 'medium',
                reason: 'Completado con espaciado automático para cumplir horas de estudio.'
              });
            }
          }
        }

        let finalBlocks = processedBlocks;

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

        // ─────────────────────────────────────────────────────────────────────
        // FUSIÓN NO DESTRUCTIVA (UPSERT LOCAL)
        // Algoritmo de diffing basado en clave compuesta (day-startH-startM).
        //
        // Regla 1 – Conservar posición manual: si el usuario ya tiene un bloque
        //   de estudio ocupando exactamente el mismo timeslot (day + hora inicio)
        //   se preserva tal cual, sin importar si el título cambió.
        //
        // Regla 2 – Agregar bloques nuevos: los slots que la IA sugirió pero que
        //   aún no existen en el estado actual se insertan incrementalmente.
        //
        // Regla 3 – Eliminar bloques de tareas que ya no existen: los bloques
        //   cuyo `title` (taskTitle) ya no aparece en `pendingTasks` se descartan
        //   para mantener el plan coherente con las tareas actuales.
        // ─────────────────────────────────────────────────────────────────────
        setStudyBlocks(prevBlocks => {
          // Conjunto de títulos de tareas elegibles actuales (ya filtradas)
          const pendingTitles = new Set(eligibleTasks.map(t => t.title));

          // Mapa de los bloques actuales indexados por clave de timeslot
          const prevBySlot = new Map(
            prevBlocks.map(b => [`${b.day}-${b.startH}-${b.startM}`, b])
          );

          // Mapa de los bloques nuevos generados por la IA, por clave de timeslot
          const newBySlot = new Map(
            formattedBlocks.map(b => [`${b.day}-${b.startH}-${b.startM}`, b])
          );

          // Paso 1: Filtrar bloques anteriores que aún son válidos.
          //   - Si el timeslot existe en los nuevos bloques → actualizar sólo los
          //     campos no posicionales (priority, reason) pero conservar id y pos.
          //   - Si el timeslot NO existe en los nuevos, pero la tarea aún está
          //     pendiente → conservarlo (el usuario lo movió manualmente).
          //   - Si la tarea ya no está pendiente → eliminarlo.
          const survivingBlocks = prevBlocks
            .filter(b => pendingTitles.has(b.title)) // Regla 3: descartar tareas finalizadas
            .map(b => {
              const slotKey = `${b.day}-${b.startH}-${b.startM}`;
              const incoming = newBySlot.get(slotKey);
              if (incoming && incoming.title === b.title) {
                // Mismo slot y misma tarea → actualizar metadatos, conservar posición
                return { ...b, priority: incoming.priority, reason: incoming.reason };
              }
              // Slot diferente o no presente en nuevo plan → conservar tal cual (Regla 1)
              return b;
            });

          // Paso 2: Identificar los slots del plan nuevo que no están cubiertos
          //   por ningún bloque superviviente.
          const survivingSlotKeys = new Set(
            survivingBlocks.map(b => `${b.day}-${b.startH}-${b.startM}`)
          );

          const addedBlocks = formattedBlocks.filter(b => {
            const slotKey = `${b.day}-${b.startH}-${b.startM}`;
            return !survivingSlotKeys.has(slotKey); // Regla 2: sólo agregar slots realmente nuevos
          });

          const merged = [...survivingBlocks, ...addedBlocks];

          // Persistir inmediatamente en localStorage para reactividad en Dashboard
          if (user) {
            localStorage.setItem(
              `academic_${user.id}_study_blocks`,
              JSON.stringify(merged)
            );
          }

          return merged;
          // Nota: el useEffect de sync (línea ~189) ya dispara el upsert con
          // debounce de 1200ms hacia `planificacion_estudio` en Supabase,
          // evitando llamadas redundantes por cada elemento nuevo.
        });
      }
    } catch (error) {
      console.error("Error generating study routine:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── RESTAURAR PLANIFICACIÓN (UNDO SNAPSHOT) ─────────────────────────────
  // Revierte el estado de studyBlocks a un snapshot guardado previamente.
  // Se persiste en localStorage de forma inmediata para que el Dashboard
  // refleje el cambio sin necesidad de recargar la página.
  // ────────────────────────────────────────────────────────────────────────
  const restoreStudyBlocks = (snapshot) => {
    if (!Array.isArray(snapshot)) return;
    setStudyBlocks(snapshot);
    if (user) {
      localStorage.setItem(
        `academic_${user.id}_study_blocks`,
        JSON.stringify(snapshot)
      );
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
      restoreStudyBlocks,
      reportClassSuspension,
      removeClassSuspension,
      getColorType,
      calculateVisuals
    }}>
      {children}
    </ScheduleContext.Provider>
  );
};
