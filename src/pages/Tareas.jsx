import { useState } from 'react';
import { Plus, GripVertical, Trash2, Loader, BookOpen, Clock, Calendar, Tag, Sparkles, AlignLeft } from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';

export default function Tareas() {
  const { effectiveSchedule, studyBlocks, predefBlocks, generateStudyRoutine, isProcessing } = useSchedule();
  const { tasks, isLoading, addTask, updateTaskStatus, deleteTask, deleteMultipleTasks } = useTasks();
  
  const uniqueSubjects = effectiveSchedule ? Array.from(new Set(effectiveSchedule.map(c => c.title))) : [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    tag: 'General',
    deadline: '',
    estimatedTime: 2,
    type: 'Tarea'
  });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);

  const showToast = (message, icon = '✅') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, icon }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!newTaskData.title.trim()) return;
    
    let autoHours = 2;
    switch (newTaskData.type) {
      case 'Prueba': autoHours = 4; break;
      case 'Examen': autoHours = 8; break;
      case 'Proyecto': autoHours = 6; break;
      case 'Exposición': autoHours = 2; break;
      case 'Tarea': autoHours = 2; break;
      case 'Lectura': autoHours = 1; break;
      default: autoHours = 2;
    }
    
    await addTask(
      newTaskData.title, 
      'todo', 
      newTaskData.tag, 
      newTaskData.deadline, 
      autoHours, 
      newTaskData.type, 
      1 
    );
    
    const updatedTasks = [...tasks.filter(t => t.status !== 'done'), {
      title: newTaskData.title,
      status: 'todo',
      tag: newTaskData.tag,
      estimatedTime: autoHours,
      priorityScore: 1 * 20
    }];
    
    setNewTaskData({
      title: '', tag: 'General', deadline: '', estimatedTime: 2, type: 'Tarea'
    });
    setIsModalOpen(false);
    showToast('Evaluación creada y planificada.', '✅');
    
    generateStudyRoutine(updatedTasks);
  };

  const handleDeleteTask = async (id) => {
    const success = await deleteTask(id);
    if (success) {
      setSelectedTaskIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast('Se eliminó 1 tarea.', '🗑️');
    } else {
      showToast('Error al eliminar la tarea.', '❌');
    }
  };

  const toggleSelection = (id) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelectedTasks = async () => {
    const count = selectedTaskIds.size;
    const taskIdsArray = Array.from(selectedTaskIds);
    const success = await deleteMultipleTasks(taskIdsArray);
    if (success) {
      setSelectedTaskIds(new Set());
      showToast(count === 1 ? 'Se eliminó 1 tarea.' : `Se eliminaron ${count} tareas.`, '🗑️');
    } else {
      showToast('Error al eliminar las tareas.', '❌');
    }
  };

  const handleDragStart = (e, id) => {
    setDraggedTaskId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      e.target.classList.add('is-dragging');
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('is-dragging');
    setDraggedTaskId(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const column = e.target.closest('.kanban-column');
    if (column) column.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    const column = e.target.closest('.kanban-column');
    if (column) column.classList.remove('drag-over');
  };

  const handleDrop = async (e, status) => {
    e.preventDefault();
    const column = e.target.closest('.kanban-column');
    if (column) column.classList.remove('drag-over');
    
    if (draggedTaskId) {
      const draggedTask = tasks.find(t => t.id === draggedTaskId);
      if (draggedTask && draggedTask.status !== status) {
        await updateTaskStatus(draggedTaskId, status);
      }
    }
  };

  const moveTask = async (id, newStatus) => {
    if (!newStatus) return;
    await updateTaskStatus(id, newStatus);
  };

  const getPrevStatus = (status) => {
    if (status === 'in-progress') return 'todo';
    if (status === 'done') return 'in-progress';
    return null;
  };

  const getNextStatus = (status) => {
    if (status === 'todo') return 'in-progress';
    if (status === 'in-progress') return 'done';
    return null;
  };

  const getTasksByStatus = (status) => tasks.filter(t => t.status === status);

  const statusMap = {
    'todo': 'Por hacer',
    'in-progress': 'En progreso',
    'done': 'Terminado'
  };

  const renderColumn = (title, status, emoji) => (
    <div 
      className="kanban-column"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e, status)}
    >
      <div className="kanban-column-header">
        <h3>{emoji} {title}</h3>
        <span className="task-count">{getTasksByStatus(status).length}</span>
      </div>
      <div className="kanban-cards-container">
        {getTasksByStatus(status).map(task => (
          <div 
            key={task.id} 
            className={`kanban-card ${selectedTaskIds.has(task.id) ? 'selected' : ''}`}
            draggable
            data-id={task.id}
            onDragStart={(e) => handleDragStart(e, task.id)}
            onDragEnd={handleDragEnd}
          >
            <div className="kanban-card-drag-handle">
              <GripVertical size={16} color="var(--text-muted)" />
            </div>
            
            <div className="kanban-card-checkbox">
              <input 
                type="checkbox" 
                checked={selectedTaskIds.has(task.id)}
                onChange={() => toggleSelection(task.id)}
              />
            </div>

            <div className="kanban-card-content">
              <div className="kanban-card-tags">
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <span className="kanban-tag" style={{ background: 'var(--primary)', color: 'white' }}>{task.tag}</span>
                  <span className="kanban-tag" style={{ background: 'var(--border-color)', color: 'var(--text-main)' }}>{task.type || 'Tarea'}</span>
                  {task.priorityScore > 80 && <span title="Urgente" style={{ fontSize: '1.2rem' }}>🔥</span>}
                  {task.priorityScore > 50 && task.priorityScore <= 80 && <span title="Importante" style={{ fontSize: '1.2rem' }}>🟠</span>}
                  {task.priorityScore <= 50 && <span title="Normal" style={{ fontSize: '1.2rem' }}>🟢</span>}
                </div>
                <button className="btn-delete-task" onClick={() => handleDeleteTask(task.id)}><Trash2 size={14}/></button>
              </div>
              <p style={{ fontWeight: 600, margin: '8px 0' }}>{task.title}</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {task.deadline ? (
                  <span>📅 {new Date(task.deadline).toLocaleDateString()}</span>
                ) : <span>Sin fecha</span>}
                <span>⏱️ {task.estimatedTime || 2}h</span>
              </div>
              
              <div className="mobile-move-actions">
                {getPrevStatus(task.status) && (
                  <button onClick={() => moveTask(task.id, getPrevStatus(task.status))}>
                    &larr; Mover
                  </button>
                )}
                {getNextStatus(task.status) && (
                  <button onClick={() => moveTask(task.id, getNextStatus(task.status))}>
                    Mover &rarr;
                  </button>
                )}
              </div>
        </div>
      </div>
      ))}
      </div>
    </div>
  );

  return (
    <main className="main-content">
      <header className="kanban-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '35px' }}>
        <div>
          <h1 className="page-title">Gestor de Evaluaciones</h1>
          <p className="subtitle">Planifica tus entregas y exámenes con IA</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedTaskIds.size > 0 && (
            <div className="bulk-actions">
              <span className="selected-count">
                {selectedTaskIds.size === 1 
                  ? '1 seleccionada' 
                  : `${selectedTaskIds.size} seleccionadas`}
              </span>
              <button className="btn-danger" onClick={handleDeleteSelectedTasks}>
                <Trash2 size={18} /> Eliminar
              </button>
            </div>
          )}
          <button className="btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center' }}>
            <Plus size={18} style={{ marginRight: '5px' }} /> Nueva Evaluación
          </button>
        </div>
      </header>

      <div className="tareas-split-container">
        {/* Mitad Superior: Kanban Board */}
        <div className="kanban-board-half">
          {isLoading ? (
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '30vh', gap: '20px', color: 'var(--text-muted)'}}>
              <Loader size={48} className="lucide-spin" />
              <p>Sincronizando tareas desde la nube...</p>
            </div>
          ) : (
            <div className="kanban-board">
              {renderColumn('Por hacer', 'todo', '📝')}
              {renderColumn('En progreso', 'in-progress', '⏳')}
              {renderColumn('Terminado', 'done', '✅')}
            </div>
          )}
        </div>

        {/* Mitad Inferior: IA Study Planner Schedule */}
        <div className="study-planner-half">
          <div className="study-planner-header">
            <h3><Calendar size={22} color="var(--primary)" /> Planificación de Estudio IA (Ventanas Libres)</h3>
            <button 
              className="btn-secondary" 
              onClick={() => generateStudyRoutine(tasks.filter(t => t.status !== 'done'))} 
              disabled={isProcessing}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', transition: '0.3s', fontSize: '0.85rem', fontWeight: 700 }}
            >
              {isProcessing ? 'Planificando...' : 'Re-generar Estudio IA'}
            </button>
          </div>

          <div className="timetable-container study-planner-grid">
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
                        <Loader size={40} className="spinner" />
                        <p>La IA está planificando tus bloques de estudio en tus ventanas...</p>
                      </div>
                    )}
                    
                    {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => (
                      <div key={dayIndex} className="day-track">
                        {effectiveSchedule && effectiveSchedule
                          .filter(cls => cls.day === dayIndex)
                          .map(cls => (
                            <div 
                              key={cls.id} 
                              className={`card ${cls.type}`} 
                              style={{ 
                                top: cls.top, 
                                height: cls.height,
                                opacity: 0.35,
                                cursor: 'default',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                textAlign: 'center'
                              }}
                            >
                              <span>{cls.title}</span> 
                              <span style={{ fontSize: '0.75rem' }}>{cls.room || ''}</span>
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
                                opacity: 0.95,
                                zIndex: 2
                              }}
                              title={`Motivo: ${cls.reason}`}
                            >
                              <strong>📚 {cls.title}</strong>
                              <span style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600 }}>Estudio IA</span>
                            </div>
                        ))}
                      </div>
                    ))}
                    
                    {!effectiveSchedule && !isProcessing && (
                      <div className="empty-schedule" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', zIndex: 10 }}>
                        <p style={{ fontSize: '1.05rem', fontWeight: '750', color: 'var(--text-main)' }}>Sube tu horario en la sección "Mi Horario" para planificar automáticamente tus estudios.</p>
                      </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="premium-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)' }}>
              <Sparkles size={24} color="var(--primary)" /> Añadir Nueva Evaluación
            </h3>
            <form onSubmit={handleModalSubmit}>
              <div className="form-group-premium">
                <label>Título / Nombre</label>
                <div className="premium-input-wrapper">
                  <AlignLeft size={18} className="input-icon" />
                  <input required type="text" className="premium-input" value={newTaskData.title} onChange={e => setNewTaskData(prev => ({...prev, title: e.target.value}))} placeholder="Ej: Prueba Cálculo III" />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Asignatura</label>
                  <div className="premium-input-wrapper">
                    <BookOpen size={18} className="input-icon" />
                    <select className="premium-input" value={newTaskData.tag} onChange={e => setNewTaskData(prev => ({...prev, tag: e.target.value}))}>
                      <option value="General">General</option>
                      {uniqueSubjects.map(subSub => <option key={subSub} value={subSub}>{subSub}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <div className="premium-input-wrapper">
                    <Tag size={18} className="input-icon" />
                    <select className="premium-input" value={newTaskData.type} onChange={e => setNewTaskData(prev => ({...prev, type: e.target.value}))}>
                      <option value="Prueba">Prueba (Estudio: 4h)</option>
                      <option value="Examen">Examen (Estudio: 8h)</option>
                      <option value="Proyecto">Proyecto (Estudio: 6h)</option>
                      <option value="Exposición">Exposición (Estudio: 2h)</option>
                      <option value="Tarea">Tarea (Estudio: 2h)</option>
                      <option value="Lectura">Lectura (Estudio: 1h)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group-premium">
                <label>Fecha de Entrega</label>
                <div className="premium-input-wrapper">
                  <Calendar size={18} className="input-icon" />
                  <input required type="date" className="premium-input" value={newTaskData.deadline} onChange={e => setNewTaskData(prev => ({...prev, deadline: e.target.value}))} />
                </div>
              </div>

              <div className="premium-actions">
                <button type="button" className="btn-cancel-premium" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-submit-premium"><Plus size={18} /> Guardar Evaluación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className="toast-notification">
              <span style={{ fontSize: '1.2rem' }}>{toast.icon}</span>
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
