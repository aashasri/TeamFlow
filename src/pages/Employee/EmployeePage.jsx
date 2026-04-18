import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/common/StatCard';
import KanbanBoard from '../../components/features/kanban/KanbanBoard';
import TimerWidget from '../../components/features/timer/TimerWidget';
import CalendarGrid from '../../components/features/calendar/CalendarGrid';
import MeetingList from '../../components/features/meetings/MeetingList';
import NotepadPanel from '../../components/features/notepad/NotepadPanel';
import SocialCalendar from '../../components/features/social/SocialCalendar';
import BlogsSheet from '../../components/features/blogs/BlogsSheet';
import { pushNotif, notifTemplates } from '../../lib/notifications';
import { formatDate, formatDateTime } from '../../lib/dateUtils';

const EmployeePage = ({ activePage }) => {
  const { user } = useAuth();
  const { data, getTasksByUser, updateTaskStatus, updateTask, updateSocialPost, addTask, requestTaskReassignment } = useData();
  const [activeTab, setActiveTab] = useState('tasks');
  const [activeTask, setActiveTask] = useState(null);
  const [linkInput, setLinkInput] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', desc: '', priority: 'medium', deadline: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevFeedbackRef = useRef({});
  
  // Emergency Reassign State
  const [showReassignForm, setShowReassignForm] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [reassignLink, setReassignLink] = useState('');
  const [reassignToId, setReassignToId] = useState('');

  const isSocialMedia = user?.dept === 'Social Media';
  
  // Initialize link input when task is selected
  useEffect(() => {
    if (activeTask) setLinkInput(activeTask.link || '');
  }, [activeTask?.id]);

  // Watch for new manager remarks and fire notification
  useEffect(() => {
    const myTasks = getTasksByUser(user?.userId);
    myTasks.forEach(t => {
      const prev = prevFeedbackRef.current[t.id];
      if (t.feedback && t.feedback !== prev) {
        if (prev !== undefined) {
          pushNotif(notifTemplates.remarkAdded(t.title, t.feedback));
        }
        prevFeedbackRef.current[t.id] = t.feedback;
      } else if (!prev) {
        prevFeedbackRef.current[t.id] = t.feedback || '';
      }
    });
  }, [data.tasks]);

  const handleUpdateStatus = async (status) => {
    if (!activeTask) return;
    const patch = { status };
    if (status === 'done') patch.completedAt = new Date().toISOString();
    
    // updateTaskStatus handles the API push, local state patching, and notifications simultaneously inside DataContext
    await updateTaskStatus(activeTask.id, status, user?.name);
    
    setActiveTask(prev => ({ ...prev, ...patch }));
  };

  const handleSaveLink = async () => {
    if (!activeTask) return;
    setIsSubmitting(true);
    try {
      const { error } = await updateTask(activeTask.id, { link: linkInput });
      if (error) throw error;

      // If Social Media dept, update the matching social post link
      if (isSocialMedia && activeTask.clientId) {
        const matchingPost = (data.socialPosts || []).find(p =>
          p.clientId === activeTask.clientId &&
          (p.contentTheme?.toLowerCase().includes(activeTask.title.toLowerCase().slice(0,6)) || p.clientId === activeTask.clientId)
        );
        if (matchingPost) {
          const updatedLinks = { ...(matchingPost.links || {}), instagram: linkInput };
          await updateSocialPost(matchingPost.id, { links: updatedLinks, status: 'Published' });
          pushNotif(notifTemplates.socialLinkPosted(matchingPost.contentTheme || activeTask.title));
        }
      }
      setActiveTask(prev => ({ ...prev, link: linkInput }));
      setLinkInput(''); // Reset after success
      pushNotif({
        title: '✅ Link Submitted',
        body: `Your link for "${activeTask.title}" has been shared with the manager.`,
        icon: '✅'
      });
    } catch (err) {
      alert('❌ Failed to save link: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmergencyReassign = async () => {
    if (!activeTask) return;
    if (!reassignReason.trim() || !reassignLink.trim() || !reassignToId) {
      return alert("Reason, Link, and Reassign To fields are all required.");
    }
    
    setIsSubmitting(true);
    const targetUser = (data.users || []).find(u => u.id === reassignToId);

    try {
      const { error } = await requestTaskReassignment(activeTask.id, reassignReason, reassignLink, targetUser, user?.name);
      if (error) throw error;
      
      pushNotif({
        title: targetUser ? '🚨 Task Reassigned' : '🚨 Emergency Reassign Requested',
        body: targetUser ? `You have reassigned "${activeTask.title}" to ${targetUser.name}.` : `Your request for "${activeTask.title}" has been sent to the managers.`,
        icon: '🚨'
      });
      
      setShowReassignForm(false);
      setReassignReason('');
      setReassignLink('');
      setReassignToId('');
      // Optionally close the task
      setActiveTask(null);
    } catch (err) {
      alert('❌ Failed to request reassignment: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim() || !newTask.deadline) return alert('Title and Deadline are required');
    
    setIsSubmitting(true);
    try {
      const taskData = {
        ...newTask,
        assignedTo: user.userId,
        assignedName: user.name,
        dept: user.dept,
        status: 'todo',
        selfAssigned: true,
      };
      const { error } = await addTask(taskData);
      if (error) throw error;
      
      // Mark as self-assigned
      // Since addTask generates the id, we update the latest task
      const managers = (data.users || []).filter(u => u.role === 'manager');
      managers.forEach(m => {
        pushNotif(notifTemplates.taskStatusUpdate(newTask.title, 'Created', user.name, m.id));
      });
      
      setShowAddModal(false);
      setNewTask({ title: '', desc: '', priority: 'medium', deadline: '' });
      pushNotif({
        title: '✅ Task Created',
        body: `"${newTask.title}" has been created and assigned to you.`,
        icon: '✅'
      });
    } catch (err) {
      alert('❌ Failed to create task: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (activePage === 'dashboard' || activePage === 'tasks') setActiveTab('tasks');
    else if (activePage && activePage.startsWith('tasks-')) setActiveTab('tasks');
    else if (['calendar', 'meetings', 'capacity', 'social-cal', 'blogs-sheet'].includes(activePage)) setActiveTab(activePage);
  }, [activePage]);

  const employeeTasks = getTasksByUser(user?.userId);
  const doneTasks = employeeTasks.filter(t => t.status === 'done');
  const reviewTasks = employeeTasks.filter(t => t.status === 'review');
  const todoTasks = employeeTasks.filter(t => t.status === 'todo');
  const pendingTasks = employeeTasks.filter(t => t.status === 'inprogress');
  const notDone = employeeTasks.filter(t => t.status !== 'done');

  const todayStr = new Date().toISOString().split('T')[0];
  const myDayTasks = notDone.filter(t => t.deadline === todayStr || t.priority === 'high');
  const overdueCount = notDone.filter(t => t.deadline && t.deadline < todayStr).length;
  const secondsLoggedTotal = employeeTasks.reduce((acc, t) => acc + (t.loggedSeconds || 0), 0);
  const hoursLogged = Math.floor(secondsLoggedTotal / 3600);
  const minsLogged = Math.floor((secondsLoggedTotal % 3600) / 60);

  // Performance stats
  const thisWeekStart = new Date(); thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
  const completedThisWeek = doneTasks.filter(t => t.completedAt && new Date(t.completedAt) >= thisWeekStart).length;
  const completionRate = employeeTasks.length ? Math.round((doneTasks.length / employeeTasks.length) * 100) : 0;
  const avgSecsPerTask = doneTasks.length ? Math.round(secondsLoggedTotal / doneTasks.length) : 0;

  // Task detail: active task live-synced data
  const liveTask = activeTask ? (data.tasks.find(t => t.id === activeTask.id) || activeTask) : null;

  return (
    <div className="page-content">
      {/* Employee Task Creation Modal */}
      {showAddModal && (
        <div className="modal-overlay anim-fade-in" style={{ backgroundColor: 'rgba(5,6,12,0.94)', backdropFilter: 'blur(14px)' }}>
          <div className="modal-content" style={{ width: 480 }}>
            <div className="card" style={{ background: '#161829', padding: 30, borderRadius: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#fff', marginBottom: 20 }}>Create New Task</div>
              <form onSubmit={handleCreateTask}>
                <div className="form-group mb16">
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8890b0', marginBottom: 6, display: 'block' }}>Task Title *</label>
                  <input className="tf-input h44" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} placeholder="What are you working on?" required />
                </div>
                <div className="form-group mb16">
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8890b0', marginBottom: 6, display: 'block' }}>Description</label>
                  <textarea className="tf-input" rows="3" value={newTask.desc} onChange={e => setNewTask({...newTask, desc: e.target.value})} placeholder="Briefly describe the task..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8890b0', marginBottom: 6, display: 'block' }}>Priority</label>
                    <select className="tf-input h44" value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8890b0', marginBottom: 6, display: 'block' }}>Deadline *</label>
                    <input type="date" className="tf-input h44" value={newTask.deadline} onChange={e => setNewTask({...newTask, deadline: e.target.value})} required />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn" style={{ flex: 1, background: '#7c3aed' }} disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn" style={{ background: '#7c3aed', padding: '8px 20px', fontSize: '0.85rem' }} onClick={() => setShowAddModal(true)}>
          ＋ Create My Task
        </button>
      </div>

      <div className="tab-content" style={{ display: 'block' }}>
        {activeTab === 'tasks' && (
          !activeTask ? (
            <div className="anim-fade-in">
              {/* Restored Stat Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div className="card" style={{ padding: 16, borderLeft: '4px solid #818cf8', background: 'var(--bg3)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#8890b0', fontWeight: 700, textTransform: 'uppercase' }}>To Do</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', marginTop: 4 }}>{todoTasks.length}</div>
                </div>
                <div className="card" style={{ padding: 16, borderLeft: '4px solid #f59e0b', background: 'var(--bg3)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#8890b0', fontWeight: 700, textTransform: 'uppercase' }}>In Progress</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', marginTop: 4 }}>{pendingTasks.length}</div>
                </div>
                <div className="card" style={{ padding: 16, borderLeft: '4px solid #10b981', background: 'var(--bg3)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#8890b0', fontWeight: 700, textTransform: 'uppercase' }}>Completed</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', marginTop: 4 }}>{doneTasks.length}</div>
                </div>
              </div>

              <div className="grid-2-1">
              <div className="section-wrap">
                {/* My Day Priority View */}
                {myDayTasks.length > 0 && (
                  <div className="card mb20" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(59,130,246,0.1))', border: '1px solid rgba(124,58,237,0.3)' }}>
                    <div className="card-title" style={{ color: '#a78bfa' }}>My Day: Priority Inbox</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                      {myDayTasks.map(task => (
                        <div key={'md-'+task.id} className="task-card" onClick={() => setActiveTask(task)} style={{ margin: 0, padding: '12px 16px', background: 'var(--bg3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="tc-title" style={{ fontSize: '0.88rem' }}>{task.title}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: '0.72rem' }}>
                            <span style={{ color: task.priority === 'high' ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>{task.priority.toUpperCase()}</span>
                            <span style={{ color: '#8890b0' }}>{formatDate(task.deadline)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* KanbanBoard now accepts an active filter to isolate columns when clicked from the sidebar */}
                <KanbanBoard tasks={employeeTasks} onTaskClick={setActiveTask} viewFilter={activePage && activePage.startsWith('tasks-') ? activePage.replace('tasks-', '') : 'all'} />
              </div>

              {/* Sidebar: Schedule + Remarks + Performance */}
              <div className="section-wrap">
                {/* Today's Schedule */}
                <div className="card mb20 anim-fade-in">
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 16 }}>Today's Schedule Tracker</div>
                  <div style={{ borderLeft: '2px solid rgba(255,255,255,0.08)', marginLeft: 8, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {myDayTasks.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: '#8890b0' }}>No tasks scheduled for today.</div>
                    ) : myDayTasks.map(t => (
                      <div key={'tl-'+t.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setActiveTask(t)}>
                        <div style={{ position: 'absolute', width: 10, height: 10, borderRadius: '50%', background: t.status === 'done' ? '#10b981' : (t.status === 'inprogress' ? '#f59e0b' : '#7c3aed'), left: -22, top: 4 }} />
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: t.status === 'done' ? '#10b981' : '#fff' }}>{t.title}</div>
                        <div style={{ fontSize: '0.72rem', color: '#8890b0', marginTop: 2 }}>
                          {t.status === 'done' ? '✓ Done ' + (t.completedAt ? new Date(t.completedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '') : t.status === 'inprogress' ? 'Working...' : 'Scheduled'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance Tracker */}
                <div className="card mb20">
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 14 }}>My Performance</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 6 }}>
                        <span style={{ color: '#8890b0' }}>Completion Rate</span>
                        <span style={{ fontWeight: 700, color: completionRate >= 70 ? '#10b981' : '#f59e0b' }}>{completionRate}%</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
                        <div style={{ height: '100%', width: `${completionRate}%`, background: completionRate >= 70 ? '#10b981' : '#f59e0b', borderRadius: 99, transition: 'width 0.6s' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#8890b0' }}>Done this week</span><span style={{ fontWeight: 700, color: '#818cf8' }}>{completedThisWeek} tasks</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#8890b0' }}>Avg time / task</span><span style={{ fontWeight: 700, color: '#0ea5e9' }}>{Math.floor(avgSecsPerTask/3600)}h {Math.floor((avgSecsPerTask%3600)/60)}m</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                      <span style={{ color: '#8890b0' }}>Total time logged</span><span style={{ fontWeight: 700, color: '#7c3aed' }}>{hoursLogged}h {minsLogged}m</span>
                    </div>
                  </div>
                </div>

                {/* Manager Remarks */}
                <div className="card">
                  <div className="card-title">Manager Remarks</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {employeeTasks.filter(t => t.feedback).slice(0, 4).map(t => (
                      <div key={'msg-'+t.id} onClick={() => setActiveTask(t)} style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, cursor: 'pointer', borderLeft: '3px solid #f59e0b' }}>
                        <div style={{ color: '#8890b0', marginBottom: 4 }}>On <strong style={{ color: '#fff' }}>{t.title}</strong>:</div>
                        <div style={{ color: '#fff', fontStyle: 'italic' }}>"{t.feedback}"</div>
                      </div>
                    ))}
                    {employeeTasks.filter(t => t.feedback).length === 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#8890b0', fontStyle: 'italic' }}>No remarks yet.</div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </div>
          ) : (
            // ── Full Page Task Detail ──
            <div className="anim-fade-in" style={{ padding: '0 10px' }}>
              <button className="btn btn-ghost" onClick={() => { setActiveTask(null); setLinkInput(''); }} style={{ marginBottom: 20 }}>← Back to Dashboard</button>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'flex-start' }}>
                <div className="card" style={{ padding: 32 }}>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 6, fontWeight: 800, background: 'rgba(124,58,237,0.15)', color: '#b593fa' }}>{liveTask?.dept}</span>
                    <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 6, fontWeight: 800, background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>Priority: {liveTask?.priority}</span>
                    {liveTask?.clientId && (() => { const cl = data.clients?.find(c => c.id === liveTask.clientId); return cl ? <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: 6, fontWeight: 800, background: 'rgba(14,165,233,0.15)', color: '#7dd3fc' }}>{cl.name}</span> : null; })()}
                  </div>

                  <div style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: 8, color: '#fff', lineHeight: 1.2 }}>
                    {liveTask?.title}
                    {liveTask?.selfAssigned && <span style={{ marginLeft: 10, fontSize: '0.65rem', padding: '3px 10px', borderRadius: 99, background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', fontWeight: 700, verticalAlign: 'middle' }}>Self Task</span>}
                  </div>

                  {/* Meta row */}
                  <div style={{ display: 'flex', gap: 20, marginBottom: 24, fontSize: '0.82rem', color: '#8890b0', flexWrap: 'wrap' }}>
                    <div><strong>Deadline:</strong> {formatDate(liveTask?.deadline)}</div>
                    <div><strong>Time Logged:</strong> {Math.floor((liveTask?.loggedSeconds||0)/3600)}h {Math.floor(((liveTask?.loggedSeconds||0)%3600)/60)}m</div>
                    {liveTask?.completedAt && <div><strong style={{ color: '#10b981' }}>Completed:</strong> {formatDateTime(liveTask.completedAt)}</div>}
                  </div>

                  {/* Status Progress Bar */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: '0.78rem', color: '#8890b0', marginBottom: 8, fontWeight: 600 }}>Task Progress</div>
                    <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
                      {['todo','inprogress','review','done'].map((s, idx) => {
                        const curStatus = liveTask?.status;
                        const statusOrder = { todo: 0, inprogress: 1, review: 2, approved: 2, done: 3 };
                        const active = curStatus === s || (s === 'review' && curStatus === 'approved');
                        const passed = (statusOrder[curStatus] || 0) > (statusOrder[s] || 0);
                        const colors = { todo: '#818cf8', inprogress: '#f59e0b', review: '#0ea5e9', done: '#10b981' };
                        const labels = { todo: 'To Do', inprogress: 'In Progress', review: 'Review', done: 'Done' };
                        return (
                          <div key={s} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                            <div style={{ height: 6, background: (active || passed) ? colors[s] : 'rgba(255,255,255,0.08)', borderRadius: idx === 0 ? '99px 0 0 99px' : idx === 3 ? '0 99px 99px 0' : 0, transition: 'background 0.4s' }} />
                            <div style={{ fontSize: '0.65rem', marginTop: 5, color: active ? colors[s] : '#8890b0', fontWeight: active ? 800 : 400 }}>{labels[s]}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Description */}
                  <div style={{ background: 'var(--bg3)', padding: '20px', borderRadius: 12, marginBottom: 24, fontSize: '0.95rem', color: '#d1d5db', lineHeight: 1.7, minHeight: 100 }}>
                    {liveTask?.desc || 'No detailed instructions provided.'}
                  </div>

                  {/* Manager's Remark */}
                  {liveTask?.feedback && (
                    <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: 16, marginBottom: 24, background: 'rgba(245,158,11,0.06)', borderRadius: '0 8px 8px 0', padding: '12px 16px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', marginBottom: 6 }}>Manager's Remark</div>
                      <div style={{ fontSize: '0.9rem', color: '#fff', fontStyle: 'italic' }}>"{liveTask.feedback}"</div>
                    </div>
                  )}

                  {/* Approved Banner */}
                  {liveTask?.status === 'approved' && (
                    <div style={{ background: 'linear-gradient(45deg, #10b98122, transparent)', border: '1px solid #10b98144', padding: 16, borderRadius: 12, color: '#10b981', marginBottom: 24, fontWeight: 700 }}>
                      Manager approved this task. You may now proceed with posting!
                    </div>
                  )}

                  {/* Status Buttons */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', marginBottom: 10 }}>Update Task Status</div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {['todo', 'inprogress', 'review', 'done'].map(s => {
                        const displayLabel = s === 'todo' ? 'To Do' : s === 'inprogress' ? 'In Progress' : s === 'review' ? 'Submit for Review' : '✓ Complete';
                        const isActive = liveTask?.status === s;
                        return (
                        <button key={s} onClick={() => handleUpdateStatus(s)}
                          style={{ flex: 1, padding: '12px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', border: isActive ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.1)', background: isActive ? '#7c3aed' : 'var(--bg2)', color: isActive ? '#fff' : '#8890b0' }}>
                          {displayLabel}
                        </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Link Submission (shown when done/approved or social media) */}
                  {(liveTask?.status === 'done' || liveTask?.status === 'approved' || isSocialMedia) && (
                    <div className="anim-fade-in" style={{ padding: 20, background: 'rgba(16,185,129,0.05)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', marginBottom: 10 }}>
                        {isSocialMedia ? 'Post Link (updates Social Calendar)' : 'Submission Link'}
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input className="tf-input h44" style={{ flex: 1, background: '#131524', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.85rem', padding: '0 16px', borderRadius: 8 }}
                          placeholder="Provide result URL..." value={linkInput} onChange={e => setLinkInput(e.target.value)} />
                        <button onClick={handleSaveLink} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0 24px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }} disabled={isSubmitting}>
                          {isSubmitting ? 'Submitting...' : 'Submit Link'}
                        </button>
                      </div>
                      {liveTask?.link && <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: 10, fontWeight: 700 }}>✓ Attached: <a href={liveTask.link} target="_blank" rel="noopener noreferrer" style={{ color: '#10b981' }}>{liveTask.link}</a></div>}
                    </div>
                  )}
                </div>

                {/* Right sidebar: Timer + Action Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <TimerWidget activeTask={liveTask} />
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 10 }}>Action Items</div>
                    <ul style={{ paddingLeft: 20, margin: 0, color: '#8890b0', fontSize: '0.8rem', lineHeight: 1.8 }}>
                      <li>Track time using the timer above</li>
                      <li>Review any manager remarks</li>
                      <li>Mark as Done when complete</li>
                      {isSocialMedia && <li>Submit post link to update Social Calendar</li>}
                    </ul>
                  </div>

                  {/* Emergency Reassign UI */}
                  <div className="card" style={{ padding: 20, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 10, color: '#ef4444' }}>Emergency Reassign</div>
                    {!showReassignForm ? (
                      <button onClick={() => setShowReassignForm(true)} style={{ width: '100%', background: 'transparent', border: '1px dashed rgba(239,68,68,0.4)', color: '#ef4444', padding: '8px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', transition: 'border 0.2s' }} onMouseEnter={e => e.target.style.border = '1px solid #ef4444'} onMouseLeave={e => e.target.style.border = '1px dashed rgba(239,68,68,0.4)'}>
                        🚨 Request Reassignment
                      </button>
                    ) : (
                      <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                         <textarea className="tf-input" rows="2" style={{ background: '#131524', border: '1px solid rgba(239,68,68,0.3)', color: '#fff', fontSize: '0.8rem', padding: '8px', borderRadius: 8, resize: 'none' }} placeholder="Reason for reassign *..." value={reassignReason} onChange={e => setReassignReason(e.target.value)} />
                         <input className="tf-input" style={{ background: '#131524', border: '1px solid rgba(239,68,68,0.3)', color: '#fff', fontSize: '0.8rem', padding: '8px', borderRadius: 8 }} placeholder="Link details *..." value={reassignLink} onChange={e => setReassignLink(e.target.value)} />
                         
                         <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', marginTop: 4 }}>Reassign To *:</label>
                         <select className="tf-input" style={{ background: '#131524', border: '1px solid rgba(239,68,68,0.3)', color: '#fff', fontSize: '0.8rem', padding: '8px', borderRadius: 8 }} value={reassignToId} onChange={e => setReassignToId(e.target.value)}>
                           <option value="" disabled>Select Employee</option>
                           {(data.users || []).filter(u => u.role === 'employee' && u.id !== user?.userId).map(e => (
                             <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>
                           ))}
                         </select>

                         <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                           <button onClick={() => setShowReassignForm(false)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8890b0', padding: '6px', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                           <button onClick={handleEmergencyReassign} disabled={isSubmitting} style={{ flex: 1.5, background: '#ef4444', border: 'none', color: '#fff', padding: '6px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>{isSubmitting ? 'Sending...' : 'Submit Request'}</button>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {activeTab === 'calendar' && <div className="section-wrap anim-fade-in"><CalendarGrid /></div>}
        {activeTab === 'meetings' && <div className="section-wrap anim-fade-in"><MeetingList /></div>}
        {activeTab === 'social-cal' && isSocialMedia && (
          <div className="section-wrap anim-fade-in">
            <SocialCalendar readOnly={false} />
          </div>
        )}
        {activeTab === 'blogs-sheet' && user?.dept === 'Bloog' && (
          <div className="section-wrap anim-fade-in">
            <BlogsSheet />
          </div>
        )}
        {activeTab === 'capacity' && (
          <div className="section-wrap anim-fade-in">
            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 20 }}>My Performance Overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Completion Rate', value: `${completionRate}%`, color: completionRate >= 70 ? '#10b981' : '#f59e0b', icon: '' },
                { label: 'Done This Week', value: completedThisWeek, color: '#818cf8', icon: '' },
                { label: 'Total Completed', value: doneTasks.length, color: '#10b981', icon: '' },
                { label: 'Avg Time / Task', value: `${Math.floor(avgSecsPerTask/3600)}h ${Math.floor((avgSecsPerTask%3600)/60)}m`, color: '#0ea5e9', icon: '' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: '#8890b0', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 16 }}>Task Completion History</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(); d.setDate(d.getDate() - (6 - i));
                  const ds = d.toISOString().split('T')[0];
                  const count = doneTasks.filter(t => t.completedAt?.startsWith(ds)).length;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: '100%', background: '#7c3aed', borderRadius: '4px 4px 0 0', height: `${Math.max(count * 20, 6)}px`, opacity: 0.8, transition: 'height 0.4s' }} />
                      <span style={{ fontSize: '0.6rem', color: '#8890b0' }}>{['SuMoTuWeThFrSa'.slice(i*2,i*2+2)][0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <NotepadPanel />
    </div>
  );
};

export default EmployeePage;
