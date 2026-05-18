import { createContext, useContext, useState, useEffect } from 'react';
import { processScheduleImage } from '../utils/aiVisionProcessor';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const ScheduleContext = createContext();

export const useSchedule = () => useContext(ScheduleContext);

export const ScheduleProvider = ({ children }) => {
  const [schedule, setSchedule] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();

  // Cargar el horario del usuario desde Supabase cuando inicia sesión
  useEffect(() => {
    if (!user) {
      setSchedule(null);
      return;
    }

    const fetchSchedule = async () => {
      // Buscar el horario más reciente de este usuario
      const { data: horarioData, error: horarioError } = await supabase
        .from('horarios')
        .select('id_horario')
        .eq('user_id', user.id)
        .order('fecha_subida', { ascending: false })
        .limit(1)
        .single();

      if (horarioError && horarioError.code !== 'PGRST116') {
        console.error("Error al buscar horario:", horarioError);
        return;
      }

      if (horarioData) {
        // Buscar los bloques (ramos) de este horario
        const { data: bloquesData, error: bloquesError } = await supabase
          .from('bloques_clases')
          .select('*')
          .eq('id_horario', horarioData.id_horario);

        if (!bloquesError && bloquesData) {
          // Transformar la data de DB al formato que espera el Frontend
          const formattedSchedule = bloquesData.map((bloque) => {
            const [startH, startM] = bloque.hora_inicio.split(':').map(Number);
            const [endH, endM] = bloque.hora_fin.split(':').map(Number);
            const { top, height } = calculateVisuals(startH, startM, endH, endM);
            
            return {
              id: bloque.id_bloque, // id del registro en BD
              title: bloque.asignatura,
              day: bloque.dia_semana,
              startH, startM, endH, endM,
              top, height,
              type: bloque.tipo_color
            };
          });
          setSchedule(formattedSchedule);
        }
      }
    };

    fetchSchedule();
  }, [user]);

  const getColorType = (title) => {
    const types = ['cultura', 'tecnologias', 'ciber', 'proy-colab', 'formulacion', 'competencias', 'procesos', 'proy-noche'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return types[Math.abs(hash) % types.length];
  };

  const calculateVisuals = (startH, startM, endH, endM) => {
    const startTotal = startH + startM / 60;
    const endTotal = endH + endM / 60;
    const baseTotal = 8;
    const pixelsPerHour = 50;

    const top = (startTotal - baseTotal) * pixelsPerHour;
    const height = (endTotal - startTotal) * pixelsPerHour;
    
    return { top: `${Math.max(0, top)}px`, height: `${Math.max(10, height)}px` };
  };

  const uploadAndProcessImage = async (file) => {
    if (!user) {
      alert("Debes iniciar sesión para subir un horario.");
      return;
    }
    
    setIsProcessing(true);
    try {
      // 1. Extraer datos con IA
      const extractedData = await processScheduleImage(file);
      
      if (Array.isArray(extractedData) && extractedData.length > 0) {
        
        // 2. Eliminar el horario viejo de la BD (si existe)
        await supabase.from('horarios').delete().eq('user_id', user.id);

        // 3. Crear el nuevo Horario en la BD
        const { data: newHorario, error: insertHorarioError } = await supabase
          .from('horarios')
          .insert([{ user_id: user.id }])
          .select()
          .single();

        if (insertHorarioError) throw insertHorarioError;

        // 4. Preparar y subir los bloques de clases a la BD
        const bloquesToInsert = extractedData.map(cls => ({
          id_horario: newHorario.id_horario,
          dia_semana: cls.day,
          hora_inicio: `${cls.startH.toString().padStart(2, '0')}:${cls.startM.toString().padStart(2, '0')}`,
          hora_fin: `${cls.endH.toString().padStart(2, '0')}:${cls.endM.toString().padStart(2, '0')}`,
          asignatura: cls.title,
          tipo_color: getColorType(cls.title)
        }));

        const { data: insertedBloques, error: insertBloquesError } = await supabase
          .from('bloques_clases')
          .insert(bloquesToInsert)
          .select();

        if (insertBloquesError) throw insertBloquesError;

        // 5. Transformar y setear el estado local
        const finalSchedule = insertedBloques.map((bloque) => {
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
        
        setSchedule(finalSchedule);
      }
    } catch (error) {
      console.error("Error al procesar el horario:", error);
      alert(`Error: ${error.message || 'Desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearSchedule = async () => {
    if (user) {
      await supabase.from('horarios').delete().eq('user_id', user.id);
    }
    setSchedule(null);
  };

  return (
    <ScheduleContext.Provider value={{ schedule, isProcessing, uploadAndProcessImage, clearSchedule }}>
      {children}
    </ScheduleContext.Provider>
  );
};
