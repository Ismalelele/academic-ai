import { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { useSchedule } from '../context/ScheduleContext';

const initialTasks = [
  { id: '1', title: 'Estudiar para el certamen de Ciberseguridad', status: 'todo', tag: 'Ciberseguridad', priority: 'high' },
  { id: '2', title: 'Entregar informe de Formulación', status: 'in-progress', tag: 'Proyectos', priority: 'medium' },
  { id: '3', title: 'Configurar entorno AWS', status: 'done', tag: 'Laboratorio', priority: 'low' }
];

export default function Tareas() {
  const { schedule } = useSchedule();
  const uniqueSubjects = schedule ? Array.from(new Set(schedule.map(c => c.title))) : [];

  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('kanban_tasks');
    return saved ? JSON.parse(saved) : initialTasks;
  });
  const [newTasks, setNewTasks] = useState({ todo: '', 'in-progress': '', done: '' });
  const [newTasksTags, setNewTasksTags] = useState({ todo: 'General', 'in-progress': 'General', done: 'General' });
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [toast, setToast] = useState({ visible: false, message: '' });

  useEffect(() => {
    localStorage.setItem('kanban_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const handleInputChange = (status, value) => {
    setNewTasks(prev => ({ ...prev, [status]: value }));
  };

  const addTask = (e, status) => {
    e.preventDefault();
    if (!newTasks[status]?.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      title: newTasks[status],
      status: status,
      tag: newTasksTags[status],
      priority: 'low'
    };
    setTasks([...tasks, newTask]);
    setNewTasks(prev => ({ ...prev, [status]: '' }));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showToast('Se eliminó 1 tarea.');
  };

  const toggleSelection = (id) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelectedTasks = () => {
    const count = selectedTaskIds.size;
    setTasks(tasks.filter(t => !selectedTaskIds.has(t.id)));
    setSelectedTaskIds(new Set());
    showToast(`Se eliminaron ${count} tarea${count > 1 ? 's' : ''}.`);
  };

  const handleDragStart = (e, id) => {
    setDraggedTaskId(id);
    // Needed for Firefox drag-and-drop to work
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    // Add visual cue
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

  const getDragAfterElement = (container, y) => {
    const draggableElements = [...container.querySelectorAll('.kanban-card:not(.is-dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    const column = e.target.closest('.kanban-column');
    if (column) column.classList.remove('drag-over');
    
    if (draggedTaskId) {
      const container = column.querySelector('.kanban-cards-container');
      const afterElement = getDragAfterElement(container, e.clientY);
      
      const draggedTask = tasks.find(t => t.id === draggedTaskId);
      if (!draggedTask) return;
      
      const remainingTasks = tasks.filter(t => t.id !== draggedTaskId);
      const updatedTask = { ...draggedTask, status };
      
      if (afterElement == null) {
        setTasks([...remainingTasks, updatedTask]);
      } else {
        const afterTaskId = afterElement.dataset.id;
        const insertIndex = remainingTasks.findIndex(t => t.id === afterTaskId);
        remainingTasks.splice(insertIndex, 0, updatedTask);
        setTasks([...remainingTasks]);
      }
    }
  };

  const moveTask = (id, newStatus) => {
    if (!newStatus) return;
    setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t));
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
                  <span className={`kanban-tag ${task.priority}`}>{task.tag}</span>
                  <span className="kanban-tag" style={{ background: 'var(--border-color)', color: 'var(--text-main)' }}>{statusMap[task.status]}</span>
                </div>
                <button className="btn-delete-task" onClick={() => deleteTask(task.id)}><Trash2 size={14}/></button>
              </div>
              <p>{task.title}</p>
              
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
      <form className="kanban-add-task-form" onSubmit={(e) => addTask(e, status)}>
        <select 
          className="kanban-select"
          value={newTasksTags[status]} 
          onChange={(e) => setNewTasksTags(prev => ({ ...prev, [status]: e.target.value }))}
        >
          <option value="General">General</option>
          {uniqueSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
        </select>
        <input 
          className="kanban-input-inline"
          type="text" 
          placeholder="Añadir tarea..." 
          value={newTasks[status]}
          onChange={(e) => handleInputChange(status, e.target.value)}
          onMouseEnter={(e) => e.target.focus()}
          onMouseLeave={(e) => e.target.blur()}
          onFocus={(e) => e.target.placeholder = ''}
          onBlur={(e) => e.target.placeholder = 'Añadir tarea...'}
        />
        <button type="submit" className="btn-primary btn-add-inline" disabled={!newTasks[status]?.trim()}>
          <Plus size={16} />
        </button>
      </form>
    </div>
  );

  return (
    <main className="main-content">
      <header className="kanban-header">
        <div>
          <h1>Gestor de Tareas</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)', marginTop: '5px' }}>Organiza tu flujo de estudio con metodología Kanban</p>
        </div>
        {selectedTaskIds.size > 0 && (
          <div className="bulk-actions">
            <span className="selected-count">{selectedTaskIds.size} seleccionadas</span>
            <button className="btn-danger" onClick={deleteSelectedTasks}>
              <Trash2 size={18} /> Eliminar
            </button>
          </div>
        )}
      </header>

      <div className="kanban-board">
        {renderColumn('Por hacer', 'todo', '📝')}
        {renderColumn('En progreso', 'in-progress', '⏳')}
        {renderColumn('Terminado', 'done', '✅')}
      </div>

      {toast.visible && (
        <div className="toast-notification">
          {toast.message}
        </div>
      )}
    </main>
  );
}
