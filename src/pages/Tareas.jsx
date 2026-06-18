import { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Loader, BookOpen, Clock, Calendar, Tag, Sparkles, AlignLeft, Pencil, Check } from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';

export default function Tareas() {
  const { effectiveSchedule, studyBlocks, predefBlocks, generateStudyRoutine, isProcessing, clearStudyBlocks, updateStudyBlock, updateClass } = useSchedule();
  const { tasks, isLoading, addTask, updateTaskStatus, updateTask, deleteTask, deleteMultipleTasks } = useTasks();
  const { user } = useAuth();

  const uniqueSubjects = effectiveSchedule ? Array.from(new Set(effectiveSchedule.map(c => c.title))) : [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    tag: 'General',
    deadline: '',
    estimatedTime: 2,
    type: 'Tarea'
  });
  const [editingTask, setEditingTask] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState({
    title: '',
    tag: 'General',
    type: 'Tarea',
    deadline: '',
    estimatedTime: 2,
    status: 'todo'
  });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);

  const [editingStudyBlock, setEditingStudyBlock] = useState(null);
  const [editStudyBlockData, setEditStudyBlockData] = useState({
    day: 0,
    startTime: '08:15',
    endTime: '08:55'
  });

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

    const hours = parseInt(newTaskData.estimatedTime) || 2;

    await addTask(
      newTaskData.title,
      'todo',
      newTaskData.tag,
      newTaskData.deadline,
      hours,
      newTaskData.type,
      1
    );

    setNewTaskData({
      title: '', tag: 'General', deadline: '', estimatedTime: 2, type: 'Tarea'
    });
    setIsModalOpen(false);
    showToast('Evaluación creada.', '✅');
  };

  const handleEditTaskClick = (task) => {
    setEditingTask(task);
    setEditTaskData({
      title: task.title || '',
      tag: task.tag || 'General',
      type: task.type || 'Tarea',
      deadline: task.deadline ? task.deadline.substring(0, 10) : '',
      estimatedTime: task.estimatedTime || 2,
      status: task.status || 'todo'
    });
    setIsEditModalOpen(true);
  };

  const handleEditModalSubmit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    const hours = parseInt(editTaskData.estimatedTime) || 2;

    await updateTask(editingTask.id, {
      title: editTaskData.title,
      tag: editTaskData.tag,
      type: editTaskData.type,
      deadline: editTaskData.deadline || null,
      estimatedTime: hours,
      status: editTaskData.status
    });

    setIsEditModalOpen(false);
    setEditingTask(null);
    showToast('Tarea actualizada correctamente.', '📝');
  };

  const handleEditStudyBlockClick = (block) => {
    setEditingStudyBlock(block);
    setEditStudyBlockData({
      day: block.day,
      startTime: `${block.startH.toString().padStart(2, '0')}:${block.startM.toString().padStart(2, '0')}`,
      endTime: `${block.endH.toString().padStart(2, '0')}:${block.endM.toString().padStart(2, '0')}`
    });
  };

  const handleEditStudyBlockSubmit = (e) => {
    e.preventDefault();
    if (!editingStudyBlock) return;

    const [startH, startM] = editStudyBlockData.startTime.split(':').map(Number);
    const [endH, endM] = editStudyBlockData.endTime.split(':').map(Number);

    updateStudyBlock(editingStudyBlock.id, editStudyBlockData.day, startH, startM, endH, endM);
    setEditingStudyBlock(null);
    // No toast notified here, per user requirement
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
      if (draggedTask) {
        if (draggedTask.status === 'inbox' && status !== 'inbox') {
          handleEditTaskClick({ ...draggedTask, status });
        } else if (draggedTask.status !== status) {
          await updateTaskStatus(draggedTaskId, status);
        }
      }
    }
  };

  const handleScheduleCardDragStart = (e, cardId, cardType) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ cardId, cardType }));
  };

  const handleScheduleCardDrop = (e, dayIndex) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;
    
    try {
      const { cardId, cardType } = JSON.parse(dataStr);
      if (cardType !== 'study') return;
      
      const trackElement = e.currentTarget;
      const rect = trackElement.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      
      const slotIndex = Math.floor(relativeY / 50);
      if (slotIndex < 0 || slotIndex >= predefBlocks.length) return;
      
      const draggedCard = studyBlocks.find(c => c.id === cardId);
      if (!draggedCard) return;
      
      const startIdx = predefBlocks.findIndex(b => b.startH === draggedCard.startH && b.startM === draggedCard.startM);
      const endIdx = predefBlocks.findIndex(b => b.endH === draggedCard.endH && b.endM === draggedCard.endM);
      const slotSpan = (startIdx !== -1 && endIdx !== -1) ? (endIdx - startIdx + 1) : 1;
      
      const newStartIdx = slotIndex;
      const newEndIdx = Math.min(slotIndex + slotSpan - 1, predefBlocks.length - 1);
      
      const newStartH = predefBlocks[newStartIdx].startH;
      const newStartM = predefBlocks[newStartIdx].startM;
      const newEndH = predefBlocks[newEndIdx].endH;
      const newEndM = predefBlocks[newEndIdx].endM;
      
      updateStudyBlock(cardId, dayIndex, newStartH, newStartM, newEndH, newEndM);
      // No toast notification sent here, per user requirement
    } catch (err) {
      console.error("Error on schedule drop:", err);
    }
  };

  const moveTask = async (id, newStatus) => {
    if (!newStatus) return;
    const task = tasks.find(t => t.id === id);
    if (task && task.status === 'inbox' && newStatus !== 'inbox') {
      handleEditTaskClick({ ...task, status: newStatus });
    } else {
      await updateTaskStatus(id, newStatus);
    }
  };

  const getPrevStatus = (status) => {
    if (status === 'todo') return 'inbox';
    if (status === 'in-progress') return 'todo';
    if (status === 'done') return 'in-progress';
    return null;
  };

  const getNextStatus = (status) => {
    if (status === 'inbox') return 'todo';
    if (status === 'todo') return 'in-progress';
    if (status === 'in-progress') return 'done';
    return null;
  };

  const getTasksByStatus = (status) => tasks.filter(t => t.status === status);

  const statusMap = {
    'inbox': 'Bandeja de Entrada',
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
                </div>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <button className="btn-edit-task" onClick={() => handleEditTaskClick(task)}><Pencil size={14} /></button>
                  <button className="btn-delete-task" onClick={() => handleDeleteTask(task.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <p style={{ fontWeight: 600, margin: '8px 0' }}>{task.title}</p>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {task.deadline ? (
                  <span>📅 {new Date(task.deadline).toLocaleDateString()}</span>
                ) : <span>Sin fecha</span>}
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '30vh', gap: '20px', color: 'var(--text-muted)' }}>
              <Loader size={48} className="lucide-spin" />
              <p>Sincronizando tareas desde la nube...</p>
            </div>
          ) : (
            <div className="kanban-board">
              {renderColumn('Bandeja de Entrada', 'inbox', '📥')}
              {renderColumn('Por hacer', 'todo', '📝')}
              {renderColumn('En progreso', 'in-progress', '⏳')}
              {renderColumn('Terminado', 'done', '✅')}
            </div>
          )}
        </div>

        {/* Mitad Inferior: IA Study Planner Schedule */}
        <div className="study-planner-half">
          <div className="study-planner-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3><Calendar size={22} color="var(--primary)" /> Planificación de Estudio IA (Ventanas Libres)</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              {studyBlocks && studyBlocks.length > 0 && (
                <button
                  className="btn-secondary"
                  onClick={clearStudyBlocks}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--text-muted)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', transition: '0.3s', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  Limpiar Planificación
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => generateStudyRoutine(tasks.filter(t => t.status !== 'done'), true)}
                disabled={isProcessing}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', cursor: 'pointer', transition: '0.3s', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {isProcessing ? 'Planificando...' : 'Re-generar Estudio IA'}
              </button>
            </div>
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
                  <div 
                    key={dayIndex} 
                    className="day-track"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleScheduleCardDrop(e, dayIndex)}
                  >
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
                          draggable
                          onDragStart={(e) => handleScheduleCardDragStart(e, cls.id, 'study')}
                          onClick={() => handleEditStudyBlockClick(cls)}
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
                            zIndex: 2,
                            cursor: 'pointer'
                          }}
                          title={`Motivo: ${cls.reason}. Haz clic para editar manualmente.`}
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
                  <input required type="text" className="premium-input" value={newTaskData.title} onChange={e => setNewTaskData(prev => ({ ...prev, title: e.target.value }))} placeholder="Ej: Prueba Cálculo III" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Asignatura</label>
                  <div className="premium-input-wrapper">
                    <BookOpen size={18} className="input-icon" />
                    <select className="premium-input" value={newTaskData.tag} onChange={e => setNewTaskData(prev => ({ ...prev, tag: e.target.value }))}>
                      <option value="General">General</option>
                      {uniqueSubjects.map(subSub => <option key={subSub} value={subSub}>{subSub}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <div className="premium-input-wrapper">
                    <Tag size={18} className="input-icon" />
                    <select className="premium-input" value={newTaskData.type} onChange={e => setNewTaskData(prev => ({ ...prev, type: e.target.value }))}>
                      <option value="Prueba">Prueba</option>
                      <option value="Examen">Examen</option>
                      <option value="Proyecto">Proyecto</option>
                      <option value="Exposición">Exposición</option>
                      <option value="Tarea">Tarea</option>
                      <option value="Lectura">Lectura</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Fecha de Entrega</label>
                  <div className="premium-input-wrapper">
                    <Calendar size={18} className="input-icon" />
                    <input required type="date" className="premium-input" value={newTaskData.deadline} onChange={e => setNewTaskData(prev => ({ ...prev, deadline: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Estudio (Horas)</label>
                  <div className="premium-input-wrapper">
                    <Clock size={18} className="input-icon" />
                    <input required type="number" min="1" max="24" className="premium-input" value={newTaskData.estimatedTime} onChange={e => setNewTaskData(prev => ({ ...prev, estimatedTime: e.target.value }))} />
                  </div>
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

      {isEditModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }}>
          <div className="premium-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)' }}>
              <Sparkles size={24} color="var(--primary)" /> Editar Detalles de la Tarea
            </h3>
            <form onSubmit={handleEditModalSubmit}>
              <div className="form-group-premium">
                <label>Título / Nombre</label>
                <div className="premium-input-wrapper">
                  <AlignLeft size={18} className="input-icon" />
                  <input required type="text" className="premium-input" value={editTaskData.title} onChange={e => setEditTaskData(prev => ({ ...prev, title: e.target.value }))} placeholder="Ej: Resolver guía de ejercicios" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Asignatura</label>
                  <div className="premium-input-wrapper">
                    <BookOpen size={18} className="input-icon" />
                    <select className="premium-input" value={editTaskData.tag} onChange={e => setEditTaskData(prev => ({ ...prev, tag: e.target.value }))}>
                      <option value="General">General</option>
                      {uniqueSubjects.map(subSub => <option key={subSub} value={subSub}>{subSub}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Tipo</label>
                  <div className="premium-input-wrapper">
                    <Tag size={18} className="input-icon" />
                    <select className="premium-input" value={editTaskData.type} onChange={e => setEditTaskData(prev => ({ ...prev, type: e.target.value }))}>
                      <option value="Prueba">Prueba</option>
                      <option value="Examen">Examen</option>
                      <option value="Proyecto">Proyecto</option>
                      <option value="Exposición">Exposición</option>
                      <option value="Tarea">Tarea</option>
                      <option value="Lectura">Lectura</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Fecha de Entrega</label>
                  <div className="premium-input-wrapper">
                    <Calendar size={18} className="input-icon" />
                    <input required type="date" className="premium-input" value={editTaskData.deadline} onChange={e => setEditTaskData(prev => ({ ...prev, deadline: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Estudio (Horas)</label>
                  <div className="premium-input-wrapper">
                    <Clock size={18} className="input-icon" />
                    <input required type="number" min="1" max="24" className="premium-input" value={editTaskData.estimatedTime} onChange={e => setEditTaskData(prev => ({ ...prev, estimatedTime: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="premium-actions">
                <button type="button" className="btn-cancel-premium" onClick={() => { setIsEditModalOpen(false); setEditingTask(null); }}>Cancelar</button>
                <button type="submit" className="btn-submit-premium"><Plus size={18} /> Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingStudyBlock && (
        <div className="modal-overlay" onClick={() => setEditingStudyBlock(null)}>
          <div className="premium-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: '800', marginBottom: '20px', color: 'var(--text-main)' }}>
              <Clock size={24} color="var(--primary)" /> Editar Horario de Bloque de Estudio
            </h3>
            <form onSubmit={handleEditStudyBlockSubmit}>
              <div className="form-group-premium">
                <label>Día de la Semana</label>
                <div className="premium-input-wrapper">
                  <Calendar size={18} className="input-icon" />
                  <select 
                    className="premium-input" 
                    value={editStudyBlockData.day} 
                    onChange={e => setEditStudyBlockData(prev => ({ ...prev, day: Number(e.target.value) }))}
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
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Hora de Inicio</label>
                  <div className="premium-input-wrapper">
                    <Clock size={18} className="input-icon" />
                    <input 
                      type="time" 
                      required 
                      className="premium-input" 
                      value={editStudyBlockData.startTime} 
                      onChange={e => setEditStudyBlockData(prev => ({ ...prev, startTime: e.target.value }))} 
                    />
                  </div>
                </div>
                <div className="form-group-premium" style={{ flex: 1 }}>
                  <label>Hora de Fin</label>
                  <div className="premium-input-wrapper">
                    <Clock size={18} className="input-icon" />
                    <input 
                      type="time" 
                      required 
                      className="premium-input" 
                      value={editStudyBlockData.endTime} 
                      onChange={e => setEditStudyBlockData(prev => ({ ...prev, endTime: e.target.value }))} 
                    />
                  </div>
                </div>
              </div>

              <div className="premium-actions">
                <button type="button" className="btn-cancel-premium" onClick={() => setEditingStudyBlock(null)}>Cancelar</button>
                <button type="submit" className="btn-submit-premium"><Check size={18} /> Guardar Horario</button>
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
