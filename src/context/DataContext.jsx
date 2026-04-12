import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, DEMO_MODE } from '../lib/supabase';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { registerNotifAdder, pushNotif, notifTemplates, scheduleMeetingReminders, requestNotifPermission } from '../lib/notifications';

const DataContext = createContext();

/* ── Empty social page credentials template ── */
const EMPTY_SOCIAL_PAGES = () => ({
  instagram: { username: '', password: '', link: '' },
  facebook:  { username: '', password: '', link: '' },
  x:         { username: '', password: '', link: '' },
  tiktok:    { username: '', password: '', link: '' },
  gmb:       { username: '', password: '', link: '' },
  pinterest: { username: '', password: '', link: '' },
  youtube:   { username: '', password: '', link: '' },
  linkedin:  { username: '', password: '', link: '' },
});

/* ── Seed data (used in DEMO MODE) ─────────────────────────── */
export const INITIAL_TF_DATA = {
  users: [],
  clients: [],
  departments: [],
  tasks: [],
  meetings: [],
  socialPosts: [],
  clientEvents: {},
  clientReports: {},
  calendarNotes: {},
  clientPageDetails: {},
};

const TF_DATA_KEY = 'tf_data_v4';

const BASE_DEPARTMENTS = [
  { id: 'd1', name: 'Social Media', color: '#0ea5e9' },
  { id: 'd2', name: 'SEO',          color: '#10b981' },
  { id: 'd3', name: 'Web Dev',      color: '#f59e0b' },
  { id: 'd4', name: 'Ads',          color: '#ef4444' },
  { id: 'd5', name: 'Blogs',        color: '#ec4899' },
  { id: 'd6', name: 'Reports',      color: '#6366f1' },
  { id: 'd7', name: 'Management',   color: '#7c3aed' },
];

