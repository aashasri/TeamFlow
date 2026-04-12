/** Pure validation helpers — return null on pass, error string on fail. */

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateEmail = (v) => {
  if (!v?.trim()) return 'Email is required';
  if (!emailRe.test(v)) return 'Invalid email format';
  return null;
};

export const validatePassword = (v, strict = false) => {
  if (!v) return 'Password is required';
  if (v.length < 8) return 'Password must be at least 8 characters';
  if (strict && !/[A-Z]/.test(v)) return 'Must contain at least one uppercase letter';
  if (strict && !/[0-9]/.test(v)) return 'Must contain at least one number';
  return null;
};

export const validateRequired = (v, label = 'This field') => {
  if (!v?.toString().trim()) return `${label} is required`;
  return null;
};

/** Validate the assign-task form. Returns { field: errorMsg } object (empty = valid). */
export const validateTaskForm = (t) => {
  const e = {};
  if (!t.title?.trim())             e.title      = 'Task title is required';
  else if (t.title.trim().length < 3) e.title    = 'Title must be at least 3 characters';
  
  if (!t.assignedTo)                e.assignedTo = 'Assign a team member';
  if (!t.clientId)                  e.clientId   = 'Select a client account';
  
  if (!t.deadline)                  e.deadline   = 'Deadline is required';
  else if (new Date(t.deadline) < new Date(new Date().toDateString()))
                                    e.deadline   = 'Deadline cannot be in the past';
  
  if (!t.desc?.trim())              e.desc       = 'Description is required';
  else if (t.desc.trim().length < 5)  e.desc     = 'Provide a more detailed description';
  return e;
};

/** Validate meeting form. */
export const validateMeetingForm = (m) => {
  const e = {};
  if (!m.title?.trim()) e.title = 'Title is required';
  if (!m.date)          e.date  = 'Date is required';
  if (!m.time)          e.time  = 'Time is required';
  return e;
};

/** Validate credential creation form. */
export const validateCredentialForm = (f) => {
  const e = {};
  const emailErr    = validateEmail(f.email);
  const passwordErr = validatePassword(f.password, true);
  if (emailErr)              e.email    = emailErr;
  if (passwordErr)           e.password = passwordErr;
  if (!f.name?.trim())       e.name     = 'Full name is required';
  if (!f.role)               e.role     = 'Role is required';
  if (f.role === 'employee' && !f.dept) e.dept = 'Department is required';
  if (f.role === 'client'   && !f.clientAccountId) e.clientAccountId = 'Client account is required';
  return e;
};

/** Returns password strength { score 0-5, label, color }. */
export const getPasswordStrength = (p) => {
  if (!p) return { score: 0, label: '', color: '' };
  let s = 0;
  if (p.length >= 8)           s++;
  if (p.length >= 12)          s++;
  if (/[A-Z]/.test(p))         s++;
  if (/[0-9]/.test(p))         s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  if (s <= 1) return { score: s, label: 'Weak',        color: '#ef4444' };
  if (s <= 3) return { score: s, label: 'Fair',        color: '#f59e0b' };
  if (s === 4) return { score: s, label: 'Strong',     color: '#10b981' };
  return            { score: s, label: 'Very Strong', color: '#7c3aed' };
};

/** Validate social post creation. */
export const validateSocialPostForm = (p) => {
  const e = {};
  if (!p.contentTheme?.trim()) e.contentTheme = 'Content theme is required';
  if (!p.contentType)          e.contentType  = 'Select content type';
  if (!p.publishDate)          e.publishDate  = 'Publish date is required';
  if (p.budget && isNaN(p.budget.replace('$', '').trim())) e.budget = 'Budget must be a number';
  return e;
};

/** Validate client creation. */
export const validateClientForm = (c) => {
  const e = {};
  if (!c.name?.trim())    e.name    = 'Client name is required';
  if (!c.project?.trim()) e.project = 'Project name is required';
  if (c.budget && !c.budget.startsWith('$')) e.budget = 'Budget should start with $';
  return e;
};
