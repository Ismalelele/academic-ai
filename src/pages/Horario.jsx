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
            <div className="time-slot">08:15 - 08:55</div><div className="time-slot">08:56 - 09:35</div>
            <div className="time-slot">09:45 - 10:25</div><div className="time-slot">10:26 - 11:05</div>
            <div className="time-slot">11:15 - 11:55</div><div className="time-slot">11:56 - 12:35</div>
            <div className="time-slot">12:45 - 13:25</div><div className="time-slot">13:26 - 14:05</div>
            <div className="time-slot">14:15 - 14:55</div><div className="time-slot">14:56 - 15:35</div>
            <div className="time-slot">15:45 - 16:25</div><div className="time-slot">16:26 - 17:05</div>
            <div className="time-slot">17:15 - 17:55</div><div className="time-slot">17:56 - 18:35</div>
            <div className="time-slot">18:40 - 19:20</div><div className="time-slot">19:21 - 20:00</div>
            <div className="time-slot">20:51 - 21:30</div><div className="time-slot">21:40 - 22:20</div>
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
                  <div className="empty-schedule">
                    <p>Aún no has cargado un horario.</p>
                    <span>Sube una foto o PDF para que la IA lo organice por ti.</span>
                  </div>
                )}
            </div>
        </div>
      </div>
    </main>
  );
}
