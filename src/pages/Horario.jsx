import { RefreshCw, Upload, Loader2, Trash2, Wand2, X, Check } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';
import { generateICS } from '../utils/calendarGenerator';

const COLOR_PALETTE = [
  { type: 'cultura', label: 'Violeta', solid: '#8b5cf6' },
  { type: 'tecnologias', label: 'Naranja', solid: '#f97316' },
  { type: 'ciber', label: 'Esmeralda', solid: '#10b981' },
  { type: 'proy-colab', label: 'Azul', solid: '#3b82f6' },
  { type: 'formulacion', label: 'Celeste', solid: '#0ea5e9' },
  { type: 'competencias', label: 'Verde', solid: '#22c55e' },
  { type: 'procesos', label: 'Amarillo', solid: '#eab308' },
  { type: 'proy-noche', label: 'Índigo', solid: '#6366f1' },
  { type: 'clr-rosa', label: 'Rosa', solid: '#ec4899' },
  { type: 'clr-rojo', label: 'Rojo', solid: '#ef4444' },
  { type: 'clr-cyan', label: 'Cyan', solid: '#06b6d4' },
  { type: 'clr-lima', label: 'Lima', solid: '#84cc16' },
  { type: 'clr-ambar', label: 'Ámbar', solid: '#f59e0b' },
  { type: 'clr-fuchsia', label: 'Fucsia', solid: '#d946ef' },
  { type: 'clr-teal', label: 'Teal', solid: '#14b8a6' },
  { type: 'clr-slate', label: 'Gris Azul', solid: '#64748b' },
];