/* ── Provider ──────────────────────────────────────────────── */
export const DataProvider = ({ children }) => {
  const { user } = useAuth();

  /* ─ Demo state (localStorage) ─ */
  const [demoData, setDemoData] = useState(() => {
    if (!DEMO_MODE) return INITIAL_TF_DATA;
    const saved = localStorage.getItem(TF_DATA_KEY);
    if (saved) {
      try {
        return { ...INITIAL_TF_DATA, ...JSON.parse(saved) };
      } catch {
        return { ...INITIAL_TF_DATA };
      }
    }
    return { ...INITIAL_TF_DATA };
  });

  // In-app notification store (persist to localStorage)
  const [_notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('tf_notifications');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return [];
  });

  useEffect(() => {
    localStorage.setItem('tf_notifications', JSON.stringify(_notifications));
  }, [_notifications]);

  // Register the adder so lib/notifications.js can push
  useEffect(() => {
    registerNotifAdder((n) => setNotifications(prev => [n, ...prev].slice(0, 200)));
    requestNotifPermission();
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Schedule reminders for all future meetings on load
  useEffect(() => {
    if (!DEMO_MODE) return;
    demoData.meetings.forEach(m => scheduleMeetingReminders(m));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (DEMO_MODE) localStorage.setItem(TF_DATA_KEY, JSON.stringify(demoData));
  }, [demoData]);

  /* ─ Supabase state ─ */
  const [sbData, setSbData] = useState(() => {
    if (DEMO_MODE) return { users: [], clients: [], departments: [], tasks: [], meetings: [], clientEvents: {}, clientReports: {}, calendarNotes: {}, clientPageDetails: {}, socialPosts: [], loginTrack: {}, blogsSheet: [] };
    // ⚡ CACHE: Initial load from local cache for instant UI
    const cached = localStorage.getItem('tf_sb_cache');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    return { users: [], clients: [], departments: [], tasks: [], meetings: [], clientEvents: {}, clientReports: {}, calendarNotes: {}, clientPageDetails: {}, socialPosts: [], loginTrack: {}, blogsSheet: [] };
  });

  const [loading, setLoading] = useState(() => {
    if (DEMO_MODE) return false;
    // ⚡ CACHE-FIRST: If we have a cached dataset, don't show the initial loader
    const cached = localStorage.getItem('tf_sb_cache');
    return !cached;
  });
  const [error,   setError]   = useState(null);

  const loadAllData = useCallback(async () => {
    if (DEMO_MODE || !user) { setLoading(false); return; }
    
    // ⚡ SILENT REFRESH: If we already have data, fetch in background without blocking UI
    const hasData = sbData.tasks.length > 0;
    if (!hasData) setLoading(true);
    setError(null);
    try {
      const [profRes, cliRes, taskRes, meetRes, noteRes, socialRes, clientPageRes, loginTrackRes, notifRes, blogsRes] = await Promise.all([
        api.profiles.getAll(),
        api.clients.getAll(),
        api.tasks.getAll(),
        api.meetings.getAll(),
        api.profiles.getOwnNotes(user.userId),
        api.social.getAllPosts(),
        api.social.getPageDetails(),
        supabase.from('login_track').select('*').eq('date', new Date().toISOString().split('T')[0]),
        api.notifications.getAll(user.userId),
        api.blogs.getAll()
      ]);

      const tasks = (taskRes.data || []).map(t => ({
        id: t.id, title: t.title, desc: t.desc,
        assignedTo: t.assigned_to, assignedName: t.assigned_name,
        dept: t.dept, clientId: t.client_id,
        priority: t.priority, status: t.status, deadline: t.deadline,
        loggedSeconds: t.logged_seconds || 0, completedAt: t.done_at, createdAt: t.created_at,
        feedback: t.feedback, link: t.link,
      }));

      const meetings = (meetRes.data || []).map(m => ({
        id: m.id, title: m.title, date: m.date, time: m.time, type: m.type, clientId: m.client_id,
        attendees: (m.meeting_attendees || []).map(a => a.user_id),
        desc: m.desc || '', link: m.link || '',
      }));

      const calendarNotes = {};
      (noteRes.data || []).forEach(n => {
        if (!calendarNotes[n.user_id]) calendarNotes[n.user_id] = {};
        calendarNotes[n.user_id][n.date_key] = n.note;
      });

      // 🗺️ OPTIMIZATION: Pre-calculate department metrics once
      const deptStats = {};
      tasks.forEach(t => {
        if (!t.dept) return;
        if (!deptStats[t.dept]) deptStats[t.dept] = { total: 0, done: 0 };
        deptStats[t.dept].total++;
        if (t.status === 'done') deptStats[t.dept].done++;
      });

      const departments = BASE_DEPARTMENTS.map(d => {
        const stats = deptStats[d.name] || { total: 0, done: 0 };
        const head = (profRes.data || []).find(p => p.dept === d.name && p.role === 'employee');
        return { 
          ...d, 
          head: head?.name || '—', 
          performance: stats.total ? Math.round(stats.done / stats.total * 100) : 0, 
          tasks: stats.total, 
          completed: stats.done 
        };
      });

      const socialPosts = (socialRes.data || []).map(p => ({
        id: p.id, clientId: p.client_id, contentTheme: p.content_theme, contentType: p.content_type,
        publishDate: p.publish_date, time: p.time, boost: p.boost, budget: p.budget,
        status: p.status, links: p.links, createdAt: p.created_at
      }));

      const clientPageDetails = {};
      (clientPageRes.data || []).forEach(row => {
        if (!clientPageDetails[row.client_id]) clientPageDetails[row.client_id] = {};
        clientPageDetails[row.client_id][row.platform] = row.details;
      });

      const loginTrack = {};
      (loginTrackRes.data || []).forEach(row => {
        loginTrack[row.user_id] = row.total_seconds;
      });

      const dbNotifications = (notifRes.data || []).map(n => ({
        id: n.id, title: n.title, body: n.body, icon: n.icon, read: n.read,
        time: new Date(n.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      }));
      setNotifications(prev => [...dbNotifications, ...prev.filter(n => typeof n.id === 'number')]);

      const blogsSheet = (blogsRes.data || []).map(b => ({
        id: b.id, contentLink: b.content_link, reportLink: b.report_link,
        previewLink: b.preview_link, comment: b.comment, remark: b.remark, createdBy: b.created_by,
        createdAt: b.created_at, updatedAt: b.updated_at
      }));

      const newData = {
        users: (profRes.data || []).map(p => ({ id: p.id, name: p.name, email: p.email, role: p.role, dept: p.dept, avatar: p.avatar, color: p.color, clientId: p.client_id })),
        clients: cliRes.data || [],
        departments, tasks, meetings,
        clientEvents: {}, clientReports: {}, calendarNotes, clientPageDetails, socialPosts, loginTrack, blogsSheet
      };
      setSbData(newData);
      // ⚡ CACHE: Store for next refresh
      localStorage.setItem('tf_sb_cache', JSON.stringify(newData));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [user?.userId]);

  /* ── REALTIME: Shared Notifications ── */
  useEffect(() => {
    if (!user || DEMO_MODE) return;

    const channel = supabase
      .channel(`user-notifs-${user.userId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
      }, (payload) => {
        const n = payload.new;
        // Only show if targeted to this user or this user's role
        if (n.user_id !== user.userId && n.role_target !== user.role) return;
        
        const newNotif = {
          id: n.id, title: n.title, body: n.body, icon: n.icon, read: n.read,
          time: new Date(n.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
        setNotifications(prev => [newNotif, ...prev]);
        // Play sound is already handled by pushNotif for sender, 
        // but for receiver we should sound the alarm if ctx available
        try {
          const audio = new AudioContext(); // Simple way to trigger sound logic if needed
          // Actually, pushNotif handles it for the one who triggers it.
          // For the one who RECEIVES it via realtime, we play the chime.
           const play = (freq, startTime, duration) => {
            const osc = audio.createOscillator();
            const gain = audio.createGain();
            osc.connect(gain); gain.connect(audio.destination);
            osc.type = 'sine'; osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime); osc.stop(startTime + duration);
          };
          play(523.25, audio.currentTime, 0.15);
          play(783.99, audio.currentTime + 0.12, 0.4);
        } catch(e) {}
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  /* ─ The active dataset ─ */
  const rawData   = DEMO_MODE ? demoData : sbData;
  const data      = { ...rawData, _notifications };

  /* ── Mutations ─────────────────────────────────────────────── */
  const updateTaskStatus = async (taskId, newStatus, updaterName) => {
    const task = data.tasks.find(t => t.id === taskId);
    if (DEMO_MODE) {
      const patch = { status: newStatus };
      if (newStatus === 'done') patch.done_at = new Date().toISOString();
      setDemoData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t) }));
      if (task && updaterName) {
        if (newStatus === 'done') {
          pushNotif(notifTemplates.taskCompleted(task.title, updaterName));
          // Notify the associated client if applicable
          if (task.clientId) {
            const clientUser = data.users.find(u => u.role === 'client' && u.clientId === task.clientId);
            if (clientUser) pushNotif(notifTemplates.clientTaskCompleted(task.title, task.desc, clientUser.id));
          }
        }
        else if (newStatus === 'review') pushNotif(notifTemplates.taskStatusUpdate(task.title, 'submitted for review', updaterName));
        else if (newStatus === 'inprogress') pushNotif(notifTemplates.taskStarted(task.title, updaterName));
        else pushNotif(notifTemplates.taskStatusUpdate(task.title, newStatus, updaterName));
      }
      return {};
    }
    const patch = { status: newStatus };
    if (newStatus === 'done') patch.done_at = new Date().toISOString();
    const { error } = await api.tasks.update(taskId, patch);
    if (!error) {
      setSbData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t) }));
      const task = data.tasks.find(t => t.id === taskId);
      if (task && updaterName) {
        if (newStatus === 'done') {
          pushNotif(notifTemplates.taskCompleted(task.title, updaterName));
          if (task.clientId) {
            const clientUser = data.users.find(u => u.role === 'client' && u.clientId === task.clientId);
            // pushNotif takes targetUserId, which is generally user.id or user.userId (typically id in DB represents the user's UUID)
            if (clientUser) pushNotif(notifTemplates.clientTaskCompleted(task.title, task.desc, clientUser.id));
          }
        }
        else if (newStatus === 'review') pushNotif(notifTemplates.taskStatusUpdate(task.title, 'submitted for review', updaterName));
        else if (newStatus === 'inprogress') pushNotif(notifTemplates.taskStarted(task.title, updaterName));
        else pushNotif(notifTemplates.taskStatusUpdate(task.title, newStatus, updaterName));
      }
    }
    return { error };
  };

  const requestTaskReassignment = async (taskId, reason, link, reassignToUser, updaterName) => {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return { error: { message: "Task not found" } };
    
    let assignedMsg = "";
    if (reassignToUser) assignedMsg = `\nReassigned To: ${reassignToUser.name}`;
    
    const emergencyNotes = `\n\n--- EMERGENCY REASSIGNMENT REQUEST ---\nReason: ${reason}\nLink: ${link || 'None provided'}\nRequested By: ${updaterName}${assignedMsg}`;
    const localPatch = { desc: (task.desc || '') + emergencyNotes };
    const dbPatch = { "desc": (task.desc || '') + emergencyNotes };
    
    if (reassignToUser) {
      // Reassign back to To Do queue for the new assignee
      localPatch.assignedTo = reassignToUser.id;
      localPatch.assignedName = reassignToUser.name;
      localPatch.status = 'todo';
      
      dbPatch.assigned_to = reassignToUser.id;
      dbPatch.assigned_name = reassignToUser.name;
      dbPatch.status = 'todo';
    }

    if (DEMO_MODE) {
      setDemoData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...localPatch } : t) }));
      pushNotif(notifTemplates.emergencyReassignRequested(task.title, updaterName, reason));
      if (reassignToUser) pushNotif(notifTemplates.taskAssigned(task.title, reassignToUser.name, reassignToUser.id));
      return {};
    }
    
    // In Supabase mode
    const { error } = await api.tasks.update(taskId, dbPatch);
    if (!error) {
      setSbData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...localPatch } : t) }));
      pushNotif(notifTemplates.emergencyReassignRequested(task.title, updaterName, reason));
      if (reassignToUser) pushNotif(notifTemplates.taskAssigned(task.title, reassignToUser.name, reassignToUser.id));
    }
    return { error };
  };

  const updateLoggedTime = async (taskId, seconds) => {
    if (DEMO_MODE) {
      setDemoData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, loggedSeconds: seconds } : t) }));
      return {};
    }
    const { error } = await api.tasks.update(taskId, { logged_seconds: seconds });
    if (!error) setSbData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, loggedSeconds: seconds } : t) }));
    return { error };
  };

  const addTask = async (task) => {
    if (DEMO_MODE) {
      const id = 't' + Date.now();
      setDemoData(prev => ({ ...prev, tasks: [...prev.tasks, { ...task, id, status: 'todo', createdAt: new Date().toISOString().split('T')[0], loggedSeconds: 0 }] }));
      pushNotif(notifTemplates.taskAssigned(task.title, task.assignedName));
      return {};
    }
    const { id, error } = await api.tasks.create(task);
    if (!error) await loadAllData();
    return { error };
  };

  const cancelMeeting = async (meetingId) => {
    const meetInfo = data.meetings.find(m => m.id === meetingId);
    if (DEMO_MODE) {
      setDemoData(prev => ({ 
        ...prev, 
        meetings: prev.meetings.map(m => m.id === meetingId ? { ...m, status: 'canceled' } : m) 
      }));
      // Notify all attendees about cancellation
      if (meetInfo?.attendees) {
        meetInfo.attendees.forEach(attendeeId => {
          pushNotif(notifTemplates.meetingCanceled(meetInfo.title, attendeeId));
        });
      }
      return {};
    }
    const { error } = await api.meetings.cancel(meetingId);
    if (!error) {
      setSbData(prev => ({ 
        ...prev, 
        meetings: prev.meetings.map(m => m.id === meetingId ? { ...m, status: 'canceled' } : m) 
      }));
      // Notify all attendees about cancellation
      if (meetInfo?.attendees) {
        meetInfo.attendees.forEach(attendeeId => {
          pushNotif(notifTemplates.meetingCanceled(meetInfo.title, attendeeId));
        });
      }
    } else {
      pushNotif({ title: '❌ Error', body: 'Failed to cancel meeting: ' + error.message, icon: '❌' });
    }
    return { error };
  };

  const updateTask = async (taskId, patch) => {
    const prevTask = data.tasks.find(t => t.id === taskId);
    if (DEMO_MODE) {
      setDemoData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t) }));
      // Notify employee when manager adds/updates remark
      if (patch.feedback && patch.feedback !== prevTask?.feedback && prevTask) {
        pushNotif(notifTemplates.remarkAdded(prevTask.title, patch.feedback, prevTask.assignedTo));
      }
      // Notify employee when manager approves (proceed)
      if (patch.status === 'approved' && prevTask) {
        pushNotif(notifTemplates.proceedConfirmed(prevTask.title, prevTask.assignedTo));
      }
      return {};
    }
    const { error } = await api.tasks.update(taskId, patch);
    if (!error) setSbData(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t) }));
    return { error };
  };

  const addClient = async (client) => {
    const id = 'cl' + Date.now();
    if (DEMO_MODE) {
      setDemoData(prev => ({ ...prev, clients: [...prev.clients, { ...client, id, progress: 0, status: 'active' }] }));
      return { id };
    }
    const { error, data: newArray } = await api.clients.create(client);
    // Note: api.clients.create handles ID internally
    if (!error) await loadAllData();
    return { error };
  };

  const addSocialPost = async (post) => {
    const id = 'sp' + Date.now();
    if (DEMO_MODE) {
      setDemoData(prev => ({ ...prev, socialPosts: [...(prev.socialPosts || []), { ...post, id, links: post.links || { instagram: '', facebook: '', x: '', tiktok: '', gmb: '', pinterest: '', youtube: '', linkedin: '' } }] }));
      return { id };
    }
    const { error } = await api.social.createPost(post);
    if (!error) await loadAllData();
    return { error };
  };

  const updateSocialPost = async (postId, patch) => {
    if (DEMO_MODE) {
      setDemoData(prev => ({
        ...prev,
        socialPosts: prev.socialPosts.map(p => p.id === postId ? { ...p, ...patch } : p),
      }));
      // If links updated, notify about social post
      if (patch.links || patch.status === 'Published') {
        const post = data.socialPosts?.find(p => p.id === postId);
        if (post) pushNotif(notifTemplates.socialLinkPosted(post.contentTheme || 'Social Post'));
      }
      return {};
    }
    
    const dbPatch = {};
    const fieldMap = {
      contentTheme: 'content_theme',
      contentType: 'content_type',
      publishDate: 'publish_date',
      publishTime: 'publish_time',
      submissionDate: 'submission_date',
      referenceLink: 'reference_link',
      assetLink: 'asset_link',
      planB: 'plan_b',
      postObjective: 'post_objective',
      status: 'status',
      boost: 'boost',
      budget: 'budget',
      remarks: 'remarks',
      caption: 'caption',
      links: 'links'
    };

    Object.entries(patch).forEach(([k, v]) => {
      const dbKey = fieldMap[k] || k;
      dbPatch[dbKey] = v;
    });
    
    const { error } = await api.social.updatePost(postId, dbPatch);
    if (!error) await loadAllData();
    return { error };
  };

  const saveClientPageDetails = async (clientId, platform, details) => {
    if (DEMO_MODE) {
      setDemoData(prev => ({
        ...prev,
        clientPageDetails: {
          ...prev.clientPageDetails,
          [clientId]: {
            ...(prev.clientPageDetails?.[clientId] || {}),
            [platform]: details,
          },
        },
      }));
      return {};
    }
    const { error } = await api.social.savePageDetails(clientId, platform, details);
    if (!error) await loadAllData();
    return { error };
  };

  const addMeeting = async (meeting) => {
    if (DEMO_MODE) {
      const id = 'm' + Date.now();
      const newMeeting = { ...meeting, id, status: 'scheduled' };
      setDemoData(prev => ({ ...prev, meetings: [...prev.meetings, newMeeting] }));
      scheduleMeetingReminders(newMeeting);
      pushNotif(notifTemplates.meetingScheduled(meeting.title, meeting.time));
      return {};
    }
    // API creation and status are handled by api.meetings.create
    const { error: me } = await api.meetings.create(meeting);
    if (!me) await loadAllData();
    return { error: me };
  };

  const saveCalendarNote = async (userId, dateKey, note) => {
    if (DEMO_MODE) {
      setDemoData(prev => { const un = { ...(prev.calendarNotes[userId] || {}), [dateKey]: note }; return { ...prev, calendarNotes: { ...prev.calendarNotes, [userId]: un } }; });
      return {};
    }
    const { error } = await api.profiles.saveNote(userId, dateKey, note);
    if (!error) setSbData(prev => { const un = { ...(prev.calendarNotes[userId] || {}), [dateKey]: note }; return { ...prev, calendarNotes: { ...prev.calendarNotes, [userId]: un } }; });
    return { error };
  };

  const getTasksByUser   = uid => data.tasks.filter(t => t.assignedTo === uid);
  const getWorkloadLevel = uid => {
    const n = getTasksByUser(uid).filter(t => t.status !== 'done').length;
    if (n <= 1) return { level: 'low',    pct: 25, color: '#10b981' };
    if (n <= 3) return { level: 'normal', pct: 60, color: '#f59e0b' };
    return             { level: 'high',   pct: 90, color: '#ef4444' };
  };

  /* ── Blogs Sheet Handlers ── */
  const addBlogsSheetRow = async (row) => {
    if (DEMO_MODE) {
      const id = 'b' + Date.now();
      const formatted = {
        id, contentLink: row.contentLink || '', reportLink: row.reportLink || '',
        previewLink: row.previewLink || '', comment: row.comment || '', remark: row.remark || '', createdBy: row.createdBy,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      setDemoData(prev => ({ ...prev, blogsSheet: [formatted, ...(prev.blogsSheet || [])] }));
      return { error: null };
    }
    
    const { data: newRow, error } = await api.blogs.create(row);
    if (!error && newRow) {
      const formatted = {
        id: newRow.id, contentLink: newRow.content_link, reportLink: newRow.report_link,
        previewLink: newRow.preview_link, comment: newRow.comment, remark: newRow.remark, createdBy: newRow.created_by,
        createdAt: newRow.created_at, updatedAt: newRow.updated_at
      };
      setSbData(prev => ({ ...prev, blogsSheet: [formatted, ...(prev.blogsSheet || [])] }));
    }
    return { error };
  };

  const updateBlogsSheetRow = async (id, patch) => {
    if (DEMO_MODE) {
      setDemoData(prev => ({ ...prev, blogsSheet: (prev.blogsSheet || []).map(b => b.id === id ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b) }));
      return { error: null };
    }

    const { data: updated, error } = await api.blogs.update(id, patch);
    if (!error && updated) {
      const formatted = {
        id: updated.id, contentLink: updated.content_link, reportLink: updated.report_link,
        previewLink: updated.preview_link, comment: updated.comment, remark: updated.remark, createdBy: updated.created_by,
        createdAt: updated.created_at, updatedAt: updated.updated_at
      };
      setSbData(prev => ({ ...prev, blogsSheet: (prev.blogsSheet || []).map(b => b.id === id ? formatted : b) }));
    }
    return { error };
  };

  /* ── Delete Task ── */
  const deleteTask = async (taskId) => {
    if (DEMO_MODE) {
      setDemoData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
      return { error: null };
    }
    const { error } = await api.tasks.delete(taskId);
    if (!error) {
      setSbData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
    }
    return { error };
  };

  /* ── Delete Member (cascade all data) ── */
  const deleteMember = async (userId) => {
    if (DEMO_MODE) {
      setDemoData(prev => ({
        ...prev,
        users: prev.users.filter(u => u.id !== userId),
        tasks: prev.tasks.filter(t => t.assignedTo !== userId),
        meetings: prev.meetings.map(m => ({ ...m, attendees: (m.attendees || []).filter(a => a !== userId) })),
        calendarNotes: (() => { const cn = { ...prev.calendarNotes }; delete cn[userId]; return cn; })(),
      }));
      pushNotif({ title: '🗑 Member Deleted', body: 'Member and all related data removed.', icon: '🗑' });
      return { error: null };
    }
    const { error } = await api.profiles.deleteAllData(userId);
    console.log('[deleteMember] result for', userId, '→ error:', error);
    if (!error) {
      setSbData(prev => ({
        ...prev,
        users: prev.users.filter(u => u.id !== userId),
        tasks: prev.tasks.filter(t => t.assignedTo !== userId),
        meetings: prev.meetings.map(m => ({ ...m, attendees: (m.attendees || []).filter(a => a !== userId) })),
        calendarNotes: (() => { const cn = { ...prev.calendarNotes }; delete cn[userId]; return cn; })(),
      }));
      pushNotif({ title: '🗑 Member Deleted', body: 'Member and all related data removed.', icon: '🗑' });
    } else {
      console.error('[deleteMember] FAILED:', error);
      pushNotif({ title: '❌ Delete Failed', body: error.message || 'Could not delete member. Check RLS policies.', icon: '❌' });
    }
    return { error };
  };

  return (
    <DataContext.Provider value={{
      data, setData: DEMO_MODE ? setDemoData : setSbData,
      loading, error, refreshData: loadAllData,
      updateTaskStatus, updateLoggedTime, updateTask, deleteTask, addClient,
      addTask, addMeeting, cancelMeeting,
      addBlogsSheetRow,
      updateBlogsSheetRow, addSocialPost, updateSocialPost,
      saveClientPageDetails, saveCalendarNote, getTasksByUser, getWorkloadLevel,
      markNotificationsRead, deleteMember,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
