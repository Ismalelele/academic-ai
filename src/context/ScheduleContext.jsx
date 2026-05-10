import { createContext, useContext, useState, useEffect } from 'react';
import { processScheduleImage } from '../utils/aiVisionProcessor';

const ScheduleContext = createContext();

export const useSchedule = () => useContext(ScheduleContext);

export const ScheduleProvider = ({ children }) => {
  const [schedule, setSchedule] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Intentar cargar de localStorage inicial
  useEffect(() => {
    const savedSchedule = localStorage.getItem('academic_ai_schedule');
    if (savedSchedule) {
      setSchedule(JSON.parse(savedSchedule));
    }
  }, []);

  const getColorType = (title) => {
    // Generate a pseudo-random color type based on title length or simple hash
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
    const baseTotal = 8 * 60 + 15; // Schedule starts at 08:15
    const pixelsPerMinute = 37.5 / 45; // 37.5px per 45 min slot

    const top = (startTotal - baseTotal) * pixelsPerMinute;
    const height = (endTotal - startTotal) * pixelsPerMinute;
    
    return { top: `${Math.max(0, top)}px`, height: `${Math.max(10, height)}px` };
  };

  const uploadAndProcessImage = async (file) => {
    setIsProcessing(true);
    try {
      // IA Vision extrayendo datos
      const extractedData = await processScheduleImage(file);
      
      if (Array.isArray(extractedData) && extractedData.length > 0) {
        const finalSchedule = extractedData.map((cls, idx) => {
          const { top, height } = calculateVisuals(cls.startH, cls.startM, cls.endH, cls.endM);
          return {
            ...cls,
            id: idx,
            top,
            height,
            type: getColorType(cls.title)
          };
        });
        
        // Reemplazar horario anterior
        setSchedule(finalSchedule);
        localStorage.setItem('academic_ai_schedule', JSON.stringify(finalSchedule));
      }
    } catch (error) {
      console.error("Error al procesar el horario:", error);
      alert("Hubo un error analizando la imagen. Asegúrate de subir una foto legible.");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearSchedule = () => {
    setSchedule(null);
    localStorage.removeItem('academic_ai_schedule');
  };

  return (
    <ScheduleContext.Provider value={{ schedule, isProcessing, uploadAndProcessImage, clearSchedule }}>
      {children}
    </ScheduleContext.Provider>
  );
};
