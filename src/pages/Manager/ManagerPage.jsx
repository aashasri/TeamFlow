import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { validateTaskForm } from '../../lib/validators';
import { taskLimiter } from '../../lib/rateLimiter';
import { pushNotif, notifTemplates } from '../../lib/notifications';
import { DEMO_MODE } from '../../lib/supabase';
import Skeleton, { CardSkeleton, TableSkeleton } from '../../components/common/Skeleton';
import CalendarGrid from '../../components/features/calendar/CalendarGrid';
import MeetingList from '../../components/features/meetings/MeetingList';
import SocialCalendar from '../../components/features/social/SocialCalendar';
import BlogsSheet from '../../components/features/blogs/BlogsSheet';
import AnalyticsPage from './AnalyticsPage';
import CreateCredentialsModal from './CreateCredentialsModal';
import CreateClientModal from './CreateClientModal';

const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'x', 'tiktok', 'gmb', 'pinterest', 'youtube', 'linkedin'];
const SOCIAL_META = {
  instagram: { label: 'Instagram', icon: '', color: '#e1306c' },
  facebook: { label: 'Facebook', icon: '', color: '#1877f2' },
  x: { label: 'X (Twitter)', icon: '', color: '#14171a' },
  tiktok: { label: 'TikTok', icon: '', color: '#010101' },
  gmb: { label: 'GMB', icon: '', color: '#4285f4' },
  pinterest: { label: 'Pinterest', icon: '', color: '#e60023' },
  youtube: { label: 'YouTube', icon: '', color: '#ff0000' },
  linkedin: { label: 'LinkedIn', icon: '', color: '#0a66c2' },
};

