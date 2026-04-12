import React, { useState } from 'react';
import { validateClientForm } from '../../lib/validators';

const CreateClientModal = ({ onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [project, setProject] = useState('');
  const [budget, setBudget] = useState('');
  const [manager, setManager] = useState('');

  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    const clientData = { name, project, budget, manager };
    const errs = validateClientForm(clientData);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onAdd({
      ...clientData,
      budget: budget || '$0',
      manager: manager || 'Unassigned',
      progress: 0,
      status: 'active'
    });
    onClose();
  };

  const lblStyle = { color: '#8890b0', fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: 6 };
  const iStyle = { background: '#1e2035', color: '#fff', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card anim-fade-in" style={{ width: 440, background: '#161829', padding: 24, borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: '#fff' }}>Add New Client</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8890b0', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group mb16">
            <label style={lblStyle}>Client Name *</label>
            <input className={`tf-input h44 ${errors.name ? 'input-error' : ''}`} style={iStyle} value={name} onChange={e => { setName(e.target.value); setErrors({}); }} autoFocus placeholder="e.g. Acme Corp" />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="form-group mb16">
            <label style={lblStyle}>Project Title *</label>
            <input className={`tf-input h44 ${errors.project ? 'input-error' : ''}`} style={iStyle} value={project} onChange={e => { setProject(e.target.value); setErrors({}); }} placeholder="e.g. Website Overhaul" />
            {errors.project && <span className="field-error">{errors.project}</span>}
          </div>
          <div className="form-group mb16">
            <label style={lblStyle}>Budget (Optional)</label>
            <input className={`tf-input h44 ${errors.budget ? 'input-error' : ''}`} style={iStyle} value={budget} onChange={e => { setBudget(e.target.value); setErrors({}); }} placeholder="e.g. $5,000" />
            {errors.budget && <span className="field-error">{errors.budget}</span>}
          </div>
          <div className="form-group mb20">
            <label style={lblStyle}>Manager Name (Optional)</label>
            <input className="tf-input h44" style={iStyle} value={manager} onChange={e => setManager(e.target.value)} placeholder="e.g. John Doe" />
          </div>
          <button type="submit" style={{ width: '100%', padding: '14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer', fontSize: '1rem' }}>Create Client</button>
        </form>
      </div>
    </div>
  );
};

export default CreateClientModal;
