import { RefreshCw, Plus, Activity, CheckCircle, Clock, BookOpen, Calendar, MapPin, ArrowRight, BellRing, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const { tasks, addTask, updateTaskStatus, activityLog } = useTasks();
  const { notifications, unreadCount, markAsRead, deleteNotification, dailyAlertTime, setDailyAlertTime } = useNotifications();
  const [newTaskInput, setNewTaskInput] = useState('');

  // Calcular métricas de calificaciones
  const getSubjectAverage = (subjectName) => {
    if (!user) return null;
    const saved = localStorage.getItem(`academic_grades_${user.id}_${subjectName}`);
    if (!saved) return null;
    const rows = JSON.parse(saved);
    const validRows = rows.filter(r => r.note !== '' && r.weight !== '' && !isNaN(parseFloat(r.note)) && !isNaN(parseFloat(r.weight)));
    const totalWeight = validRows.reduce((sum, r) => sum + parseFloat(r.weight), 0);
    const weightedSum = validRows.reduce((sum, r) => sum + (parseFloat(r.note) * parseFloat(r.weight)), 0);
    return totalWeight > 0 ? (weightedSum / totalWeight) : null;
  };

  // Consideramos "completadas" a las tareas en estado "done"
  // Consideramos "activas" a las tareas "todo" y "in-progress"
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const completedTasksCount = tasks.filter(t => t.status === 'done').length;

  const getIconForType = (type) => {
    switch(type) {
      case 'clase': return '📚';
      case 'urgente': return '⚠️';
      case 'tarea': return '📝';
      default: return '💡';
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ' - ' + d.toLocaleDateString();
  };

  const toggleTask = async (id, currentStatus) => {
    // Si estaba "done", al desmarcar la pasamos a "todo"
    // Si NO estaba "done", al marcar la pasamos a "done"
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    await updateTaskStatus(id, newStatus);
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    await addTask(newTaskInput, 'todo', 'General', null, 2, 'Tarea', 1);
    setNewTaskInput('');
  };

  const { effectiveSchedule, studyBlocks } = useSchedule();

  const subjects = effectiveSchedule ? Array.from(new Set(effectiveSchedule.map(c => c.title))) : [];
  let subjectAverages = [];
  subjects.forEach(sub => {
    const avg = getSubjectAverage(sub);
    if (avg !== null) {
      subjectAverages.push({ subject: sub, average: avg });
    }
  });

  const overallAverage = subjectAverages.length > 0
    ? (subjectAverages.reduce((sum, s) => sum + s.average, 0) / subjectAverages.length)
    : null;

  let academicStatus = 'Sin calificaciones';
  if (overallAverage !== null) {
    if (overallAverage >= 5.0) academicStatus = 'Exento de examen';
    else if (overallAverage >= 4.0) academicStatus = 'Rendirá examen (En riesgo)';
    else academicStatus = 'Peligro de reprobación';
  }

  const getQuizStats = () => {
    if (!user) return { count: 0, avg: 0 };
    const saved = localStorage.getItem(`quiz_stats_${user.id}`);
    if (!saved) return { count: 0, avg: 0 };
    const stats = JSON.parse(saved);
    const avg = stats.totalQuestions > 0 ? (stats.totalScore / stats.totalQuestions) * 100 : 0;
    return { count: stats.count, avg };
  };
  const quizStats = getQuizStats();

  const getNextStudyBlock = () => {
    if (!studyBlocks || studyBlocks.length === 0) return null;
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const futureBlocks = studyBlocks.filter(b => {
      if (b.day > currentDay) return true;
      if (b.day === currentDay) {
        const startMins = b.startH * 60 + b.startM;
        return startMins > currentMins;
      }
      return false;
    });

    if (futureBlocks.length === 0) return null;

    futureBlocks.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return (a.startH * 60 + a.startM) - (b.startH * 60 + b.startM);
    });

    return futureBlocks[0];
  };
  const nextStudyBlock = getNextStudyBlock();

  const getDayName = (dayIndex) => {
    const days = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
    return days[dayIndex] || '';
  };

  const formatTime = (h, m) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  const [now, setNow] = useState(new Date());

  // Update clock every minute for dynamic schedule check
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  let currentClass = null;
  let nextClass = null;

  if (effectiveSchedule) {
    const jsDay = now.getDay();
    const day = jsDay === 0 ? 6 : jsDay - 1; // 0=Lunes...5=Sabado, 6=Domingo
    const timeInMins = now.getHours() * 60 + now.getMinutes();

    const todaysClasses = effectiveSchedule
      .filter(c => c.day === day && !c.isSuspended)
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


  return (
    <main className="main-content">
      <header>
        <div>
          <h1 className="page-title">Gestión Académica VII</h1>
          <p className="subtitle">Tu panel de control académico inteligente</p>
        </div>
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
            {!effectiveSchedule ? (
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
                <h3>{overallAverage !== null ? overallAverage.toFixed(1) : '—'}</h3>
                <p>Promedio General</p>
              </div>
            </div>
          </div>

          <div className="recent-activity">
             <h3>Actividad Reciente</h3>
             
             {(!activityLog || activityLog.length === 0) ? (
               <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '10px' }}>No hay actividad reciente.</div>
             ) : (
               activityLog.slice(0, 5).map(log => {
                 const timeAgo = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                 return (
                   <div key={log.id} className="activity-item">
                      <div className="activity-dot" style={log.updated ? { backgroundColor: '#f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.4)' } : {}}></div>
                      <div className="activity-text">
                         <strong>{log.action}:</strong> {log.taskTitle} {log.updated ? <span style={{fontSize: '0.75rem', color: '#f59e0b'}}>(Actualizado)</span> : (log.count > 1 ? `(x${log.count})` : '')}
                         <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '10px' }}>{timeAgo}</span>
                      </div>
                   </div>
                 );
               })
             )}
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
            <div className="todo-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {activeTasks.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px' }}>No tienes tareas pendientes. ¡Buen trabajo!</div>
              )}
              {activeTasks.map(task => (
                <div key={task.id} className="todo-item">
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
          
          {/* Widget 1: Próxima Sesión de Estudio IA */}
          <div className="dashboard-widget-card">
            <div className="dashboard-widget-header">
              <Calendar size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Próxima Sesión de Estudio IA</h3>
            </div>
            <div className="dashboard-widget-content">
              {nextStudyBlock ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    📚 {nextStudyBlock.title}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    ⏱️ {getDayName(nextStudyBlock.day)} ({formatTime(nextStudyBlock.startH, nextStudyBlock.startM)} - {formatTime(nextStudyBlock.endH, nextStudyBlock.endM)})
                  </div>
                  <div style={{ fontSize: '0.8rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--primary)', marginTop: '4px', fontWeight: '600' }}>
                    💡 <em>{nextStudyBlock.reason}</em>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '15px 0' }}>
                  No hay bloques de estudio programados. Agrega evaluaciones en el Gestor de Tareas para auto-planificar.
                </div>
              )}
            </div>
          </div>

          {/* Widget 2: Resumen Académico */}
          <div className="dashboard-widget-card">
            <div className="dashboard-widget-header">
              <BookOpen size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Rendimiento Académico</h3>
            </div>
            <div className="dashboard-widget-content">
              <div className="dashboard-widget-metric" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(0, 0, 0, 0.02)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>PROMEDIO GENERAL</span>
                <span style={{ fontSize: '1.25rem', fontWeight: '850', color: overallAverage >= 4.0 ? '#22c55e' : (overallAverage ? '#ef4444' : 'var(--text-muted)') }}>
                  {overallAverage !== null ? overallAverage.toFixed(2) : '—'}
                </span>
              </div>
              <div className="dashboard-widget-metric" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(0, 0, 0, 0.02)', borderRadius: '10px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>ESTADO</span>
                <span style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: '800', 
                  color: academicStatus === 'Exento de examen' ? '#22c55e' : (academicStatus.includes('examen') ? '#f59e0b' : (academicStatus === 'Sin calificaciones' ? 'var(--text-muted)' : '#ef4444')) 
                }}>
                  {academicStatus}
                </span>
              </div>
              {subjectAverages.length > 0 && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Promedios por Ramo:</span>
                  {subjectAverages.map((sa, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '4px 0', borderBottom: '1px dashed var(--border-color)' }}>
                      <span style={{ fontWeight: '600' }}>{sa.subject}</span>
                      <span style={{ fontWeight: '800', color: sa.average >= 4.0 ? '#22c55e' : '#ef4444' }}>{sa.average.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Widget 3: Rendimiento de Quizzes */}
          <div className="dashboard-widget-card">
            <div className="dashboard-widget-header">
              <Activity size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Estadísticas de Quizzes</h3>
            </div>
            <div className="dashboard-widget-content">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '750', color: 'var(--text-muted)', marginBottom: '5px' }}>REALIZADOS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '850', color: 'var(--text-main)' }}>{quizStats.count}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '750', color: 'var(--text-muted)', marginBottom: '5px' }}>NOTA PROMEDIO</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '850', color: quizStats.avg >= 60 ? '#22c55e' : (quizStats.avg > 0 ? '#ef4444' : 'var(--text-muted)') }}>
                    {quizStats.avg > 0 ? `${quizStats.avg.toFixed(0)}%` : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