const downloadClientReport = (client, tasks, posts) => {
  const lines = [
    `TEAMFLOW — CLIENT REPORT`,
    `Generated: ${new Date().toLocaleString()}`,
    ``,
    `CLIENT: ${client.name}`,
    `PROJECT: ${client.project}`,
    `PROGRESS: ${client.progress}%`,
    `STATUS: ${client.status}`,
    `BUDGET: ${client.budget}`,
    `MANAGER: ${client.manager}`,
    ``,
    `--- TASKS (${tasks.length} total) ---`,
    ...tasks.map(t => `[${t.status.toUpperCase()}] ${t.title} | ${t.dept} | ${t.assignedName} | Due: ${t.deadline || 'N/A'}`),
    ``,
    `--- SOCIAL POSTS (${posts.length} total) ---`,
    ...posts.map(p => `[${p.status}] ${p.contentTheme} | ${p.contentType} | ${p.publishDate || 'No date'}`),
    ``,
    `Completed Tasks: ${tasks.filter(t => t.status === 'done').length}`,
    `In Progress: ${tasks.filter(t => t.status === 'inprogress').length}`,
    `Published Posts: ${posts.filter(p => p.status === 'Published').length}`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${client.name.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.txt`;
  a.click(); URL.revokeObjectURL(url);
};

/* ── Shared badge helpers ── */
const PRIORITY_CFG = {
  high: { bg: '#ef444422', color: '#ef4444', border: '#ef444444', label: 'High' },
  medium: { bg: '#f59e0b22', color: '#f59e0b', border: '#f59e0b44', label: 'Medium' },
  low: { bg: '#10b98122', color: '#10b981', border: '#10b98144', label: 'Low' },
};
const STATUS_CFG = {
  done: { bg: '#10b98122', color: '#10b981', border: '#10b98144', label: '✓ Done' },
  review: { bg: '#0ea5e922', color: '#0ea5e9', border: '#0ea5e944', label: '🔍 For Review' },
  inprogress: { bg: '#f59e0b22', color: '#f59e0b', border: '#f59e0b44', label: '⟳ In Progress' },
  todo: { bg: '#6366f122', color: '#818cf8', border: '#6366f144', label: '• To Do' },
};
const PBadge = ({ priority }) => { const c = PRIORITY_CFG[priority] || PRIORITY_CFG.medium; return <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 99, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{c.label}</span>; };
const SBadge = ({ status }) => { const c = STATUS_CFG[status] || STATUS_CFG.todo; return <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 99, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700 }}>{c.label}</span>; };

const DISC_DEPTS = ['Social Media', 'Ads', 'Content'];
function workingDaysUntil(deadline) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(deadline + 'T00:00:00');
  let count = 0, cur = new Date(today);
  while (cur < end) { if (cur.getDay() !== 0) count++; cur.setDate(cur.getDate() + 1); }
  return count;
}

/* ── Department cards config ── */
const DEPT_CARDS = [
  { name: 'SEO', icon: '', color: '#10b981', emoji: '' },
  { name: 'Social Media', icon: '', color: '#0ea5e9', emoji: '' },
  { name: 'Ads', icon: '', color: '#ef4444', emoji: '' },
  { name: 'Web Dev', icon: '', color: '#f59e0b', emoji: '' },
  { name: 'Bloog', icon: '', color: '#ec4899', emoji: '' },
];

/* ── Main Component ── */
const ManagerPage = ({ activePage, isAssignModalOpen, onCloseModal }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, addTask, updateTask, deleteTask, getWorkloadLevel, addSocialPost, saveClientPageDetails, addClient, deleteClient, deleteMember } = useData();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showCredModal, setShowCredModal] = useState(false);
  const [showPassIds, setShowPassIds] = useState(new Set());
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [showNotepad, setShowNotepad] = useState(false);
  const [notepadText, setNotepadText] = useState('');
  const [addLinkTaskId, setAddLinkTaskId] = useState(null);
  const [linkInput, setLinkInput] = useState('');
  const [budgetCurrency, setBudgetCurrency] = useState('USD');
  const [deptTimeView, setDeptTimeView] = useState('week');
  // Social page credentials editing
  const [editingPage, setEditingPage] = useState(null); // { clientId, platform }
  const [pageForm, setPageForm] = useState({ username: '', password: '', link: '' });
  const [showSocialPass, setShowSocialPass] = useState({});

  const [newTask, setNewTask] = useState({
    title: '', assignedTo: '', priority: 'medium', category: '',
    clientId: '', deadline: '', time: '', desc: '', publishDate: '',
  });
  const [taskErrors, setTaskErrors] = useState({});
  const [deptFilter, setDeptFilter] = useState('all');
  
  const [editSocialLinks, setEditSocialLinks] = useState(false);
  const [socialLinkInput, setSocialLinkInput] = useState({});
  const [showAddClientModal, setShowAddClientModal] = useState(false);

  const handleSaveSocialLinks = async (clientId) => {
    for (const s of Object.keys(socialLinkInput)) {
      // Expecting each key to have { link, username, password }
      await saveClientPageDetails(clientId, s, socialLinkInput[s]);
    }
    setEditSocialLinks(false);
  };
  useEffect(() => {
    const TABS = ['planner', 'tasks', 'clients', 'meetings', 'workload', 'reports', 'assign-task', 'team-access', 'social-cal', 'blogs-sheet'];
    if (activePage === 'dashboard' || activePage === 'overview') {
      setActiveTab('overview'); setSelectedClientId(null); setSelectedDept(null);
    } else if (TABS.includes(activePage)) {
      setActiveTab(activePage);
      if (activePage !== 'clients') setSelectedClientId(null);
      if (activePage !== 'overview') setSelectedDept(null);
    }
  }, [activePage]);

  const employees = data.users.filter(u => u.role === 'employee');
  const clients = data.clients;
  const allMembers = data.users.filter(u => u.role !== 'manager');
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = data.tasks.filter(t => t.deadline === todayStr && t.status !== 'done');
  const pendingTasks = data.tasks.filter(t => t.status === 'inprogress');
  const todoTasks = data.tasks.filter(t => t.status === 'todo');
  const reviewTasks = data.tasks.filter(t => t.status === 'review');
  const doneTasks = data.tasks.filter(t => t.status === 'done');
  const upcomingMeetings = data.meetings.filter(m => new Date(m.date + 'T23:59:59') >= new Date() && m.status !== 'canceled').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  /* ── Disclaimer ── */
  const discApplies = DISC_DEPTS.includes(newTask.category) || DISC_DEPTS.includes(employees.find(e => e.id === newTask.assignedTo)?.dept);
  const daysAway = newTask.deadline ? workingDaysUntil(newTask.deadline) : 999;
  const discViolation = discApplies && newTask.deadline && daysAway < 7;

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const errs = validateTaskForm(newTask);
    if (discViolation) errs.deadline = 'Social Media / Ads / Content tasks need 7 working days notice (excl. Sundays)';

    // Check internal capacity for Social media
    const assignee = data.users.find(u => u.id === newTask.assignedTo);
    const resolvedDept = newTask.category || assignee?.dept || 'General';
    if (resolvedDept === 'Social Media' && newTask.deadline && assignee) {
      const activeSMTasks = data.tasks.filter(t => t.assignedTo === assignee.id && t.deadline === newTask.deadline && t.status !== 'done');
      if (activeSMTasks.length >= 7) {
        errs.assignedTo = `${assignee.name} is already at max capacity (7 active tasks) for ${newTask.deadline}`;
      }
    }

    // Validate publish date for Social Media tasks
    if (resolvedDept === 'Social Media') {
      if (!newTask.publishDate) {
        errs.publishDate = 'Publish date is required for Social Media tasks';
      } else if (newTask.deadline) {
        const diff = Math.floor((new Date(newTask.publishDate) - new Date(newTask.deadline)) / (1000 * 60 * 60 * 24));
        if (diff < 7) {
          errs.publishDate = `Deadline must be at least 7 days before publish date (currently ${diff} days gap)`;
        }
      }
    }

    if (Object.keys(errs).length) { setTaskErrors(errs); return; }
    const rl = taskLimiter.check(user?.userId);
    if (!rl.allowed) { setTaskErrors({ general: `Rate limit: wait ${rl.waitSeconds}s` }); return; }

    // Create base task
    const { error } = await addTask({ ...newTask, assignedTo: newTask.assignedTo, assignedName: assignee.name, dept: resolvedDept, scheduledTime: newTask.time || null });
    if (error) { 
      setTaskErrors({ general: 'Failed to create task: ' + (error.message || 'Check your network connection.') }); 
      return; 
    }
    
    // Auto-create Social Post draft if applicable
    if (resolvedDept === 'Social Media' && newTask.publishDate) {
      if (addSocialPost) {
        await addSocialPost({
          contentType: 'Static post', contentTheme: newTask.title, caption: newTask.desc, owner: assignee.name,
          status: 'Draft', boost: 'NO', budget: '', publishDate: newTask.publishDate, publishTime: newTask.time || '12:00',
          remarks: 'Auto-synced from task assignment', planB: '', postObjective: '', referenceLink: '', assetLink: '',
          clientId: newTask.clientId || null
        });
      }
    }

    setNewTask({ title: '', assignedTo: '', priority: 'medium', category: '', clientId: '', deadline: '', time: '', desc: '', publishDate: '' });
    setTaskErrors({});
    
    // Push floating notification
    pushNotif({ 
      title: 'Task Assigned', 
      body: `"${newTask.title}" has been assigned to ${assignee.name}.`, 
      icon: '📝' 
    });

    if (isAssignModalOpen) onCloseModal(); else navigate('/manager/tasks');
  };

  /* ── Helper: dept stats ── */
  const getDeptStats = (deptName) => {
    const dept = data.departments.find(d => d.name === deptName);
    const tasks = data.tasks.filter(t => t.dept === deptName);
    const done = tasks.filter(t => t.status === 'done').length;
    const members = employees.filter(e => e.dept === deptName);
    return { dept, tasks, done, total: tasks.length, members, pct: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
  };

  /* ── Real bar graph data per dept (week or month) ── */
  const getDeptBarData = useCallback((deptName, view) => {
    const today = new Date();
    const deptTasks = data.tasks.filter(t => t.dept === deptName && t.completedAt);
    if (view === 'week') {
      // Mon to Sun of current week
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday); d.setDate(monday.getDate() + i);
        const ds = d.toISOString().split('T')[0];
        const allDay = data.tasks.filter(t => t.dept === deptName && t.deadline === ds);
        const done = allDay.filter(t => t.status === 'done').length;
        return { label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i], total: allDay.length, done };
      });
    } else {
      // Days in current month
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const allDay = data.tasks.filter(t => t.dept === deptName && t.deadline === ds);
        return { label: String(day), total: allDay.length, done: allDay.filter(t => t.status === 'done').length };
      });
    }
  }, [data.tasks]);

  /* ── Department Drill-down ── */
  const renderDeptView = (deptName) => {
    const { dept, tasks, done, total, members, pct } = getDeptStats(deptName);
    const isSocial = deptName === 'Social Media';
    const deptCfg = DEPT_CARDS.find(d => d.name === deptName) || {};

    return (
      <div className="anim-fade-in">
        <button className="btn btn-ghost" onClick={() => setSelectedDept(null)} style={{ marginBottom: 16, fontSize: '0.82rem' }}>
          ← Back to Dashboard
        </button>

        {/* Dept header */}
        <div className="card" style={{ padding: '24px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 60, height: 60, borderRadius: 14, background: (deptCfg.color || '#7c3aed') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>{deptCfg.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#fff' }}>{deptName} Department</div>
            <div style={{ fontSize: '0.82rem', color: '#8890b0', marginTop: 2 }}>Head: {dept?.head || '—'} · {members.length} member{members.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: deptCfg.color || '#7c3aed' }}>{pct}%</div>
            <div style={{ fontSize: '0.72rem', color: '#8890b0' }}>completion rate</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          {[
            { v: total, l: 'Total Tasks', c: '#7c3aed' },
            { v: done, l: 'Completed', c: '#10b981' },
            { v: tasks.filter(t => t.status === 'inprogress').length, l: 'In Progress', c: '#f59e0b' },
            { v: tasks.filter(t => t.status === 'todo').length, l: 'To Do', c: '#818cf8' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: s.c + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}></div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: '0.72rem', color: '#8890b0' }}>{s.l}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar / Analytics chart - REAL DATA */}
        <div className="card" style={{ padding: '18px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>Department Analytics</span>
              <div style={{ fontSize: '0.72rem', color: '#8890b0', marginTop: 4 }}>Completion Rate: <span style={{ color: deptCfg.color || '#7c3aed', fontWeight: 700 }}>{pct}%</span></div>
            </div>
            <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 8 }}>
              <button onClick={() => setDeptTimeView('week')} style={{ padding: '4px 12px', background: deptTimeView === 'week' ? (deptCfg.color || '#7c3aed') : 'transparent', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>Week</button>
              <button onClick={() => setDeptTimeView('month')} style={{ padding: '4px 12px', background: deptTimeView === 'month' ? (deptCfg.color || '#7c3aed') : 'transparent', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>Month</button>
            </div>
          </div>
          {(() => {
            const bars = getDeptBarData(deptName, deptTimeView);
            const maxTotal = Math.max(...bars.map(b => b.total), 1);
            return (
              <>
                <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: deptTimeView === 'week' ? 10 : 3, paddingBottom: 8 }}>
                  {bars.map((b, i) => (
                    <div key={i} style={{ flex: 1, minWidth: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, height: '100%', justifyContent: 'flex-end' }}>
                      <div title={`${b.done} done / ${b.total} total`} style={{ width: '100%', height: `${Math.max(b.total ? (b.total / maxTotal) * 100 : 5, 5)}%`, background: deptCfg.color || '#7c3aed', opacity: 0.85, borderRadius: '4px 4px 0 0', position: 'relative', transition: 'height 0.4s ease' }}>
                        {b.done > 0 && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(b.done / (b.total || 1)) * 100}%`, background: '#10b981', borderRadius: '4px 4px 0 0', opacity: 0.9 }} />}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#8890b0', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 6 }}>
                  <span>{bars[0]?.label}</span>
                  {deptTimeView === 'week' && bars.slice(1, -1).map((b, i) => <span key={i}>{b.label}</span>)}
                  <span>{bars[bars.length - 1]?.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: '0.68rem' }}>
                  <span style={{ color: deptCfg.color || '#7c3aed' }}>■ Total Tasks</span>
                  <span style={{ color: '#10b981' }}>■ Completed</span>
                </div>
              </>
            );
          })()}
        </div>

        {/* Tasks table */}
        <div className="card" style={{ marginBottom: 20, overflowX: 'auto' }}>
          <div style={{ padding: '16px 20px 0', fontWeight: 800, fontSize: '0.95rem', marginBottom: 12 }}>{deptName} Tasks</div>
          <table className="tf-table">
            <thead><tr><th>TITLE</th><th>ASSIGNED TO</th><th>PRIORITY</th><th>STATUS</th><th>DEADLINE</th></tr></thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{t.title}</td>
                  <td style={{ color: '#8890b0' }}>{t.assignedName}</td>
                  <td><PBadge priority={t.priority} /></td>
                  <td><SBadge status={t.status} /></td>
                  <td style={{ color: '#8890b0', fontSize: '0.82rem' }}>{t.deadline || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Team members */}
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 14 }}>Team Members</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg3)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.color || '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#fff' }}>{m.avatar}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{m.name}</div>
                  <div style={{ fontSize: '0.68rem', color: '#8890b0' }}>{m.email}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Social Media dept: button to go to Social Calendar */}
        {isSocial && (
          <button onClick={() => { setSelectedDept(null); navigate('/manager/social-cal'); }}
            style={{ width: '100%', padding: '14px', borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#7c3aed)', border: 'none', color: '#fff', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Open Social Media Calendar
          </button>
        )}
      </div>
    );
  };

  /* ── Task Detail Modal ── */
  const handleSubmitFeedback = async () => {
    if (!selectedTask || !feedback.trim()) return;
    const { error } = await updateTask(selectedTask.id, { feedback });
    if (!error) {
       pushNotif(notifTemplates.remarkAdded(selectedTask.title, feedback, selectedTask.assignedTo));
       pushNotif({ title: '✅ Remark Saved', body: `Employee ${selectedTask.assignedName} has been notified.`, icon: '✅' });
    }
    setFeedback(''); setSelectedTask(null);
  };

  const getLoginHoursToday = (userId) => {
    const s = data.loginTrack?.[userId] || 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleProceed = async (task) => {
    if (!task) return;
    const { error } = await updateTask(task.id, { status: 'inprogress', feedback });
    if (!error) {
       pushNotif(notifTemplates.proceedConfirmed(task.title, task.assignedTo));
       pushNotif({ title: '🚀 Approval Sent', body: `Employee ${task.assignedName} has been notified to proceed.`, icon: '🚀' });
    } else {
       console.error("Task update error:", error);
    }
    setFeedback(''); setSelectedTask(null);
  };

  const handleCompleteTask = async (task) => {
    if (!task) return;
    const { error } = await updateTask(task.id, { status: 'done', done_at: new Date().toISOString() });
    if (!error) {
       pushNotif(notifTemplates.taskMarkedCompleted(task.title, task.assignedTo));
       pushNotif({ title: '🏁 Task Completed', body: `"${task.title}" has been marked as done.`, icon: '🏁' });
    }
    setFeedback(''); setSelectedTask(null);
  };

  const TaskCard = ({ task }) => (
    <div onClick={() => { setSelectedTask(task); setFeedback(task.feedback || ''); }}
      style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s', marginBottom: 8 }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed55'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>
          {task.title}
          {task.selfAssigned && <span style={{ marginLeft: 6, fontSize: '0.6rem', padding: '2px 7px', borderRadius: 99, background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', fontWeight: 700 }}>Self Task</span>}
        </span>
        <PBadge priority={task.priority} />
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: '0.72rem', color: '#8890b0' }}>
        <span>{task.assignedName}</span>
        <span>·</span>
        <span>{task.deadline || '—'}</span>
      </div>
    </div>
  );

  const TaskContainer = ({ title, icon, color, tasks, count }) => (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{title}</span>
        <span style={{ background: color + '22', color, padding: '2px 8px', borderRadius: 99, fontSize: '0.68rem', fontWeight: 700, marginLeft: 4 }}>{count}</span>
      </div>
      <div className="custom-scrollbar" style={{ background: 'var(--bg2)', borderRadius: 12, padding: 12, border: '1px solid var(--border)', minHeight: 100, maxHeight: 400, overflowY: 'auto' }}>
        {tasks.length === 0 ? <div style={{ color: '#555', fontSize: '0.78rem', textAlign: 'center', paddingTop: 20 }}>No tasks</div> : tasks.map(t => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  );

  /* ── Dashboard Overview ── */
  const renderOverview = () => {
    if (selectedDept) return renderDeptView(selectedDept);
    
    if (loading && data.tasks.length === 0) {
      return (
        <div className="anim-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      );
    }

    return (
      <div className="anim-fade-in">
        {/* Department stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
          {DEPT_CARDS.map(dept => {
            const st = getDeptStats(dept.name);
            return (
              <div key={dept.name} className="card clickable" onClick={() => setSelectedDept(dept.name)}
                style={{ padding: '18px 16px', cursor: 'pointer', borderLeft: `3px solid ${dept.color}`, transition: 'transform 0.15s, box-shadow 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: dept.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}></div>
                  <span style={{ fontSize: '0.68rem', color: '#8890b0' }}>{st.total} tasks</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: 4 }}>{dept.name}</div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${st.pct}%`, background: dept.color, borderRadius: 99, transition: 'width 0.6s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}>
                  <span style={{ color: '#8890b0' }}>{st.done}/{st.total} done</span>
                  <span style={{ color: dept.color, fontWeight: 700 }}>{st.pct}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Task containers: Today/Pending, For Review, To Do, Done */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <TaskContainer title="Today / Pending" color="#f59e0b" tasks={[...todayTasks, ...pendingTasks.filter(t => t.deadline !== todayStr)]} count={todayTasks.length + pendingTasks.filter(t => t.deadline !== todayStr).length} />
          <TaskContainer title="For Review" color="#0ea5e9" tasks={reviewTasks} count={reviewTasks.length} />
          <TaskContainer title="To Do" color="#818cf8" tasks={todoTasks} count={todoTasks.length} />
          <TaskContainer title="Done" color="#10b981" tasks={doneTasks.slice(0, 8)} count={doneTasks.length} />
        </div>

        {/* Client Projects + Upcoming Meetings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: '1rem' }}>Client Projects</span>
            </div>
            {clients.map(c => (
              <div key={c.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div><span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.name}</span><span style={{ fontSize: '0.78rem', color: '#8890b0', marginLeft: 8 }}>{c.project}</span></div>
                  <span style={{ fontWeight: 800, color: c.progress >= 80 ? '#10b981' : c.progress >= 50 ? '#f59e0b' : '#ef4444' }}>{c.progress}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${c.progress}%`, borderRadius: 99, background: c.progress >= 80 ? '#10b981' : c.progress >= 50 ? '#f59e0b' : '#ef4444', transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Upcoming Meetings</span>
            </div>
            {upcomingMeetings.length === 0 ? (
              <div style={{ color: '#8890b0', fontSize: '0.82rem', textAlign: 'center', paddingTop: 20 }}>No upcoming meetings</div>
            ) : upcomingMeetings.map(m => {
              const d = new Date(m.date + 'T00:00:00');
              return (
                <div key={m.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, background: m.type === 'client' ? 'var(--blue)' : 'var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                    <div style={{ fontSize: '1.1rem', lineHeight: 1 }}>{d.getDate()}</div>
                    <div style={{ fontSize: '0.6rem', opacity: 0.8 }}>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff', marginBottom: 2 }}>{m.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#8890b0' }}>{m.time} · {m.attendees.length} attendees</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ── Task Form ── */
  const renderTaskForm = (isModal = false) => (
    <div className="card" style={{ background: '#161829', border: '1px solid rgba(255,255,255,0.08)', padding: 30, borderRadius: 12, position: 'relative' }}>
      {isModal && <button onClick={onCloseModal} style={{ position: 'absolute', top: 18, right: 22, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>}
      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#fff', marginBottom: 24 }}>Assign New Task</div>
      {taskErrors.general && <div className="login-error" style={{ display: 'flex', marginBottom: 16 }}>{taskErrors.general}</div>}
      {discApplies && (
        <div style={{ background: discViolation ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)', border: `1px solid ${discViolation ? '#ef444433' : '#f59e0b33'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.78rem', color: discViolation ? '#ef4444' : '#f59e0b' }}>
          {discViolation ? '⛔ Deadline too soon — Social Media, Ads & Content tasks must be assigned at least 7 working days in advance (Sundays excluded).' : '📌 Reminder: Social Media, Ads & Content tasks require a minimum of 7 working days notice (Sundays excluded).'}
        </div>
      )}
      <form onSubmit={handleCreateTask} noValidate>
        <div className="form-group mb16">
          <label style={lblStyle}>Task Title *</label>
          <input className="tf-input h44" style={{ ...iStyle, borderColor: taskErrors.title ? '#ef4444' : 'rgba(255,255,255,0.08)' }} value={newTask.title} onChange={e => { setNewTask({ ...newTask, title: e.target.value }); setTaskErrors({}); }} placeholder="Assignment subject" />
          {taskErrors.title && <span className="field-error">{taskErrors.title}</span>}
        </div>
        <div className="form-group mb16">
          <label style={lblStyle}>Description *</label>
          <textarea className="tf-input" rows="3" style={{ ...iStyle, borderColor: taskErrors.desc ? '#ef4444' : 'rgba(255,255,255,0.08)', resize: 'none', padding: 10 }} value={newTask.desc} onChange={e => { setNewTask({ ...newTask, desc: e.target.value }); setTaskErrors({}); }} placeholder="Brief instructions…" />
          {taskErrors.desc && <span className="field-error">{taskErrors.desc}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div><label style={lblStyle}>Assign To *</label>
            <select className="tf-input h44" style={{ ...iStyle, borderColor: taskErrors.assignedTo ? '#ef4444' : 'rgba(255,255,255,1)' }} value={newTask.assignedTo} onChange={e => { setNewTask({ ...newTask, assignedTo: e.target.value }); setTaskErrors({}); }}>
              <option value="">Choose member</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>)}
            </select>
            {taskErrors.assignedTo && <span className="field-error">{taskErrors.assignedTo}</span>}
          </div>
          <div><label style={lblStyle}>Client Account *</label>
            <select className="tf-input h44" style={{ ...iStyle, borderColor: taskErrors.clientId ? '#ef4444' : 'rgba(255,255,255,1)' }} value={newTask.clientId} onChange={e => { setNewTask({ ...newTask, clientId: e.target.value }); setTaskErrors({}); }}>
              <option value="">Choose client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {taskErrors.clientId && <span className="field-error">{taskErrors.clientId}</span>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div><label style={lblStyle}>Priority *</label>
            <select className="tf-input h44" style={{ ...iStyle, borderColor: 'rgba(255,255,255,1)' }} value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div><label style={lblStyle}>Deadline *</label>
            <input type="date" className="tf-input h44" style={{ ...iStyle, borderColor: taskErrors.deadline ? '#ef4444' : 'rgba(255,255,255,0.08)' }} value={newTask.deadline} onChange={e => { setNewTask({ ...newTask, deadline: e.target.value }); setTaskErrors({}); }} />
            {taskErrors.deadline && <span className="field-error">{taskErrors.deadline}</span>}
          </div>
          <div><label style={lblStyle}>Time (optional)</label>
            <input type="time" className="tf-input h44" style={{ ...iStyle, borderColor: 'rgba(255,255,255,0.08)' }} value={newTask.time} onChange={e => setNewTask({ ...newTask, time: e.target.value })} />
          </div>
        </div>
        {/* Publish Date field — shown for Social Media tasks */}
        {(() => {
          const assignee = data.users.find(u => u.id === newTask.assignedTo);
          const resolvedDept = newTask.category || assignee?.dept || '';
          if (resolvedDept === 'Social Media') {
            return (
              <div className="form-group mb16">
                <label style={lblStyle}>Publish Date * <span style={{ fontWeight: 400, color: '#8890b0', fontSize: '0.72rem' }}>(deadline should be at least 7 days before this)</span></label>
                <input type="date" className="tf-input h44" style={{ ...iStyle, borderColor: taskErrors.publishDate ? '#ef4444' : 'rgba(255,255,255,0.08)' }} value={newTask.publishDate} onChange={e => { setNewTask({ ...newTask, publishDate: e.target.value }); setTaskErrors({}); }} />
                {taskErrors.publishDate && <span className="field-error">{taskErrors.publishDate}</span>}
                {newTask.publishDate && newTask.deadline && (() => {
                  const diff = Math.floor((new Date(newTask.publishDate) - new Date(newTask.deadline)) / (1000 * 60 * 60 * 24));
                  if (diff < 7) return <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 4, display: 'block' }}>⚠ Deadline must be at least 7 days before publish date ({diff} days gap)</span>;
                  return <span style={{ fontSize: '0.72rem', color: '#10b981', marginTop: 4, display: 'block' }}>✓ {diff} days between deadline and publish date</span>;
                })()}
              </div>
            );
          }
          return null;
        })()}
        <button type="submit" className="btn" style={{ width: '100%', height: 48, background: '#7c3aed', color: '#fff', fontWeight: 800, fontSize: '0.9rem', borderRadius: 8, justifyContent: 'center' }}>Assign Task</button>
      </form>
    </div>
  );

  /* ── Task Explorer ── */
  const [prioFilter, setPrioFilter] = useState('all');
  const filteredTasks = data.tasks.filter(t => {
    const pMatch = prioFilter === 'all' || t.priority === prioFilter;
    const dMatch = deptFilter === 'all' || t.dept === deptFilter;
    return pMatch && dMatch;
  });

  const handleAddLink = async (taskId) => {
    if (!linkInput.trim()) return;
    await updateTask(taskId, { link: linkInput });
    setAddLinkTaskId(null); setLinkInput('');
  };

  const renderTaskExplorer = () => (
    <div className="section-wrap anim-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>All Tasks</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#8890b0', marginRight: 4 }}>Dept:</span>
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
              <option value="all">All Departments</option>
              {DEPT_CARDS.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#8890b0', marginRight: 4 }}>Priority:</span>
            {['all', 'high', 'medium', 'low'].map(p => (
              <button key={p} onClick={() => setPrioFilter(p)}
                style={{ padding: '4px 12px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: prioFilter === p ? (PRIORITY_CFG[p]?.color || '#7c3aed') : 'rgba(255,255,255,0.06)', color: prioFilter === p ? '#fff' : '#8890b0' }}>
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tf-table">
          <thead><tr><th>TITLE</th><th>ASSIGNED TO</th><th>DEPT</th><th>PRIORITY</th><th>STATUS</th><th>DEADLINE</th><th>COMPLETED AT</th><th>REMARK</th><th>LINK</th><th>DELETE</th></tr></thead>
          <tbody>
            {filteredTasks.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 700, color: '#fff', cursor: 'pointer' }} onClick={() => { setSelectedTask(t); setFeedback(t.feedback || ''); }}>
                  {t.title}
                  {t.selfAssigned && <span style={{ marginLeft: 6, fontSize: '0.58rem', padding: '2px 6px', borderRadius: 99, background: 'rgba(236,72,153,0.15)', color: '#ec4899', fontWeight: 700 }}>Self</span>}
                </td>
                <td style={{ color: '#8890b0' }}>{t.assignedName}</td>
                <td style={{ color: '#8890b0', fontSize: '0.82rem' }}>{t.dept}</td>
                <td><PBadge priority={t.priority} /></td>
                <td><SBadge status={t.status} /></td>
                <td style={{ fontSize: '0.78rem', color: '#8890b0' }}>{t.deadline || '—'}</td>
                <td style={{ fontSize: '0.78rem', color: t.completedAt ? '#10b981' : '#555' }}>{t.completedAt ? new Date(t.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                <td style={{ fontSize: '0.78rem', color: '#8890b0', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.feedback}>{t.feedback ? `${t.feedback}` : '—'}</td>
                <td>
                  {t.link ? (
                    <a href={t.link} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', fontSize: '0.78rem' }}>View</a>
                  ) : addLinkTaskId === t.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input className="tf-input" style={{ width: 120, padding: '2px 6px', fontSize: '0.72rem', background: '#1e2035', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 4 }}
                        placeholder="https://..." value={linkInput} onChange={e => setLinkInput(e.target.value)} />
                      <button onClick={() => handleAddLink(t.id)} style={{ background: '#7c3aed', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', cursor: 'pointer', fontWeight: 700 }}>✓</button>
                      <button onClick={() => setAddLinkTaskId(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#8890b0', padding: '2px 6px', borderRadius: 4, fontSize: '0.68rem', cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddLinkTaskId(t.id); setLinkInput(''); }} style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', cursor: 'pointer', fontWeight: 700 }}>＋ Link</button>
                  )}
                </td>
                <td>
                  <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete task "${t.title}"? This action cannot be undone.`)) deleteTask(t.id); }}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Delete this task">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ── Team Access ── */
  const togglePass = (id) => setShowPassIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const activeHrs = (u) => { 
    const secs = DEMO_MODE 
      ? data.tasks.filter(t => t.assignedTo === u.id).reduce((acc, t) => acc + (t.loggedSeconds || 0), 0)
      : (data.loginTrack?.[u.id] || 0);
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`; 
  };

  const renderTeamAccess = () => (
    <div className="section-wrap anim-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Team Access Management</div>
        <button className="btn" onClick={() => setShowCredModal(true)} style={{ background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: '0.82rem', padding: '8px 18px', borderRadius: 8 }}>＋ Add Member</button>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="tf-table">
          <thead><tr><th>Name</th><th>Email</th><th>Password</th><th>Role</th><th>Dept / Client</th><th>Active Hrs Today</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {allMembers.map(u => (
              <tr key={u.id}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="avatar" style={{ background: u.color || '#7c3aed', width: 28, height: 28, fontSize: '0.65rem' }}>{u.avatar}</div><span style={{ fontWeight: 600 }}>{u.name}</span></div></td>
                <td style={{ color: '#8890b0', fontSize: '0.82rem' }}>{u.email || '—'}</td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: showPassIds.has(u.id) ? 0 : 2 }}>{showPassIds.has(u.id) ? (u.password || '••••••••') : '••••••••'}</span><button onClick={() => togglePass(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8890b0', fontSize: 12 }}>{showPassIds.has(u.id) ? 'Hide' : 'Show'}</button></div></td>
                <td><span className={`badge ${u.role === 'employee' ? 'badge-active' : 'badge-review'}`}>{u.role}</span></td>
                <td style={{ fontSize: '0.82rem' }}>{u.dept || (u.clientId ? `Client #${u.clientId}` : '—')}</td>
                <td style={{ fontSize: '0.82rem', fontWeight: 600, color: '#7c3aed' }}>{activeHrs(u)}</td>
                <td><span className={`badge ${u.isActive !== false ? 'badge-active' : 'badge-red'}`}>{u.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                <td>
                  <button onClick={() => { if (window.confirm(`Delete member "${u.name}"? This will permanently remove ALL their tasks, meeting data, notes, and notifications.`)) deleteMember(u.id); }}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '5px 12px', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Delete member and all their data">🗑 Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="page-content">
      {showCredModal && <CreateCredentialsModal onClose={() => setShowCredModal(false)} />}
      {isAssignModalOpen && (
        <div className="modal-overlay anim-fade-in" style={{ backgroundColor: 'rgba(5,6,12,0.94)', backdropFilter: 'blur(14px)' }}>
          <div className="modal-content" style={{ width: 580 }}>{renderTaskForm(true)}</div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="modal-overlay anim-fade-in" style={{ backgroundColor: 'rgba(5,6,12,0.92)', backdropFilter: 'blur(14px)' }} onClick={() => setSelectedTask(null)}>
          <div className="modal-content" style={{ width: 520, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="card" style={{ background: '#161829', border: '1px solid rgba(255,255,255,0.08)', padding: 28, borderRadius: 12, position: 'relative' }}>
              <button onClick={() => setSelectedTask(null)} style={{ position: 'absolute', top: 16, right: 20, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#fff', marginBottom: 4 }}>
                {selectedTask.title}
                {selectedTask.selfAssigned && <span style={{ marginLeft: 8, fontSize: '0.62rem', padding: '3px 8px', borderRadius: 99, background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)', fontWeight: 700, verticalAlign: 'middle' }}>Self Task</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}><PBadge priority={selectedTask.priority} /><SBadge status={selectedTask.status} /></div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.78rem', color: '#8890b0', fontWeight: 600, marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: '0.88rem', color: '#c0c5d8', lineHeight: 1.6, background: 'var(--bg3)', padding: '12px 14px', borderRadius: 8 }}>{selectedTask.desc || 'No description provided.'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div><div style={{ fontSize: '0.72rem', color: '#8890b0', marginBottom: 2 }}>Assigned To</div><div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{selectedTask.assignedName}</div></div>
                <div><div style={{ fontSize: '0.72rem', color: '#8890b0', marginBottom: 2 }}>Deadline</div><div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{selectedTask.deadline || '—'}</div></div>
                <div><div style={{ fontSize: '0.72rem', color: '#8890b0', marginBottom: 2 }}>Department</div><div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{selectedTask.dept}</div></div>
                <div><div style={{ fontSize: '0.72rem', color: '#8890b0', marginBottom: 2 }}>Completed At</div><div style={{ fontSize: '0.88rem', fontWeight: 700, color: selectedTask.completedAt ? '#10b981' : '#555' }}>{selectedTask.completedAt ? new Date(selectedTask.completedAt).toLocaleString() : 'Not yet'}</div></div>
              </div>

              {selectedTask.link && (
                <div style={{ marginBottom: 20, padding: 14, background: 'rgba(14,165,233,0.08)', borderRadius: 10, border: '1px dashed rgba(14,165,233,0.3)' }}>
                  <div style={{ fontSize: '0.72rem', color: '#0ea5e9', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>🔗 Employee Submission Link</div>
                  <a href={selectedTask.link} target="_blank" rel="noopener noreferrer" 
                    style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 600, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'underline' }}>
                    {selectedTask.link}
                  </a>
                </div>
              )}

              {/* Feedback form */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', marginBottom: 8 }}>Manager Remark <span style={{ fontWeight: 400, color: '#8890b0' }}>(optional)</span></div>
                <textarea rows={3} className="tf-input" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Write a remark for this task…"
                  style={{ background: '#1e2035', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', resize: 'none', padding: 10, width: '100%', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => setSelectedTask(null)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#8890b0', cursor: 'pointer' }}>Close</button>
                  <button onClick={handleSubmitFeedback} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save Remark</button>
                  <button onClick={() => handleProceed(selectedTask)} style={{ flex: 1.5, padding: '8px', borderRadius: 8, background: '#10b981', border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Approve & Proceed</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tab-content">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tasks' && renderTaskExplorer()}
        {activeTab === 'assign-task' && <div className="section-wrap anim-fade-in" style={{ display: 'flex', justifyContent: 'center' }}><div style={{ maxWidth: 580, width: '100%' }}>{renderTaskForm(false)}</div></div>}
        {activeTab === 'workload' && (
          <div className="section-wrap anim-fade-in">
            {selectedEmpId ? (() => {
              const emp = employees.find(e => e.id === selectedEmpId);
              if (!emp) return null;
              const empTasks = data.tasks.filter(t => t.assignedTo === emp.id);
              const wl = getWorkloadLevel(emp.id);
              const secs = empTasks.reduce((s, t) => s + (t.loggedSeconds || 0), 0);
              return (
                <div>
                  <button className="btn btn-ghost" onClick={() => setSelectedEmpId(null)} style={{ marginBottom: 16 }}>← Back to All Employees</button>
                  <div className="card" style={{ padding: '24px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div className="avatar" style={{ background: emp.color, width: 56, height: 56, fontSize: '1.2rem' }}>{emp.avatar}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{emp.name}</div>
                      <div style={{ color: '#8890b0', fontSize: '0.82rem' }}>{emp.dept} · {emp.email}</div>
                    </div>
                    <span className="badge badge-active" style={{ fontSize: '0.82rem' }}>Active</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
                    <div className="card" style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{empTasks.length}</div><div style={{ fontSize: '0.72rem', color: '#8890b0' }}>Total Tasks</div></div>
                    <div className="card" style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{empTasks.filter(t => t.status === 'done').length}</div><div style={{ fontSize: '0.72rem', color: '#8890b0' }}>Completed</div></div>
                    <div className="card" style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{empTasks.filter(t => t.status === 'inprogress').length}</div><div style={{ fontSize: '0.72rem', color: '#8890b0' }}>In Progress</div></div>
                    <div className="card" style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7c3aed' }}>{Math.floor(secs / 3600)}h {Math.floor((secs % 3600) / 60)}m</div><div style={{ fontSize: '0.72rem', color: '#8890b0' }}>Active Hours</div></div>
                  </div>
                  <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 8 }}>Workload</div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}><div style={{ height: '100%', width: `${wl.pct}%`, background: wl.color, borderRadius: 99 }} /></div>
                    <div style={{ fontSize: '0.72rem', color: wl.color, marginTop: 4, fontWeight: 700 }}>{wl.level.toUpperCase()} ({wl.pct}%)</div>
                  </div>
                  <div className="card" style={{ overflowX: 'auto' }}>
                    <div style={{ padding: '14px 16px 0', fontWeight: 800, fontSize: '0.9rem' }}>Current Tasks</div>
                    <table className="tf-table">
                      <thead><tr><th>TASK</th><th>PRIORITY</th><th>STATUS</th><th>DEADLINE</th><th>LINK</th></tr></thead>
                      <tbody>
                        {empTasks.map(t => (
                          <tr key={t.id}>
                            <td style={{ fontWeight: 700, color: '#fff' }}>{t.title}</td>
                            <td><PBadge priority={t.priority} /></td>
                            <td><SBadge status={t.status} /></td>
                            <td style={{ fontSize: '0.78rem', color: '#8890b0' }}>{t.deadline || '—'}</td>
                            <td>{t.link ? <a href={t.link} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', fontSize: '0.78rem' }}>Link</a> : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })() : (
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 20 }}>Employee Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
                  {employees.map(emp => (
                    <div key={emp.id} className="card clickable" style={{ padding: 16, cursor: 'pointer' }} onClick={() => setSelectedEmpId(emp.id)}>
                      {/* <div className="stats-grid grid-3 gap12 mb16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <div className="card" style={{ padding: 10, textAlign: 'center' }}><div style={{ fontSize: '0.7rem', color: '#8890b0' }}>Completed</div><div style={{ fontWeight: 800 }}>{data.tasks.filter(t => t.assignedTo === emp.id && t.status === 'done').length}</div></div>
                        <div className="card" style={{ padding: 10, textAlign: 'center' }}><div style={{ fontSize: '0.7rem', color: '#8890b0' }}>Pending</div><div style={{ fontWeight: 800 }}>{data.tasks.filter(t => t.assignedTo === emp.id && t.status === 'inprogress').length}</div></div>
                        <div className="card" style={{ padding: 10, textAlign: 'center' }}><div style={{ fontSize: '0.7rem', color: '#8890b0' }}>Efficiency</div><div style={{ fontWeight: 800 }}>{getWorkloadLevel(emp.id).pct}%</div></div>
                        <div className="card" style={{ padding: 10, textAlign: 'center' }}><div style={{ fontSize: '0.7rem', color: '#8890b0' }}>Logged Today</div><div style={{ fontWeight: 800, color: '#7c3aed' }}>{getLoginHoursToday(emp.id)}</div></div>
                      </div> */}
                      <div className="avatar" style={{ background: emp.color, marginBottom: 8 }}>{emp.avatar}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{emp.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#8890b0', marginBottom: 8 }}>{emp.dept}</div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${getWorkloadLevel(emp.id).pct}%`, background: getWorkloadLevel(emp.id).color }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'clients' && (
          selectedClientId ? (() => {
            const cl = data.clients.find(c => c.id === selectedClientId);
            if (!cl) return null;
            const clTasks = data.tasks.filter(t => t.clientId === selectedClientId);
            const clPosts = (data.socialPosts || []).filter(p => p.clientId === selectedClientId);
            const SOCIALS = ['instagram', 'facebook', 'x', 'tiktok', 'gmb', 'pinterest'];
            const SOCIAL_LABELS = { instagram: '📸 Instagram', facebook: '👥 Facebook', x: '🐦 X', tiktok: '🎵 TikTok', gmb: '📍 GMB', pinterest: '📌 Pinterest' };
            return (
              <div className="section-wrap anim-fade-in">
                <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={() => setSelectedClientId(null)}>← Back</button>
                <div className="card" style={{ padding: '24px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>{cl.name}</div>
                    <div style={{ color: '#8890b0', fontSize: '0.82rem' }}>{cl.project}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: cl.progress >= 80 ? '#10b981' : '#f59e0b' }}>{cl.progress}%</div>
                    <span className={`badge ${cl.status === 'active' ? 'badge-active' : 'badge-review'}`}>{cl.status}</span>
                  </div>
                </div>

                {/* Top Section with Toggle & Cards */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 6, background: 'var(--bg3)', padding: 4, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <button onClick={() => setBudgetCurrency('USD')} style={{ padding: '4px 12px', background: budgetCurrency === 'USD' ? '#7c3aed' : 'transparent', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>$ USD</button>
                    <button onClick={() => setBudgetCurrency('INR')} style={{ padding: '4px 12px', background: budgetCurrency === 'INR' ? '#10b981' : 'transparent', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}>₹ INR</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 20 }}>
                  <div className="card" style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: '0.72rem', color: '#8890b0' }}>Total Budget</div><div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{budgetCurrency === 'USD' ? cl.budget : '₹' + (parseFloat((cl.budget || '0').replace(/[^0-9.]/g, '')) * 83).toLocaleString()}</div></div>
                  <div className="card" style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: '0.72rem', color: '#8890b0' }}>Total Tasks</div><div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{clTasks.length}</div></div>
                  <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(124,58,237,0.1))' }}>
                    <button style={{ padding: '10px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                      Download {cl.name} Project Report
                    </button>
                  </div>
                </div>

                {/* Social Pages */}
                <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Social Pages Details</div>
                    {!editSocialLinks ? (
                        <button 
                          onClick={() => {
                            const initial = {};
                            SOCIALS.forEach(s => { 
                              const details = data.clientPageDetails?.[cl.id]?.[s] || {};
                              initial[s] = { link: details.link || '', username: details.username || '', password: details.password || '' }; 
                            });
                            setSocialLinkInput(initial);
                            setEditSocialLinks(true);
                          }}
                          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          Update Details
                        </button>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setEditSocialLinks(false)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#8890b0', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => handleSaveSocialLinks(cl.id)} style={{ padding: '6px 12px', background: '#10b981', border: 'none', color: '#fff', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>✓ Save Links</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
                    {SOCIALS.map(s => {
                      const details = data.clientPageDetails?.[cl.id]?.[s] || {};
                      return (
                        <div key={s} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{SOCIAL_LABELS[s]}</span>
                          </div>
                          {editSocialLinks ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <input className="tf-input" style={{ width: '100%', boxSizing: 'border-box', background: '#1e2035', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: '0.72rem' }}
                                placeholder="Username" value={socialLinkInput[s]?.username || ''} onChange={e => setSocialLinkInput({ ...socialLinkInput, [s]: { ...socialLinkInput[s], username: e.target.value } })} />
                              <input className="tf-input" style={{ width: '100%', boxSizing: 'border-box', background: '#1e2035', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: '0.72rem' }}
                                placeholder="Password" value={socialLinkInput[s]?.password || ''} onChange={e => setSocialLinkInput({ ...socialLinkInput, [s]: { ...socialLinkInput[s], password: e.target.value } })} />
                              <input className="tf-input" style={{ width: '100%', boxSizing: 'border-box', background: '#1e2035', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: '0.72rem' }}
                                placeholder="Account URL" value={socialLinkInput[s]?.link || ''} onChange={e => setSocialLinkInput({ ...socialLinkInput, [s]: { ...socialLinkInput[s], link: e.target.value } })} />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {details.username && <div style={{ fontSize: '0.72rem', color: '#fff' }}><span style={{ color: '#8890b0' }}>U:</span> {details.username}</div>}
                              {details.password && <div style={{ fontSize: '0.72rem', color: '#fff' }}><span style={{ color: '#8890b0' }}>P:</span> {details.password}</div>}
                              {details.link ? <a href={details.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#0ea5e9', wordBreak: 'break-all' }}>{details.link}</a>
                                          : <div style={{ fontSize: '0.72rem', color: '#555' }}>No link</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Client tasks */}
                <div className="card" style={{ overflowX: 'auto', marginBottom: 20 }}>
                  <div style={{ padding: '14px 16px 0', fontWeight: 800, fontSize: '0.9rem' }}>Tasks for {cl.name}</div>
                  <table className="tf-table">
                    <thead><tr><th>TASK</th><th>ASSIGNED</th><th>DEPT</th><th>STATUS</th><th>DEADLINE</th></tr></thead>
                    <tbody>
                      {clTasks.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 700, color: '#fff' }}>{t.title}</td>
                          <td style={{ color: '#8890b0' }}>{t.assignedName}</td>
                          <td style={{ color: '#8890b0' }}>{t.dept}</td>
                          <td><SBadge status={t.status} /></td>
                          <td style={{ color: '#8890b0', fontSize: '0.82rem' }}>{t.deadline || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Related social posts */}
                {clPosts.length > 0 && (
                  <div className="card" style={{ overflowX: 'auto' }}>
                    <div style={{ padding: '14px 16px 0', fontWeight: 800, fontSize: '0.9rem' }}>Social Posts for {cl.name}</div>
                    <table className="tf-table">
                      <thead><tr><th>THEME</th><th>TYPE</th><th>STATUS</th><th>PUBLISH DATE</th><th>BOOST</th><th>BUDGET</th></tr></thead>
                      <tbody>
                        {clPosts.map(p => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 700, color: '#fff' }}>{p.contentTheme}</td>
                            <td style={{ color: '#8890b0' }}>{p.contentType}</td>
                            <td><span style={{ background: p.status === 'Published' ? '#10b98122' : '#f59e0b22', color: p.status === 'Published' ? '#10b981' : '#f59e0b', padding: '2px 8px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700 }}>{p.status}</span></td>
                            <td style={{ color: '#8890b0', fontSize: '0.82rem' }}>{p.publishDate || '—'}</td>
                            <td style={{ color: p.boost === 'Yes' ? '#10b981' : '#8890b0' }}>{p.boost}</td>
                            <td style={{ color: '#10b981', fontWeight: 700 }}>{p.budget ? `€${p.budget}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="section-wrap anim-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Clients</div>
                <button onClick={() => setShowAddClientModal(true)} style={{ background: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 700, cursor: 'pointer' }}>＋ Add Client</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16 }}>
                {data.clients.map(c => (
                  <div key={c.id} className="card clickable" style={{ padding: 16, position: 'relative' }} onClick={() => setSelectedClientId(c.id)}>
                    <div style={{ fontWeight: 700, marginBottom: 4, paddingRight: 24 }}>{c.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#8890b0', marginBottom: 10 }}>{c.project}</div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}><div style={{ height: '100%', width: `${c.progress}%`, background: '#7c3aed', borderRadius: 99 }} /></div>
                    <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#7c3aed', marginTop: 4 }}>{c.progress}%</div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete this client across all data?')) deleteClient(c.id); }}
                      style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }} title="Delete Client">
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
        {activeTab === 'planner' && <div className="section-wrap anim-fade-in"><CalendarGrid managerView={true} /></div>}
        {activeTab === 'social-cal' && (
          <div className="section-wrap anim-fade-in">
            <button className="btn btn-ghost" style={{ marginBottom: 16 }} onClick={() => navigate('/manager/overview')}>
              ← Back to Dashboard
            </button>
            <SocialCalendar />
          </div>
        )}
        { activeTab === 'meetings' && <div className="section-wrap anim-fade-in"><MeetingList /></div> }
        { activeTab === 'reports' && <div className="section-wrap anim-fade-in"><AnalyticsPage /></div> }
        { activeTab === 'team-access' && renderTeamAccess() }
        { activeTab === 'blogs-sheet' && <div className="section-wrap anim-fade-in"><BlogsSheet /></div> }
      </div>

      {/* Floating Action Buttons */}
      <div style={{ position: 'fixed', bottom: 28, right: 28, display: 'flex', flexDirection: 'column', gap: 12, zIndex: 900 }}>
        {/* Notepad */}
        <button onClick={() => setShowNotepad(n => !n)} title="Notepad"
          style={{ width: 50, height: 50, borderRadius: '50%', background: '#1e2035', border: '2px solid #7c3aed44', color: '#f59e0b', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          📝
        </button>
        {/* Assign Task */}
        <button onClick={() => navigate('/manager/assign-task')} title="Assign New Task"
          style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(124,58,237,0.5)' }}>
          ＋
        </button>
      </div>

      {/* Notepad Panel */}
      {showNotepad && (
        <div style={{ position: 'fixed', bottom: 100, right: 28, width: 300, background: '#161829', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 20, zIndex: 901, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Quick Notes</span>
            <button onClick={() => setShowNotepad(false)} style={{ background: 'none', border: 'none', color: '#8890b0', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
          <textarea rows={8} value={notepadText} onChange={e => setNotepadText(e.target.value)} placeholder="Jot down notes…"
            style={{ width: '100%', background: '#1e2035', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: 8, padding: 10, fontSize: '0.82rem', resize: 'none', boxSizing: 'border-box' }} />
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClientModal && (
        <CreateClientModal
          onClose={() => setShowAddClientModal(false)}
          onAdd={async (c) => {
            await addClient(c);
            setShowAddClientModal(false);
          }}
        />
      )}
    </div>
  );
};

const lblStyle = { color: '#8890b0', fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 6 };
const iStyle = { background: '#1e2035', color: '#fff' };

export default ManagerPage;
