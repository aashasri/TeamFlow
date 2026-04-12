import { supabase } from '../lib/supabase';

/**
 * TeamFlow REST-like API Service
 * Centralizes all Supabase mutations and queries.
 */
const api = {
  tasks: {
    async getAll() {
      return await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    },
    async create(task) {
      const id = 't' + Date.now();
      const res = await supabase.from('tasks').insert({
        id,
        title: task.title.trim(),
        "desc": task.desc?.trim(),
        assigned_to: task.assignedTo || null, // Ensure null if empty
        assigned_name: task.assignedName,
        dept: task.dept || null,
        client_id: task.clientId || null, // CRITICAL: Fix for "Submit button not functioning"
        priority: task.priority || 'medium',
        status: 'todo',
        deadline: task.deadline,
        scheduled_time: task.scheduledTime || null,
        logged_seconds: 0
      });
      if (res.error) console.error('Supabase Task Create Error:', res.error);
      return res;
    },
    async update(id, patch) {
      return await supabase.from('tasks').update(patch).eq('id', id);
    },
    async delete(id) {
      return await supabase.from('tasks').delete().eq('id', id);
    },
    async deleteByUser(userId) {
      return await supabase.from('tasks').delete().eq('assigned_to', userId);
    }
  },

  clients: {
    async getAll() {
      return await supabase.from('clients').select('*').order('name');
    },
    async create(client) {
      const id = 'cl' + Date.now();
      const res = await supabase.from('clients').insert({
        id,
        name: client.name.trim(),
        project: client.project?.trim(),
        budget: client.budget || '$0',
        manager: client.manager || 'Unassigned',
        progress: 0,
        status: 'active'
      });
      if (res.error) console.error('Supabase Client Create Error:', res.error);
      return res;
    },
    async update(id, patch) {
      return await supabase.from('clients').update(patch).eq('id', id);
    }
  },

  meetings: {
    async getAll() {
      // ⚡ CONSOLIDATION: Fetch meetings with their attendees in one request
      return await supabase.from('meetings').select('*, meeting_attendees(user_id)').order('date');
    },
    async create(meeting) {
      const id = 'm' + Date.now();
      const res = await supabase.from('meetings').insert({
        id,
        title: meeting.title.trim(),
        date: meeting.date,
        time: meeting.time,
        type: meeting.type || 'internal',
        client_id: meeting.clientId || null,
        status: 'scheduled',
        "desc": meeting.desc || '',
        link: meeting.link || ''
      });
      if (!res.error && meeting.attendees?.length) {
        await supabase.from('meeting_attendees').insert(
          meeting.attendees.map(uid => ({ meeting_id: id, user_id: uid }))
        );
      }
      return res;
    },
    async cancel(id) {
      const res = await supabase.from('meetings').update({ status: 'canceled' }).eq('id', id);
      if (res.error) console.error('Supabase Meeting Cancel Error:', res.error);
      return res;
    }
  },

  social: {
    async getAllPosts() {
      return await supabase
        .from('social_posts')
        .select('*')
        .order('publish_date', { ascending: false })
        .limit(100);
    },
    async createPost(post) {
      const id = 'sp' + Date.now();
      return await supabase.from('social_posts').insert({
        id,
        client_id: post.clientId,
        content_theme: post.contentTheme.trim(),
        content_type: post.contentType,
        publish_date: post.publishDate,
        time: post.time,
        boost: post.boost || 'No',
        budget: post.budget || '$0',
        status: post.status || 'Draft',
        links: post.links || {},
        preview_link: post.previewLink || ''
      });
    },
    async updatePost(id, patch) {
      return await supabase.from('social_posts').update(patch).eq('id', id);
    },
    async savePageDetails(clientId, platform, details) {
      return await supabase.from('client_page_details').upsert({
        client_id: clientId,
        platform: platform,
        details: details
      }, { onConflict: 'client_id,platform' });
    },
    async getPageDetails() {
      return await supabase.from('client_page_details').select('*');
    }
  },

  profiles: {
    async getAll() {
      return await supabase.from('profiles').select('*').order('name');
    },
    async getOwnNotes(userId) {
      return await supabase.from('calendar_notes').select('*').eq('user_id', userId);
    },
    async saveNote(userId, dateKey, note) {
      return await supabase.from('calendar_notes').upsert({
        user_id: userId,
        date_key: dateKey,
        note
      }, { onConflict: 'user_id,date_key' });
    },
    async delete(userId) {
      return await supabase.from('profiles').delete().eq('id', userId);
    },
    async deleteAllData(userId) {
      // Delete all related data for a member
      const results = await Promise.allSettled([
        supabase.from('tasks').delete().eq('assigned_to', userId),
        supabase.from('meeting_attendees').delete().eq('user_id', userId),
        supabase.from('calendar_notes').delete().eq('user_id', userId),
        supabase.from('notifications').delete().eq('user_id', userId),
        supabase.from('login_track').delete().eq('user_id', userId),
      ]);
      // Finally delete the profile itself
      const profileRes = await supabase.from('profiles').delete().eq('id', userId);
      return profileRes;
    }
  },

  tracking: {
    async updateDailySeconds(userId, date, seconds) {
      return await supabase.from('login_track').upsert({
        user_id: userId,
        date: date,
        total_seconds: seconds,
        last_sync: new Date().toISOString()
      }, { onConflict: 'user_id,date' });
    },
    async getDailySeconds(userId, date) {
      return await supabase.from('login_track').select('total_seconds').eq('user_id', userId).eq('date', date).single();
    }
  },

  notifications: {
    async getAll(userId) {
      return await supabase
        .from('notifications')
        .select('*')
        .or(`user_id.eq.${userId},role_target.is.not.null`)
        .order('created_at', { ascending: false })
        .limit(100);
    },
    async create(notif) {
      return await supabase.from('notifications').insert({
        user_id: notif.userId,
        title: notif.title,
        body: notif.body,
        icon: notif.icon || '📣'
      });
    },
    async markRead(id) {
      return await supabase.from('notifications').update({ read: true }).eq('id', id);
    },
    async markAllRead(userId) {
      return await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
    }
  },

  blogs: {
    async getAll() {
      return await supabase.from('blogs_sheet').select('*').order('created_at', { ascending: false });
    },
    async create(row) {
      return await supabase.from('blogs_sheet').insert({
        content_link: row.contentLink || '',
        report_link: row.reportLink || '',
        preview_link: row.previewLink || '',
        comment: row.comment || '',
        remark: row.remark || '',
        created_by: row.createdBy
      }).select().single();
    },
    async update(id, patch) {
      const dbPatch = {};
      if (patch.contentLink !== undefined) dbPatch.content_link = patch.contentLink;
      if (patch.reportLink !== undefined) dbPatch.report_link = patch.reportLink;
      if (patch.previewLink !== undefined) dbPatch.preview_link = patch.previewLink;
      if (patch.comment !== undefined) dbPatch.comment = patch.comment;
      if (patch.remark !== undefined) dbPatch.remark = patch.remark;
      
      return await supabase.from('blogs_sheet').update(dbPatch).eq('id', id).select().single();
    }
  }
};

export default api;
