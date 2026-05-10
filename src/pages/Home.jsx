import { RefreshCw, Plus, Send, Activity, CheckCircle, Clock, BookOpen, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';

export default function Home() {
  const [tasks, setTasks] = useState([
    { id: 1, name: 'Laboratorio Ciberseguridad', meta: 'Sábado • Lab 6', completed: false },
    { id: 2, name: 'Informe de Innovación', meta: 'Urgente • Proyectos', completed: false },
    { id: 3, name: 'Cargar horario semestre', meta: 'Finalizado', completed: true },
  ]);

  const toggleTask = (id) => {
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const { schedule } = useSchedule();
  const [now, setNow] = useState(new Date());

  // Update clock every minute for dynamic schedule check
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  let currentClass = null;
  let nextClass = null;

  if (schedule) {
    const jsDay = now.getDay();
    const day = jsDay === 0 ? 6 : jsDay - 1; // 0=Lunes...5=Sabado, 6=Domingo
    const timeInMins = now.getHours() * 60 + now.getMinutes();

    const todaysClasses = schedule
      .filter(c => c.day === day)
      .sort((a, b) => (a.startH * 60 + a.startM) - (b.startH * 60 + b.startM));

    for (let i = 0; i < todaysClasses.length; i++) {
      const cls = todaysClasses[i];
      const startMins = cls.startH * 60 + cls.startM;
      const endMins = cls.endH * 60 + cls.endM;

      if (timeInMins >= startMins && timeInMins <= endMins) {
        currentClass = cls;
        nextClass = todaysClasses[i + 1] || null;
        break;
      } else if (timeInMins < startMins) {
        nextClass = cls;
        break;
      }
    }
  }

  // Helper to format time text
  const formatTime = (h, m) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

  return (
    <main className="main-content">
      <header>
        <h1>Gestión Académica VII</h1>
        <button className="btn-primary">Actualizar Datos <RefreshCw size={20} /></button>
      </header>

      <div className="dashboard-grid">
        {/* Main Stats Column */}
        <div className="main-dashboard-content">
          
          {/* Live Classes Widget */}
          <div className="live-classes-widget">
            {!schedule ? (
              <div className="live-classes-empty">
                <Calendar size={32} />
                <p>Aún no has cargado tu horario.</p>
                <span className="subtitle">Sube una foto en la pestaña Horario para que la IA organice tu día.</span>
              </div>
            ) : (
              <div className="live-classes-container">
                <div className={`class-card current ${!currentClass ? 'inactive' : ''}`}>
                  <div className="class-card-header">
                    <span className="badge-live">AHORA</span>
                  </div>
                  {currentClass ? (
                    <>
                      <h3>{currentClass.title}</h3>
                      <div className="class-details">
                        <span className="detail-item"><Clock size={16} /> {formatTime(currentClass.startH, currentClass.startM)} - {formatTime(currentClass.endH, currentClass.endM)}</span>
                        <span className="detail-item"><MapPin size={16} /> {currentClass.room}</span>
                      </div>
                    </>
                  ) : (
                    <div className="free-time">
                      <h3>Tiempo libre</h3>
                      <p>Aprovecha para avanzar en tus tareas.</p>
                    </div>
                  )}
                </div>

                <div className="class-card next">
                  <div className="class-card-header">
                    <span className="badge-next">PRÓXIMA</span>
                  </div>
                  {nextClass ? (
                    <>
                      <h3>{nextClass.title}</h3>
                      <div className="class-details">
                        <span className="detail-item"><Clock size={16} /> {formatTime(nextClass.startH, nextClass.startM)}</span>
                        <span className="detail-item"><MapPin size={16} /> {nextClass.room}</span>
                      </div>
                    </>
                  ) : (
                    <div className="free-time">
                      <h3>No hay más clases hoy</h3>
                      <p>¡Buen trabajo!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon"><Activity size={28} /></div>
              <div className="stat-info">
                <h3>24</h3>
                <p>Conexiones este mes</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><CheckCircle size={28} /></div>
              <div className="stat-info">
                <h3>12</h3>
                <p>Tareas completadas</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Clock size={28} /></div>
              <div className="stat-info">
                <h3>18h</h3>
                <p>Horas de estudio</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><BookOpen size={28} /></div>
              <div className="stat-info">
                <h3>6.5</h3>
                <p>Promedio actual</p>
              </div>
            </div>
          </div>

          <div className="recent-activity">
             <h3>Actividad Reciente</h3>
             
             <div className="activity-item">
                <div className="activity-dot"></div>
                <div className="activity-text">
                   <strong>Asistencia registrada</strong> en Ciberseguridad
                   <span>Hace 2 horas</span>
                </div>
             </div>
             
             <div className="activity-item">
                <div className="activity-dot"></div>
                <div className="activity-text">
                   <strong>Tarea completada:</strong> Cargar horario semestre
                   <span>Ayer a las 18:30</span>
                </div>
             </div>
             
             <div className="activity-item">
                <div className="activity-dot"></div>
                <div className="activity-text">
                   <strong>Nueva notificación</strong> del profesor de Proyectos Colaborativos
                   <span>Hace 2 días</span>
                </div>
             </div>

             <div className="activity-item">
                <div className="activity-dot"></div>
                <div className="activity-text">
                   <strong>Nota agregada:</strong> Evaluación formativa 1 (6.5)
                   <span>Hace 4 días</span>
                </div>
             </div>
          </div>
        </div>

        {/* Widgets Derecha */}
        <div className="side-widgets">
          <section className="todo-card">
            <div className="todo-header">
              <h3>Tareas Pendientes</h3>
              <span className="badge">3 activas</span>
            </div>
            <div className="todo-input-wrapper">
              <input type="text" id="todoInput" placeholder="¿Qué tienes que estudiar?" />
              <button className="add-btn"><Plus size={20} /></button>
            </div>
            <div className="todo-list">
              {tasks.map(task => (
                <div key={task.id} className={`todo-item ${task.completed ? 'completed' : ''}`}>
                  <label className="custom-checkbox">
                    <input 
                      type="checkbox" 
                      checked={task.completed} 
                      onChange={() => toggleTask(task.id)} 
                    />
                    <span className="checkmark"></span>
                  </label>
                  <div className="task-info">
                    <span className="task-name">{task.name}</span>
                    <span className="task-meta">{task.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          <section className="chat-widget">
            <div className="chat-header">Asistente IA</div>
            <div className="chat-body">
              <div className="bubble">Hola Ismael. He organizado tus tareas según la dificultad de los ramos. Tienes 2 urgentes para esta semana.</div>
            </div>
            <div className="chat-footer">
              <input type="text" placeholder="Pregunta algo..." />
              <button><Send size={20} /></button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
