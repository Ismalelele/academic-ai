import { RefreshCw, Upload, Loader2, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useSchedule } from '../context/ScheduleContext';

export default function Horario() {
  const { schedule, isProcessing, uploadAndProcessImage, clearSchedule } = useSchedule();
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadAndProcessImage(file);
    }
  };
  return (
    <main className="main-content">
      <header>
        <h1>Mi Horario Semanal</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          {schedule && (
            <button className="btn-secondary" onClick={clearSchedule} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', transition: '0.3s' }}>
              <Trash2 size={18} /> Limpiar
            </button>
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
            {isProcessing ? 'Analizando...' : schedule ? 'Subir Nuevo Horario' : 'Cargar Horario (PDF/Img)'}
            {isProcessing ? <Loader2 size={20} className="spinner" /> : <Upload size={20} />}
          </button>
        </div>
      </header>

      <div className="timetable-container">
        <div className="time-column">
            <div className="time-header">HORAS</div>
            {Array.from({ length: 15 }).map((_, i) => {
              const hour = i + 8;
              return (
                <div key={hour} className="time-slot">
                  {hour.toString().padStart(2, '0')}:00
                </div>
              );
            })}
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
                    {schedule && schedule
                      .filter(cls => cls.day === dayIndex)
                      .map(cls => (
                        <div 
                          key={cls.id} 
                          className={`card ${cls.type}`} 
                          style={{ top: cls.top, height: cls.height }}
                        >
                          {cls.title} <br /> <span>{cls.room}</span>
                        </div>
                    ))}
                  </div>
                ))}
                
                {!schedule && !isProcessing && (
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
    </main>
  );
}
