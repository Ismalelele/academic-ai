import { RefreshCw, Plus, Activity, CheckCircle, Clock, BookOpen, Calendar, MapPin, ArrowRight, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { getWeeklyStudyHours, getHistoricalWeeklyAverage } from '../utils/studyTracker';
import { getSafeLocalStorage } from '../utils/storageSecurity';

const parseGrade = (val) => {
  if (!val) return 0;
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  if (num >= 10 && num <= 70) {
    return num / 10;
  }
  if (num >= 1 && num <= 7) {
    return num;
  }
  return num / 10;
};

const parseManualAverage = (val) => {
  if (!val) return null;
  const num = parseFloat(val);
  if (isNaN(num)) return null;
  if (num >= 10 && num <= 70) {
    return num / 10;
  }
  if (num >= 1 && num <= 7) {
    return num;
  }
  return num / 10;
};

const formatNote = (val) => {
  if (val === '') return '';
  if (val === '0') return '0';
  
  let cleaned = val.replace(/[^0-9]/g, '');
  while (cleaned.length > 2 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.length > 2) {
    cleaned = cleaned.substring(0, 2);
  }
  if (cleaned === '0') {
    return '0';
  }
  while (cleaned.length < 2) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
};

const getNewCursorPos = (originalVal, rawNewVal, formattedVal, selectionStart) => {
  if (selectionStart >= rawNewVal.length) {
    return formattedVal.length;
  }
  if (rawNewVal.length < originalVal.length && selectionStart === rawNewVal.length) {
    return formattedVal.length;
  }
  const digitsFromRight = rawNewVal.length - selectionStart;
  const newPos = formattedVal.length - digitsFromRight;
  return Math.max(0, newPos);
};

export default function Home() {
  const { user } = useAuth();
  const { tasks, addTask, updateTaskStatus, activityLog } = useTasks();
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications();
  const [newTaskInput, setNewTaskInput] = useState('');

  // Calcular métricas de calificaciones (únicamente desde Calificaciones/Boletín)
  const getSubjectAverage = (subjectName) => {
    if (!user) return null;
    const saved = getSafeLocalStorage(`academic_${user.id}_grades_${subjectName}`, user.id, null);
    if (saved) {
      const valid = saved.filter(r => {
        const noteVal = parseGrade(r.note);
        const weightVal = parseFloat(r.weight);
        return r.note !== '' && r.weight !== '' && !isNaN(noteVal) && noteVal >= 1.0 && noteVal <= 7.0 && !isNaN(weightVal);
      });
      if (valid.length > 0) {
        const wSum = valid.reduce((sum, r) => sum + (parseGrade(r.note) * parseFloat(r.weight)), 0);
        const tWeight = valid.reduce((sum, r) => sum + parseFloat(r.weight), 0);
        if (tWeight > 0) {
          return { avg: wSum / tWeight, isDetailed: true };
        }
      }
    }
    return null;
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
    await addTask(newTaskInput, 'inbox', 'General', null, 2, 'Tarea', 1);
    setNewTaskInput('');
  };

  const { effectiveSchedule, studyBlocks } = useSchedule();

  const subjects = effectiveSchedule ? Array.from(new Set(effectiveSchedule.map(c => c.title))) : [];

  // Calculate total count of detailed grades in the system
  const getTotalDetailedGradesCount = () => {
    if (!user || !subjects || subjects.length === 0) return 0;
    let count = 0;
    subjects.forEach(subjectName => {
      const saved = getSafeLocalStorage(`academic_${user.id}_grades_${subjectName}`, user.id, null);
      if (saved) {
        saved.forEach(r => {
          if (r.note && r.weight && !isNaN(parseFloat(r.note)) && !isNaN(parseFloat(r.weight))) {
            count++;
          }
        });
      }
    });
    return count;
  };
  const totalDetailedGradesCount = getTotalDetailedGradesCount();
  let subjectAverages = [];
  subjects.forEach(sub => {
    const data = getSubjectAverage(sub);
    if (data !== null) {
      subjectAverages.push({ subject: sub, average: data.avg, isDetailed: data.isDetailed });
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
    const saved = getSafeLocalStorage(`academic_${user.id}_quiz_stats`, user.id, null);
    if (!saved) return { count: 0, avg: 0 };
    const avg = saved.totalQuestions > 0 ? (saved.totalScore / saved.totalQuestions) * 100 : 0;
    return { count: saved.count, avg };
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

  const weeklyHours = getWeeklyStudyHours(user?.id);
  const totalWeeklyHours = weeklyHours.reduce((sum, h) => sum + h, 0);
  const historicalAverage = getHistoricalWeeklyAverage(user?.id);
  const exceedsAverage = totalWeeklyHours > historicalAverage;
  const chartColor = exceedsAverage ? '#10b981' : 'var(--primary)';
  const chartGradientId = exceedsAverage ? 'chartGradientGreen' : 'chartGradientDefault';

  const studyDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const studyHoursData = studyDays.map((day, idx) => ({
    day,
    hours: weeklyHours[idx]
  }));

  // Concentric Rings calculation
  const p1 = tasks.length > 0 ? (completedTasksCount / tasks.length) * 100 : 0;
  const p2 = Math.min(100, (totalWeeklyHours / 25) * 100); // study goal rate (of 25h)
  const p3 = quizStats.count > 0 ? quizStats.avg : 0;

  const r1 = 70;
  const c1 = 2 * Math.PI * r1;
  const offset1 = c1 - (p1 / 100) * c1;

  const r2 = 50;
  const c2 = 2 * Math.PI * r2;
  const offset2 = c2 - (p2 / 100) * c2;

  const r3 = 30;
  const c3 = 2 * Math.PI * r3;
  const offset3 = c3 - (p3 / 100) * c3;

  // Fetch manually added grades across subjects to show latest 3
  const getLatestGrades = () => {
    if (!user || !subjects || subjects.length === 0) return [];
    const allGrades = [];
    subjects.forEach(subjectName => {
      const saved = getSafeLocalStorage(`academic_${user.id}_grades_${subjectName}`, user.id, null);
      if (saved) {
        saved.forEach(r => {
          const noteVal = parseGrade(r.note);
          if (r.note && r.weight && !isNaN(noteVal) && noteVal >= 1.0 && noteVal <= 7.0 && !isNaN(parseFloat(r.weight))) {
            allGrades.push({
              subject: subjectName,
              note: noteVal,
              weight: parseFloat(r.weight),
              timestamp: isNaN(parseInt(r.id)) || parseInt(r.id) < 1000000000000 ? 0 : parseInt(r.id)
            });
          }
        });
      }
    });
    allGrades.sort((a, b) => b.timestamp - a.timestamp);
    return allGrades.slice(0, 3);
  };

  const maxHours = Math.max(20, Math.ceil(Math.max(...weeklyHours) / 5) * 5);
  const svgWidth = 500;
  const svgHeight = 200;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const points = studyHoursData.map((d, i) => {
    const x = paddingX + i * (chartWidth / (studyHoursData.length - 1));
    const y = svgHeight - paddingY - (d.hours / maxHours) * chartHeight;
    return { x, y, day: d.day, hours: d.hours };
  });

  const linePath = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : '';

  return (
    <main className="main-content">
      <header>
        <div>
          <h1 className="page-title">Gestión Académica</h1>
          <p className="subtitle">Tu panel de control académico inteligente</p>
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

          {/* KPIs Grid */}
          <div className="kpis-grid">
            {/* KPI 1: Study hours line chart */}
            <div className="kpi-card chart-card">
              <div className="kpi-card-header">
                <div>
                  <h3>Horas de estudio</h3>
                  <p className="kpi-subtitle">
                    {exceedsAverage ? (
                      <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                        ¡Superaste tu media! Tu enfoque esta semana ha sido de {totalWeeklyHours.toFixed(1).replace('.', ',')} horas (media: {historicalAverage.toFixed(1).replace('.', ',')}h)
                      </span>
                    ) : (
                      <span>
                        Tu enfoque esta semana ha sido de {totalWeeklyHours.toFixed(1).replace('.', ',')} horas (media: {historicalAverage.toFixed(1).replace('.', ',')}h)
                      </span>
                    )}
                  </p>
                </div>
                <span className="kpi-main-val" style={{ color: chartColor }}>
                  {totalWeeklyHours.toFixed(1).replace('.', ',')}h
                </span>
              </div>
              <div className="kpi-chart-wrapper">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="chartGradientDefault" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="chartGradientGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  {[0, 0.5, 1].map((ratio, index) => {
                    const y = paddingY + ratio * chartHeight;
                    const value = Math.round(maxHours * (1 - ratio));
                    return (
                      <g key={index}>
                        <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="var(--text-main)" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.25" />
                        <text x={paddingX - 10} y={y + 4} textAnchor="end" fill="var(--text-main)" fontSize="11" fontWeight="700">{value}h</text>
                      </g>
                    );
                  })}

                  {/* Area under the line */}
                  <path d={areaPath} fill={`url(#${chartGradientId})`} />

                  {/* Line path */}
                  <path d={linePath} fill="none" stroke={chartColor} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Points on the line */}
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="5.5" fill="var(--card-bg)" stroke={chartColor} strokeWidth="3" />
                      {/* Hours value text on top of the dot */}
                      <text x={p.x} y={p.y - 12} textAnchor="middle" fill={chartColor} fontSize="11" fontWeight="800">
                        {p.hours}h
                      </text>
                      {/* Day label */}
                      <text x={p.x} y={svgHeight - 8} textAnchor="middle" fill="var(--text-main)" fontSize="11" fontWeight="700">
                        {p.day}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            {/* KPI 2: Tareas históricas */}
            <div className="kpi-card counter-card" style={{ justifyContent: 'center', gap: '15px' }}>
              <div className="kpi-card-header-simple">
                <h3>Tareas históricas</h3>
              </div>
              <div className="counter-val-container" style={{ margin: '10px 0' }}>
                <span className="counter-val">{tasks.length}</span>
                <p className="counter-desc">Tareas totales registradas</p>
              </div>
            </div>

            {/* KPI 3: Concentric rings */}
            <div className="kpi-card rings-card">
              <div className="kpi-card-header">
                <div>
                  <h3>Tareas completadas</h3>
                  <p className="kpi-subtitle">Meta diaria: 7 d</p>
                </div>
              </div>
              <div className="rings-layout">
                <div className="rings-chart-wrapper">
                  <svg width="130" height="130" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
                    {/* Background rings */}
                    <circle cx="100" cy="100" r={r1} fill="none" stroke="var(--border-color)" strokeWidth="14" opacity="0.25" />
                    <circle cx="100" cy="100" r={r2} fill="none" stroke="var(--border-color)" strokeWidth="14" opacity="0.25" />
                    <circle cx="100" cy="100" r={r3} fill="none" stroke="var(--border-color)" strokeWidth="14" opacity="0.25" />

                    {/* Progress rings */}
                    {/* Outer: Tasks */}
                    <circle 
                      cx="100" 
                      cy="100" 
                      r={r1} 
                      fill="none" 
                      stroke="#22c55e" 
                      strokeWidth="14" 
                      strokeLinecap="round"
                      strokeDasharray={c1}
                      strokeDashoffset={offset1}
                      style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                    />
                    {/* Middle: Study */}
                    <circle 
                      cx="100" 
                      cy="100" 
                      r={r2} 
                      fill="none" 
                      stroke="#06b6d4" 
                      strokeWidth="14" 
                      strokeLinecap="round"
                      strokeDasharray={c2}
                      strokeDashoffset={offset2}
                      style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                    />
                    {/* Inner: Quizzes */}
                    <circle 
                      cx="100" 
                      cy="100" 
                      r={r3} 
                      fill="none" 
                      stroke="#f59e0b" 
                      strokeWidth="14" 
                      strokeLinecap="round"
                      strokeDasharray={c3}
                      strokeDashoffset={offset3}
                      style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                    />
                  </svg>
                </div>
                <div className="rings-legend">
                  <div className="legend-item green">
                    <span className="dot"></span>
                    <span className="label">Tareas:</span>
                    <span className="val">{completedTasksCount}/{tasks.length} ({Math.round(p1)}%)</span>
                  </div>
                  <div className="legend-item cyan">
                    <span className="dot"></span>
                    <span className="label">Estudio:</span>
                    <span className="val">{totalWeeklyHours.toFixed(1).replace('.', ',')}h/25h ({Math.round(p2)}%)</span>
                  </div>
                  <div className="legend-item orange">
                    <span className="dot"></span>
                    <span className="label">Quizzes:</span>
                    <span className="val">{quizStats.count} hecho{quizStats.count !== 1 ? 's' : ''} ({Math.round(p3)}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Recent Activity & Grade Summary */}
          <div className="dashboard-bottom-row">
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

            {/* Promedio General & Calificaciones Card */}
            <div className="grade-summary-card">
              <div className="grade-summary-header">
                <h3>Rendimiento Académico</h3>
                <p className="kpi-subtitle">Resumen general, calificaciones y promedio general</p>
              </div>

              <div className="grade-summary-layout">
                {/* Columna Izquierda: Últimas Calificaciones */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div className="latest-grades-section">
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Últimas 3 Calificaciones</h4>
                    {getLatestGrades().length === 0 ? (
                      <div className="empty-grades-msg" style={{ fontSize: '0.8rem' }}>
                        No hay notas registradas. Ingresa tus calificaciones en <strong>Académico &gt; Promedio</strong>.
                      </div>
                    ) : (
                      <div className="latest-grades-list">
                        {getLatestGrades().map((grade, index) => (
                          <div key={index} className="latest-grade-item">
                            <span className="grade-subject">📚 {grade.subject}</span>
                            <div className="grade-details-badge">
                              <span className="grade-value">{grade.note.toFixed(1).replace('.', ',')}</span>
                              <span className="grade-weight">({grade.weight}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Columna Derecha: Promedios de Ramos y Promedio General al final */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Mis Promedios por Ramo</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '5px' }}>
                    {subjects.map((sub, index) => {
                      const subjectData = subjectAverages.find(s => s.subject === sub);
                      const displayVal = subjectData
                        ? subjectData.average.toFixed(1).replace('.', ',')
                        : '';
                        
                      return (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                          <span style={{ fontWeight: '700', color: 'var(--text-main)', maxWidth: '75%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sub}>
                            📚 {sub}
                          </span>
                          <span style={{ 
                            fontSize: '0.8rem', 
                            fontWeight: '800', 
                            color: displayVal ? '#10b981' : 'var(--text-muted)',
                            background: displayVal ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.15)',
                            border: displayVal ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            minWidth: '40px',
                            textAlign: 'center'
                          }}>
                            {displayVal || '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Divisor */}
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0 4px 0' }}></div>

                  {/* Promedio General */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: '850', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Promedio General
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span className={`status-badge ${overallAverage >= 5.0 ? 'green' : (overallAverage >= 4.0 ? 'orange' : (overallAverage ? 'red' : 'gray'))}`} style={{ margin: 0 }}>
                        {academicStatus}
                      </span>
                      <div className="promedio-val-container" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span className="promedio-big-val" style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>
                          {overallAverage !== null ? overallAverage.toFixed(1).replace('.', ',') : '—'}
                        </span>
                        <span className="promedio-scale" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>de 7,0</span>
                      </div>
                    </div>
                    {totalDetailedGradesCount <= 1 && (
                      <span style={{ fontSize: '0.72rem', color: '#fb923c', fontWeight: '800', lineHeight: '1.2', marginTop: '2px' }}>
                        ⚠️ Ingrese más notas en el módulo de calificaciones para tener su promedio completo
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
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

              <div style={{ marginTop: '15px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                <div style={{ fontWeight: '800', marginBottom: '6px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  🧠 ¿Dónde hacer quizzes?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Link to="/apuntes" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', padding: '6px 10px', background: 'rgba(14, 165, 233, 0.08)', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.15)', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.15)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.08)'}>
                    📚 Mis Apuntes (Crear desde apuntes)
                  </Link>
                  <Link to="/analisis" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', padding: '6px 10px', background: 'rgba(14, 165, 233, 0.08)', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.15)', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.15)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.08)'}>
                    📄 Análisis (Sube tus archivos PDF/PPTX)
                  </Link>
                  <Link to="/chats" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', padding: '6px 10px', background: 'rgba(14, 165, 233, 0.08)', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.15)', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.15)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(14, 165, 233, 0.08)'}>
                    💬 Chats de Asignaturas (Versus con compañeros)
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
