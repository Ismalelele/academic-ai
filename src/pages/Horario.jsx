import { RefreshCw, Upload, Loader2, Trash2, Wand2, X, Check } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';

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
  const { schedule, effectiveSchedule, studyBlocks, predefBlocks, isProcessing, uploadAndProcessImage, clearSchedule, saveFullSchedule, generateStudyRoutine, reportClassSuspension, removeClassSuspension, getColorType } = useSchedule();
  const { tasks } = useTasks();
  const fileInputRef = useRef(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [tempSchedule, setTempSchedule] = useState([]);

  const handleGenerateRoutine = () => {
    const pendingTasks = tasks.filter(t => t.status !== 'done');
    generateStudyRoutine(pendingTasks);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadAndProcessImage(file);
    }
  };

  const enterEditMode = () => {
    setTempSchedule(schedule ? JSON.parse(JSON.stringify(schedule)) : []);
    setIsEditing(true);
  };

  const exitEditMode = () => {
    setIsEditing(false);
  };

  const handleSaveSchedule = async () => {
    const hasEmptyTitle = tempSchedule.some(c => !c.title.trim());
    if (hasEmptyTitle) {
      alert("Por favor, ingresa el nombre de todas las asignaturas.");
      return;
    }
    await saveFullSchedule(tempSchedule);
    setIsEditing(false);
  };

  return (
    <main className="main-content">
      <header>
        <div>
          <h1 className="page-title">Mi Horario Semanal</h1>
          <p className="subtitle">Sube tu horario y deja que la IA organice tu rutina diaria</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {isEditing ? (
            <>
              <button 
                className="btn-secondary" 
                onClick={exitEditMode}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', transition: '0.3s' }}
              >
                📅 Mi Horario
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSaveSchedule}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}
              >
                <Check size={18} /> Guardar Cambios
              </button>
            </>
          ) : (
            <>
              <button 
                className="btn-secondary" 
                onClick={enterEditMode}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', transition: '0.3s' }}
              >
                ✏️ Corregir Horario
              </button>
              {effectiveSchedule && (
                <>
                  <button className="btn-secondary" onClick={handleGenerateRoutine} disabled={isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px', borderRadius: '8px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', transition: '0.3s' }}>
                    <Wand2 size={18} /> {isProcessing ? 'Planificando...' : 'Generar Rutina con IA'}
                  </button>
                  <button className="btn-secondary" onClick={clearSchedule} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', transition: '0.3s' }}>
                    <Trash2 size={18} /> Limpiar
                  </button>
                </>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*,.pdf" 
                style={{ display: 'none' }} 
              />
              <button 
                className="btn-primary" 
                onClick={() => fileInputRef.current.click()}
                disabled={isProcessing}
              >
                {isProcessing ? 'Analizando...' : effectiveSchedule ? 'Subir Nuevo Horario' : 'Cargar Horario (PDF/Img)'}
                {isProcessing ? <Loader2 size={20} className="spinner" /> : <Upload size={20} />}
              </button>
            </>
          )}
        </div>
      </header>

      {/* === INLINE EDITOR VIEW === */}
      {isEditing ? (
        <div style={{ 
          background: 'var(--card-bg)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '20px', 
          padding: '20px', 
          boxShadow: 'var(--shadow-md)', 
          backdropFilter: 'var(--glass-blur)',
          animation: 'fadeUp 0.4s ease-out'
        }}>
          {/* Horizontal Day Columns */}
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
              const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
              const dayClasses = tempSchedule.filter(c => c.day === dayIndex);
              
              return (
                <div 
                  key={dayIndex} 
                  style={{ 
                    minWidth: '260px', 
                    width: '260px', 
                    background: 'rgba(255,255,255,0.01)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '16px', 
                    padding: '12px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px',
                    flexShrink: 0
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{dayNames[dayIndex]}</span>
                    <span style={{ fontSize: '0.8rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                      {dayClasses.length}
                    </span>
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    {dayClasses.map((cls) => {
                      const idx = tempSchedule.findIndex(c => c.id === cls.id);
                      if (idx === -1) return null;
                      const colorType = cls.type || getColorType(cls.title || '');
                      
                      return (
                        <div 
                          key={cls.id} 
                          className={`editor-row-card ${colorType}`} 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '10px', 
                            padding: '12px 12px 12px 18px',
                            gridTemplateColumns: 'none'
                          }}
                        >
                          {/* Asignatura */}
                          <div>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Asignatura</label>
                            <input 
                              type="text" 
                              placeholder="Ej: Álgebra" 
                              value={cls.title}
                              onChange={(e) => {
                                const newSched = [...tempSchedule];
                                newSched[idx].title = e.target.value;
                                setTempSchedule(newSched);
                              }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none' }}
                            />
                          </div>
                          
                          {/* Día Select */}
                          <div>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Día</label>
                            <select 
                              value={cls.day}
                              onChange={(e) => {
                                const newSched = [...tempSchedule];
                                newSched[idx].day = parseInt(e.target.value);
                                setTempSchedule(newSched);
                              }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg)', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                            >
                              <option value={0}>Lunes</option>
                              <option value={1}>Martes</option>
                              <option value={2}>Miércoles</option>
                              <option value={3}>Jueves</option>
                              <option value={4}>Viernes</option>
                              <option value={5}>Sábado</option>
                              <option value={6}>Domingo</option>
                            </select>
                          </div>

                          {/* Hora Inicio y Fin */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Inicio</label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <input 
                                  type="number" min="0" max="23" placeholder="HH"
                                  value={cls.startH}
                                  onChange={(e) => {
                                    const newSched = [...tempSchedule];
                                    newSched[idx].startH = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                                    setTempSchedule(newSched);
                                  }}
                                  style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)', color: 'var(--text-main)', fontSize: '0.8rem', textAlign: 'center', outline: 'none' }}
                                />
                                <span style={{ fontWeight: 'bold' }}>:</span>
                                <input 
                                  type="number" min="0" max="59" placeholder="MM"
                                  value={cls.startM}
                                  onChange={(e) => {
                                    const newSched = [...tempSchedule];
                                    newSched[idx].startM = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                    setTempSchedule(newSched);
                                  }}
                                  style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)', color: 'var(--text-main)', fontSize: '0.8rem', textAlign: 'center', outline: 'none' }}
                                />
                              </div>
                            </div>

                            <div>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Fin</label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <input 
                                  type="number" min="0" max="23" placeholder="HH"
                                  value={cls.endH}
                                  onChange={(e) => {
                                    const newSched = [...tempSchedule];
                                    newSched[idx].endH = Math.max(0, Math.min(23, parseInt(e.target.value) || 0));
                                    setTempSchedule(newSched);
                                  }}
                                  style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)', color: 'var(--text-main)', fontSize: '0.8rem', textAlign: 'center', outline: 'none' }}
                                />
                                <span style={{ fontWeight: 'bold' }}>:</span>
                                <input 
                                  type="number" min="0" max="59" placeholder="MM"
                                  value={cls.endM}
                                  onChange={(e) => {
                                    const newSched = [...tempSchedule];
                                    newSched[idx].endM = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                    setTempSchedule(newSched);
                                  }}
                                  style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)', color: 'var(--text-main)', fontSize: '0.8rem', textAlign: 'center', outline: 'none' }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Color Picker */}
                          <div>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>🎨 Color</label>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {COLOR_PALETTE.map((c) => {
                                const isSelected = colorType === c.type;
                                return (
                                  <button
                                    key={c.type}
                                    onClick={() => {
                                      const newSched = [...tempSchedule];
                                      newSched[idx].type = c.type;
                                      setTempSchedule(newSched);
                                    }}
                                    title={c.label}
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                      background: c.solid,
                                      border: isSelected ? '2px solid var(--text-main)' : '1px solid rgba(255, 255, 255, 0.15)',
                                      cursor: 'pointer',
                                      transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                                      boxShadow: isSelected ? `0 0 6px ${c.solid}` : 'none',
                                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                      padding: 0,
                                      outline: 'none'
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          {/* Acciones */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '4px' }}>
                            <button 
                              onClick={() => {
                                setTempSchedule(tempSchedule.filter((_, i) => i !== idx));
                              }}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                              title="Eliminar clase"
                            >
                              <Trash2 size={14} /> Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => {
                      setTempSchedule([...tempSchedule, {
                        id: 'block-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                        title: '',
                        day: dayIndex,
                        startH: 8,
                        startM: 15,
                        endH: 9,
                        endM: 35,
                        type: 'cultura'
                      }]);
                    }}
                    className="btn-secondary"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed var(--border-color)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: 600, marginTop: '8px' }}
                  >
                    ➕ Agregar Clase
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* === TIMETABLE VIEW === */
        <div className="timetable-container">
          <div className="time-column">
            <div className="time-header">HORAS</div>
            {predefBlocks && predefBlocks.map((b) => (
              <div key={b.index} className="time-slot" style={{ fontSize: '0.7rem', padding: '0 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {b.start} - {b.end}
              </div>
            ))}
          </div>

          <div className="days-container">
            <div className="days-header">
              <div>LUNES</div><div>MARTES</div><div>MIÉRCOLES</div><div>JUEVES</div><div>VIERNES</div><div>SÁBADO</div><div>DOMINGO</div>
            </div>
            <div className="grid-content" style={{ position: 'relative' }}>
              {isProcessing && (
                <div className="processing-overlay">
                  <Loader2 size={40} className="spinner" />
                  <p>La IA está analizando tu horario y estructurando las clases...</p>
                </div>
              )}
              
              {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                <div key={dayIndex} className="day-track">
                  {effectiveSchedule && effectiveSchedule
                    .filter(cls => cls.day === dayIndex)
                    .map(cls => (
                      <div 
                        key={cls.id} 
                        className={`card ${cls.type} ${cls.isSuspended ? 'suspended' : ''}`} 
                        style={{ 
                          top: cls.top, 
                          height: cls.height,
                          opacity: cls.isSuspended ? 0.5 : 1,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          textAlign: 'center'
                        }}
                        onClick={() => setSelectedClass(cls)}
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
                  {studyBlocks && studyBlocks
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
                        <span style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>Bloque Sugerido</span>
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
                      onClick={enterEditMode}
                      style={{ padding: '10px 20px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', margin: '0 auto', display: 'block' }}
                    >
                      ✏️ Crear Horario Manualmente
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