export default function Horario() {
  const { schedule, effectiveSchedule, studyBlocks, predefBlocks, isProcessing, uploadAndProcessImage, clearSchedule, saveFullSchedule, generateStudyRoutine, reportClassSuspension, removeClassSuspension, getColorType, calculateVisuals } = useSchedule();
  const { tasks } = useTasks();
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [tempSchedule, setTempSchedule] = useState([]);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [activeColorPickerId, setActiveColorPickerId] = useState(null);
  const [selectedDayMobile, setSelectedDayMobile] = useState(() => {
    const today = new Date().getDay();
    return today === 0 ? 6 : today - 1;
  });

  const hasChanges = JSON.stringify(tempSchedule) !== JSON.stringify(schedule || []);

  useEffect(() => {
    setTempSchedule(schedule ? JSON.parse(JSON.stringify(schedule)) : []);
  }, [schedule]);

  useEffect(() => {
    if (!activeColorPickerId) return;
    const handleDocumentClick = (e) => {
      if (!e.target.closest('.color-picker-container')) {
        setActiveColorPickerId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [activeColorPickerId]);

  const handleGenerateRoutine = () => {
    const pendingTasks = tasks.filter(t => t.status !== 'done');
    generateStudyRoutine(pendingTasks, true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadAndProcessImage(file);
    }
  };

  const handleDiscardChanges = () => {
    if (confirm("¿Estás seguro de que deseas descartar todos los cambios no guardados?")) {
      setTempSchedule(schedule ? JSON.parse(JSON.stringify(schedule)) : []);
    }
  };

  const handleSaveSchedule = async () => {
    const hasEmptyTitle = tempSchedule.some(c => !c.title.trim());
    if (hasEmptyTitle) {
      alert("Por favor, ingresa el nombre de todas las asignaturas.");
      return false;
    }

    // Validation of overlapping blocks
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    for (let i = 0; i < tempSchedule.length; i++) {
      for (let j = i + 1; j < tempSchedule.length; j++) {
        const c1 = tempSchedule[i];
        const c2 = tempSchedule[j];
        if (c1.day === c2.day) {
          const start1 = c1.startH * 60 + c1.startM;
          const end1 = c1.endH * 60 + c1.endM;
          const start2 = c2.startH * 60 + c2.startM;
          const end2 = c2.endH * 60 + c2.endM;
          if (start1 < end2 && start2 < end1) {
            alert(`Conflicto de horario: "${c1.title || 'Clase sin nombre'}" y "${c2.title || 'Clase sin nombre'}" se solapan el ${dayNames[c1.day]}.`);
            return false;
          }
        }
      }
    }

    await saveFullSchedule(tempSchedule);
    return true;
  };

  const handleExportICS = () => {
    if (!schedule || schedule.length === 0) {
      alert("No hay horario para exportar.");
      return;
    }
    
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - currentDay);
    
    // Generar instancias por 12 semanas (un semestre)
    const exportEvents = [];
    
    for (let week = 0; week < 12; week++) {
      schedule.forEach(cls => {
        const eventStart = new Date(monday);
        eventStart.setDate(eventStart.getDate() + cls.day + (week * 7));
        eventStart.setHours(cls.startH, cls.startM, 0, 0);
        
        const eventEnd = new Date(monday);
        eventEnd.setDate(eventEnd.getDate() + cls.day + (week * 7));
        eventEnd.setHours(cls.endH, cls.endM, 0, 0);
        
        exportEvents.push({
          id: `${cls.id}-${week}`,
          title: cls.title,
          start: eventStart,
          end: eventEnd,
          location: 'Universidad',
          description: `Generado por AURA`
        });
      });
    }
    
    const icsString = generateICS(exportEvents);
    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'horario_aura.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrollToEditor = () => {
    if (editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <main className="main-content">
      <header>
        <div>
          <h1 className="page-title">Mi Horario Semanal</h1>
          <p className="subtitle">Sube tu horario y deja que la IA organice tu rutina diaria</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {isEditingSchedule ? (
            <>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  setTempSchedule(schedule ? JSON.parse(JSON.stringify(schedule)) : []);
                  setIsEditingSchedule(false);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 700 }}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                onClick={async () => {
                  const success = await handleSaveSchedule();
                  if (success !== false) {
                    setIsEditingSchedule(false);
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
              >
                <Check size={18} /> Guardar Cambios
              </button>
            </>
          ) : (
            <>
              {effectiveSchedule && (
                <button 
                  className="btn-primary" 
                  onClick={() => setIsEditingSchedule(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
                >
                  ✏️ Editar Horario
                </button>
              )}
              {!hasChanges && effectiveSchedule && (
                <button className="btn-secondary" onClick={handleGenerateRoutine} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px', borderRadius: '8px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', transition: '0.3s' }}>
                  <Wand2 size={18} /> {isProcessing ? 'Planificando...' : 'Generar Rutina con IA'}
                </button>
              )}
              {effectiveSchedule && (
                <button className="btn-secondary" onClick={clearSchedule} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', transition: '0.3s' }}>
                  <Trash2 size={18} /> Limpiar
                </button>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*,.pdf,.ics" 
                style={{ display: 'none' }} 
              />
              <button 
                className="btn-primary" 
                onClick={() => fileInputRef.current.click()}
                disabled={isProcessing}
              >
                {isProcessing ? 'Analizando...' : effectiveSchedule ? 'Subir Nuevo Horario' : 'Cargar Horario (PDF/Img/ICS)'}
                {isProcessing ? <Loader2 size={20} className="spinner" /> : <Upload size={20} />}
              </button>
              {effectiveSchedule && (
                <button 
                  className="btn-secondary" 
                  onClick={handleExportICS}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', transition: '0.3s' }}
                >
                  Exportar (.ics)
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Day Selector (Mobile Only) */}
      <div className="mobile-day-selector" style={{ marginBottom: '15px' }}>
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedDayMobile(idx)}
            className={selectedDayMobile === idx ? 'active' : ''}
          >
            {day}
          </button>
        ))}
      </div>

      {/* === TIMETABLE VIEW === */}
      <div className="timetable-container" style={{ marginBottom: '35px' }}>
        <div className="time-column">
          <div className="time-header">HORAS</div>
          {predefBlocks && predefBlocks.map((b) => (
            <div key={b.index} className="time-slot" style={{ fontSize: '0.7rem', padding: '0 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
              {b.start} - {b.end}
            </div>
          ))}
        </div>

        <div className="days-container" style={{ minWidth: 'auto', width: '100%' }}>

          <div className="days-header">
            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dayName, idx) => (
              <div 
                key={idx} 
                className={selectedDayMobile === idx ? 'active-day-mobile' : 'inactive-day-mobile'}
              >
                {dayName.toUpperCase()}
              </div>
            ))}
          </div>
          <div className="grid-content" style={{ position: 'relative' }}>
            {isProcessing && (
              <div className="processing-overlay">
                <Loader2 size={40} className="spinner" />
                <p>La IA está analizando tu horario y estructurando las clases...</p>
              </div>
            )}

            {isEditingSchedule && (
              <div className="editor-grid-overlay">
                {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                  const dayClasses = tempSchedule.filter(c => c.day === dayIndex).sort((a, b) => (a.startH * 60 + a.startM) - (b.startH * 60 + b.startM));
                  return (
                    <div 
                      key={dayIndex} 
                      className={`editor-day-column ${selectedDayMobile === dayIndex ? 'active-day-mobile' : 'inactive-day-mobile'}`}
                      style={{ 
                        borderRight: '1px solid var(--border-color)', 
                        padding: '0 8px', 
                        position: 'relative',
                        height: '100%'
                      }}
                    >
                      {dayClasses.map((cls) => {
                        const idx = tempSchedule.findIndex(c => c.id === cls.id);
                        if (idx === -1) return null;
                        const colorType = cls.type || getColorType(cls.title || '');
                        
                        return (
                          <div 
                            key={cls.id} 
                            className={`editor-row-card ${colorType}`} 
                            style={{ 
                              position: 'absolute',
                              top: cls.top,
                              height: cls.height,
                              minHeight: '100px',
                              left: '6px',
                              right: '6px',
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '6px', 
                              padding: '8px',
                              borderRadius: '12px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--card-bg)',
                              zIndex: activeColorPickerId === cls.id ? 25 : 5,
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                              transition: 'z-index 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (activeColorPickerId !== cls.id) {
                                e.currentTarget.style.zIndex = '10';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (activeColorPickerId !== cls.id) {
                                e.currentTarget.style.zIndex = '5';
                              }
                            }}
                          >
                            <div>
                              <input 
                                type="text" 
                                placeholder="Asignatura" 
                                value={cls.title}
                                onChange={(e) => {
                                  const newSched = [...tempSchedule];
                                  newSched[idx].title = e.target.value;
                                  setTempSchedule(newSched);
                                }}
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.25)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none', fontWeight: 600, marginBottom: '4px' }}
                              />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <input 
                                  type="number" min="0" max="23" placeholder="HH"
                                  value={cls.startH}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                                    const newSched = [...tempSchedule];
                                    newSched[idx].startH = val;
                                    const { top, height } = calculateVisuals(val, cls.startM, cls.endH, cls.endM);
                                    newSched[idx].top = top;
                                    newSched[idx].height = height;
                                    setTempSchedule(newSched);
                                  }}
                                  style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', fontSize: '0.7rem', textAlign: 'center', outline: 'none' }}
                                />
                                <span style={{ fontSize: '0.7rem' }}>:</span>
                                <input 
                                  type="number" min="0" max="59" placeholder="MM"
                                  value={cls.startM}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                    const newSched = [...tempSchedule];
                                    newSched[idx].startM = val;
                                    const { top, height } = calculateVisuals(cls.startH, val, cls.endH, cls.endM);
                                    newSched[idx].top = top;
                                    newSched[idx].height = height;
                                    setTempSchedule(newSched);
                                  }}
                                  style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', fontSize: '0.7rem', textAlign: 'center', outline: 'none' }}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <input 
                                  type="number" min="0" max="23" placeholder="HH"
                                  value={cls.endH}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                                    const newSched = [...tempSchedule];
                                    newSched[idx].endH = val;
                                    const { top, height } = calculateVisuals(cls.startH, cls.startM, val, cls.endM);
                                    newSched[idx].top = top;
                                    newSched[idx].height = height;
                                    setTempSchedule(newSched);
                                  }}
                                  style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', fontSize: '0.7rem', textAlign: 'center', outline: 'none' }}
                                />
                                <span style={{ fontSize: '0.7rem' }}>:</span>
                                <input 
                                  type="number" min="0" max="59" placeholder="MM"
                                  value={cls.endM}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                    const newSched = [...tempSchedule];
                                    newSched[idx].endM = val;
                                    const { top, height } = calculateVisuals(cls.startH, cls.startM, cls.endH, val);
                                    newSched[idx].top = top;
                                    newSched[idx].height = height;
                                    setTempSchedule(newSched);
                                  }}
                                  style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', fontSize: '0.7rem', textAlign: 'center', outline: 'none' }}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', gap: '5px', position: 'relative' }}>
                              <div className="color-picker-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Color:</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveColorPickerId(activeColorPickerId === cls.id ? null : cls.id);
                                  }}
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    background: COLOR_PALETTE.find(c => c.type === colorType)?.solid || '#8b5cf6',
                                    border: '1px solid var(--text-main)',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                  title="Cambiar color"
                                />

                                {activeColorPickerId === cls.id && (
                                  <div 
                                    style={{
                                      position: 'absolute',
                                      bottom: '22px',
                                      left: '0',
                                      background: 'var(--card-bg)',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '8px',
                                      padding: '8px',
                                      display: 'flex',
                                      gap: '4px',
                                      flexWrap: 'wrap',
                                      width: '120px',
                                      zIndex: 30,
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                    }}
                                  >
                                    {COLOR_PALETTE.map((c) => {
                                      const isSelected = colorType === c.type;
                                      return (
                                        <button
                                          key={c.type}
                                          type="button"
                                          onClick={() => {
                                            const newSched = [...tempSchedule];
                                            newSched[idx].type = c.type;
                                            setTempSchedule(newSched);
                                            setActiveColorPickerId(null);
                                          }}
                                          title={c.label}
                                          style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            background: c.solid,
                                            border: isSelected ? '1px solid var(--text-main)' : 'none',
                                            cursor: 'pointer',
                                            padding: 0
                                          }}
                                        />
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              <button 
                                type="button"
                                onClick={() => {
                                  setTempSchedule(tempSchedule.filter((_, i) => i !== idx));
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                                title="Eliminar clase"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    </div>
                  );
                })}
              </div>
            )}
            
            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
              <div 
                key={dayIndex} 
                className={`day-track ${selectedDayMobile === dayIndex ? 'active-day-mobile' : 'inactive-day-mobile'}`}
              >
                {!isEditingSchedule && ((hasChanges ? tempSchedule : effectiveSchedule) || [])
                  .filter(cls => cls.day === dayIndex)
                  .map(cls => (
                    <div 
                      key={cls.id} 
                      className={`card ${cls.type} ${cls.isSuspended ? 'suspended' : ''}`} 
                      style={{ 
                        top: cls.top, 
                        height: cls.height,
                        opacity: cls.isSuspended ? 0.5 : 1,
                        cursor: hasChanges ? 'default' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center'
                      }}
                      onClick={() => !hasChanges && setSelectedClass(cls)}
                    >
                      <span style={{ textDecoration: cls.isSuspended ? 'line-through' : 'none' }}>{cls.title}</span> 
                      <span style={{ fontSize: '0.8rem', textDecoration: cls.isSuspended ? 'line-through' : 'none' }}>{cls.room || ''}</span>
                      {cls.isSuspended && (
                        <div style={{ marginTop: '4px', fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                          🚫 Suspendida
                        </div>
                      )}
                    </div>
                ))}
                {!hasChanges && studyBlocks && studyBlocks
                  .filter(cls => cls.day === dayIndex)
                  .map(cls => (
                    <div 
                      key={cls.id} 
                      className="card" 
                      style={{ 
                        top: cls.top, 
                        height: cls.height,
                        background: 'repeating-linear-gradient(45deg, var(--primary-light), var(--primary-light) 10px, transparent 10px, transparent 20px)',
                        border: '2px dashed var(--primary)',
                        color: 'var(--primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        opacity: 0.9,
                        zIndex: 2
                      }}
                      title={`Motivo: ${cls.reason}\nPrioridad: ${cls.priority}`}
                    >
                      <strong>📚 {cls.title}</strong>
                      <span style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>Bloque de estudio</span>
                    </div>
                ))}
              </div>
            ))}
            
            {!effectiveSchedule && !isProcessing && (
              <div className="empty-schedule" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '30px', background: 'var(--bg)', zIndex: 10 }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: '500', display: 'block', marginBottom: '15px' }}>Sube una foto o PDF para que la IA lo organice por ti.</span>
                  <button 
                    className="btn-secondary"
                    onClick={scrollToEditor}
                    style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', margin: '0 auto', display: 'block' }}
                  >
                    ✏️ O agrégalo manualmente abajo 👇
                  </button>
                </div>
                
                <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: '14px', padding: '25px', maxWidth: '550px', boxShadow: 'var(--shadow-sm)' }}>
                  <h4 style={{ color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', fontSize: '1.1rem', fontWeight: '800' }}>
                    ⚠️ Instrucciones de subida
                  </h4>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '12px', lineHeight: '1.5', fontWeight: '600' }}>
                    Para que la IA no se confunda y dibuje los ramos en el día equivocado, asegúrate de que tu captura de pantalla contenga:
                  </p>
                  <ul style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginLeft: '25px', lineHeight: '1.7', fontWeight: '500' }}>
                    <li>Los <strong>encabezados de los días</strong> (Lunes a Domingo) arriba.</li>
                    <li>Las <strong>horas o duración</strong> en el eje izquierdo.</li>
                    <li>El <strong>nombre de las asignaturas</strong> legible.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditingSchedule && (
        <div className="add-class-buttons-panel">
          <div className="add-class-buttons-grid">
            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((dayName, idx) => (
              <button
                key={idx}
                type="button"
                className={`add-class-btn day-${idx} ${selectedDayMobile === idx ? 'active-day-btn' : ''}`}
                onClick={() => {
                  const startH = 8, startM = 15, endH = 9, endM = 35;
                  const { top, height } = calculateVisuals(startH, startM, endH, endM);
                  setTempSchedule([...tempSchedule, {
                    id: 'block-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    title: '',
                    day: idx,
                    startH,
                    startM,
                    endH,
                    endM,
                    top,
                    height,
                    type: 'cultura'
                  }]);
                }}
              >
                ➕ Clase ({dayName})
              </button>
            ))}
          </div>
        </div>
      )}



      {/* === CLASS DETAILS MODAL === */}
      {selectedClass && (
        <div className="modal-overlay" onClick={() => setSelectedClass(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '15px', color: 'var(--text-main)' }}>Gestión de Clase</h3>
            <p style={{ color: 'var(--text-main)', marginBottom: '10px' }}><strong>Asignatura:</strong> {selectedClass.title}</p>
            <p style={{ color: 'var(--text-main)', marginBottom: '10px' }}><strong>Fecha (esta semana):</strong> {selectedClass.dateString}</p>
            
            <div style={{ marginTop: '15px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', padding: '15px', borderRadius: '10px' }}>
              <p style={{ marginBottom: '10px', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>🎨 Cambiar Color del Ramo</p>
              <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                {COLOR_PALETTE.map((c) => {
                  const currentType = selectedClass.type || getColorType(selectedClass.title || '');
                  const isSelected = currentType === c.type;
                  return (
                    <button
                      key={c.type}
                      onClick={async () => {
                        const updatedSchedule = schedule.map(item => {
                          if (item.id === selectedClass.id) {
                            return { ...item, type: c.type };
                          }
                          return item;
                        });
                        await saveFullSchedule(updatedSchedule);
                        setSelectedClass({ ...selectedClass, type: c.type });
                      }}
                      title={c.label}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c.solid,
                        border: isSelected ? '2px solid var(--text-main)' : '1px solid rgba(255, 255, 255, 0.15)',
                        cursor: 'pointer',
                        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                        boxShadow: isSelected ? `0 0 8px ${c.solid}` : 'none',
                        transition: 'transform 0.2s ease, border-color 0.2s ease',
                        padding: 0,
                        outline: 'none'
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {!selectedClass.isSuspended ? (
              <div style={{ marginTop: '20px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '15px', borderRadius: '10px' }}>
                <p style={{ marginBottom: '15px', color: 'var(--text-main)', fontWeight: 600 }}>¿El profesor suspendió esta clase para hoy?</p>
                <button 
                  className="btn-primary" 
                  style={{ background: '#ef4444', borderColor: '#ef4444', width: '100%' }}
                  onClick={async () => {
                    await reportClassSuspension(selectedClass.id, selectedClass.dateString);
                    setSelectedClass(null);
                  }}
                >
                  🚫 Reportar Suspensión
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
                <p style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '15px' }}>
                  ✅ Esta clase ya está reportada como suspendida para esta fecha.
                </p>
                <button 
                  className="btn-secondary" 
                  style={{ background: 'var(--bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', width: '100%', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  onClick={async () => {
                    await removeClassSuspension(selectedClass.id, selectedClass.dateString);
                    setSelectedClass(null);
                  }}
                >
                  ↩️ Deshacer Suspensión
                </button>
              </div>
            )}
            
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedClass(null)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
