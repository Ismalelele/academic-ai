import { RefreshCw, Upload, Loader2, Trash2, Wand2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';

export default function Horario() {
  const { effectiveSchedule, studyBlocks, predefBlocks, isProcessing, uploadAndProcessImage, clearSchedule, generateStudyRoutine, reportClassSuspension, removeClassSuspension } = useSchedule();
  const { tasks } = useTasks();
  const fileInputRef = useRef(null);
  const [selectedClass, setSelectedClass] = useState(null);

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
  return (
    <main className="main-content">
      <header>
        <div>
          <h1 className="page-title">Mi Horario Semanal</h1>
          <p className="subtitle">Sube tu horario y deja que la IA organice tu rutina diaria</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
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
        </div>
      </header>

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
                
                {/* 7 columnas para los 7 días */}
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
                      <p style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '5px' }}>Aún no has cargado un horario.</p>
                      <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>Sube una foto o PDF para que la IA lo organice por ti.</span>
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

      {selectedClass && (
        <div className="modal-overlay" onClick={() => setSelectedClass(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '15px', color: 'var(--text-main)' }}>Gestión de Clase</h3>
            <p style={{ color: 'var(--text-main)', marginBottom: '10px' }}><strong>Asignatura:</strong> {selectedClass.title}</p>
            <p style={{ color: 'var(--text-main)', marginBottom: '10px' }}><strong>Fecha (esta semana):</strong> {selectedClass.dateString}</p>
            
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
