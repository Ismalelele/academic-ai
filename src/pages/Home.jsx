import { RefreshCw, Plus, Send, Activity, CheckCircle, Clock, BookOpen, Calendar, MapPin, ArrowRight, BellRing } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';
import { useNotifications } from '../context/NotificationContext';

export default function Home() {
  const { tasks, addTask, updateTaskStatus } = useTasks();
  const { addNotification, dailyAlertTime, setDailyAlertTime } = useNotifications();
  const [newTaskInput, setNewTaskInput] = useState('');

  // Consideramos "completadas" a las tareas en estado "done"
  // Consideramos "activas" a las tareas "todo" y "in-progress"
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const completedTasksCount = tasks.filter(t => t.status === 'done').length;

  const toggleTask = async (id, currentStatus) => {
    // Si estaba "done", al desmarcar la pasamos a "todo"
    // Si NO estaba "done", al marcar la pasamos a "done"
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await updateTaskStatus(id, newStatus);
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    await addTask(newTaskInput, 'todo', 'General', 'low');
    setNewTaskInput('');
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
        <div className="alert-time-widget" style={{
          display: 'flex', 
          alignItems: 'center', 
          gap: '15px', 
          background: 'var(--bg)', 
          padding: '8px 16px', 
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <BellRing size={14} /> Alarma Automática
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Notificar tareas urgentes a las:</span>
          </div>
          <input 
            type="time" 
            value={dailyAlertTime} 
            onChange={(e) => setDailyAlertTime(e.target.value)} 
            style={{ 
              padding: '6px 10px', 
              borderRadius: '8px', 
              border: '2px solid var(--primary)', 
              background: 'transparent', 
              color: 'var(--text-main)', 
              fontFamily: 'inherit',
              fontWeight: 'bold',
              fontSize: '1.1rem',
              cursor: 'pointer'
            }} 
            title="Configurar hora de alerta automática"
          />
        </div>
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
                        <span className="detail-item"><MapPin size={16} /> {currentClass.room || 'Aula Virtual'}</span>
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
                        <span className="detail-item"><MapPin size={16} /> {nextClass.room || 'Aula Virtual'}</span>
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
                <h3>{tasks.length}</h3>
                <p>Tareas históricas</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><CheckCircle size={28} /></div>
              <div className="stat-info">
                <h3>{completedTasksCount}</h3>
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
             
             {tasks.slice(0, 3).map(t => {
               const statusEs = t.status === 'done' ? 'Terminado' : t.status === 'in-progress' ? 'En progreso' : 'Por hacer';
               return (
                 <div key={t.id} className="activity-item">
                    <div className="activity-dot"></div>
                    <div className="activity-text">
                       <strong>Tarea en sistema:</strong> {t.title}
                       <span>Estado: {statusEs}</span>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>

        {/* Widgets Derecha */}
        <div className="side-widgets">
          <section className="todo-card">
            <div className="todo-header">
              <h3>Tareas Pendientes</h3>
              <span className="badge">{activeTasks.length} activas</span>
            </div>
            <form className="todo-input-wrapper" onSubmit={handleQuickAdd}>
              <input 
                type="text" 
                placeholder="¿Qué tienes que estudiar?" 
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
              />
              <button type="submit" className="add-btn"><Plus size={20} /></button>
            </form>
            <div className="todo-list">
              {tasks.map(task => (
                <div key={task.id} className={`todo-item ${task.status === 'done' ? 'completed' : ''}`}>
                  <label className="custom-checkbox">
                    <input 
                      type="checkbox" 
                      checked={task.status === 'done'} 
                      onChange={() => toggleTask(task.id, task.status)} 
                    />
                    <span className="checkmark"></span>
                  </label>
                  <div className="task-info">
                    <span className="task-name">{task.title}</span>
                    <span className="task-meta">{task.tag} • {task.priority === 'high' ? 'Urgente' : 'Normal'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          <section className="chat-widget">
            <div className="chat-header">Asistente IA</div>
            <div className="chat-body">
              <div className="bubble">Hola Ismael. He organizado tus tareas según la dificultad de los ramos. Tienes {activeTasks.filter(t => t.priority === 'high').length} urgentes para esta semana.</div>
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
