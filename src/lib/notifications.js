/**
 * TeamFlow Notification System
 * - Browser push notifications (with permission request)
 * - Scheduled meeting reminders (15 min / 5 min / on time)
 * - In-app notification store (appended to data._notifications)
 */

import { supabase } from './supabase';

let _addNotif = null; // callback set by DataContext

export const registerNotifAdder = (fn) => { _addNotif = fn; };

/* ── Pleasant two-tone chime notification sound ── */
const playNotifSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, startTime, duration) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    // Two-tone ascending chime: C5 → G5 (More distinct)
    play(523.25, ctx.currentTime,        0.15); // C5
    play(783.99, ctx.currentTime + 0.12, 0.4);  // G5
  } catch(e) {}
};

export const pushNotif = (notifData) => {
  const { title, body, icon = '📣', tag, userId, role_target } = notifData;
  const notif = {
    id:    Date.now() + Math.random(),
    title, body, icon,
    time:  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    read:  false,
    userId
  };

  if (_addNotif) _addNotif(notif);
  
  // Persist to DB if for another user (or current user in real mode)
  const isDemo = localStorage.getItem('tf_demo_mode') === 'true';
  if (!isDemo) {
    supabase.from('notifications').insert({
      user_id: userId || null,
      role_target: role_target || null,
      title,
      body,
      icon,
    }).then();
  }
  
  playNotifSound();

  // Browser notification
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, tag, icon: '/favicon.ico' });
  }
};

export const requestNotifPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

/* ── Meeting reminder scheduler ── */
const scheduledReminders = new Set();

export const scheduleMeetingReminders = (meeting) => {
  const key = meeting.id;
  if (scheduledReminders.has(key)) return;
  scheduledReminders.add(key);

  const [h, m] = meeting.time.split(':').map(Number);
  const meetStart = new Date(meeting.date + 'T00:00:00');
  meetStart.setHours(h, m, 0, 0);

  const now = Date.now();
  const reminders = [
    { offsetMs: -15 * 60 * 1000, label: 'in 15 minutes' },
    { offsetMs:  -5 * 60 * 1000, label: 'in 5 minutes'  },
    { offsetMs:             0,    label: 'is starting NOW' },
  ];

  reminders.forEach(({ offsetMs, label }) => {
    const fireAt = meetStart.getTime() + offsetMs;
    const delay  = fireAt - now;
    if (delay > 0) {
      setTimeout(() => {
        pushNotif({
          title: `🤝 Meeting ${label}`,
          body:  `"${meeting.title}" — ${meeting.time}`,
          icon:  '🤝',
          tag:   `${key}-${offsetMs}`,
        });
      }, delay);
    }
  });
};

export const notifTemplates = {
  taskAssigned: (taskTitle, assigneeName, targetUserId) => ({
    userId: targetUserId,
    title: '📋 New Task Assigned',
    body:  `"${taskTitle}" has been assigned to you.`,
    icon:  '📋',
  }),
  taskCompleted: (taskTitle, employeeName) => ({
    role_target: 'manager',
    title: '✅ Task Completed',
    body:  `${employeeName} completed "${taskTitle}". Ready for review.`,
    icon:  '✅',
  }),
  taskStatusUpdate: (taskTitle, status, employeeName) => ({
    role_target: 'manager',
    title: '🔄 Task Updated',
    body:  `${employeeName} marked "${taskTitle}" as ${status}.`,
    icon:  '🔄',
  }),
  taskStarted: (taskTitle, employeeName) => ({
    role_target: 'manager',
    title: '⚡ Employee Working',
    body:  `${employeeName} started working on "${taskTitle}".`,
    icon:  '⚡',
  }),
  meetingScheduled: (meetingTitle, time, targetUserId) => ({
    userId: targetUserId,
    title: '📅 Meeting Scheduled',
    body:  `You've been added to "${meetingTitle}" at ${time}.`,
    icon:  '📅',
  }),
  remarkAdded: (title, remark, userId) => ({
    userId,
    title: '💬 Remark is saved',
    body: `On "${title}": "${remark}"`,
    icon: '💬'
  }),
  proceedConfirmed: (title, userId) => ({
    userId,
    title: '✅ Manager Approved',
    body: `"${title}" — Proceed to it.`,
    icon: '🚀'
  }),
  taskMarkedCompleted: (title, userId) => ({
    userId,
    title: '🏁 Task Completed',
    body: `"${title}" has been marked as completed by the manager.`,
    icon: '🏁'
  }),
  meetingCanceled: (meetingTitle, attendeeId) => ({
    userId: attendeeId,
    title: '📅 Meeting Canceled',
    body: `"${meetingTitle}" has been canceled.`,
    icon: '❌'
  }),
  socialLinkPosted: (contentTheme) => ({
    role_target: 'manager',
    title: '📱 Social Post Published',
    body:  `"${contentTheme}" has been published. Link updated in Social Calendar.`,
    icon:  '📱',
  }),
  clientSocialUpdate: (contentTheme, clientName, targetUserId) => ({
    userId: targetUserId,
    title: '🔗 New Post for Your Page',
    body:  `A new post "${contentTheme}" has been published for ${clientName}. Check your Social Calendar.`,
    icon:  '🔗',
  }),
  clientTaskCompleted: (taskTitle, taskDesc, targetUserId) => ({
    userId: targetUserId,
    title: '🎉 Project Task Completed',
    body: `Task "${taskTitle}" has been fully completed! Details: ${taskDesc ? taskDesc.slice(0, 50) + '...' : 'No additional details provided.'}`,
    icon: '🎉'
  }),
  emergencyReassignRequested: (taskTitle, employeeName, reason) => ({
    role_target: 'manager',
    title: '🚨 Emergency Reassign Requested',
    body: `${employeeName} requested reassignment for "${taskTitle}". Reason: "${reason}"`,
    icon: '🚨'
  }),
};
