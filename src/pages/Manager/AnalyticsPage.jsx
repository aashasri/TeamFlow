import React, { useState } from 'react';
import { useData } from '../../context/DataContext';

const BAR_COLORS = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#6366f1'];

const BarChart = ({ title, bars, maxVal, unit = '' }) => (
  <div className="card" style={{ padding: 20 }}>
    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 16 }}>{title}</div>
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 140 }}>
      {bars.map((b, i) => {
        const h = maxVal > 0 ? (b.value / maxVal) * 120 : 4;
        return (
          <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: '0.68rem', color: BAR_COLORS[i % BAR_COLORS.length], fontWeight: 700 }}>
              {b.value}{unit}
            </div>
            <div style={{
              width: '100%', height: Math.max(h, 4), borderRadius: '4px 4px 0 0',
              background: BAR_COLORS[i % BAR_COLORS.length] + 'cc',
              transition: 'height 0.6s ease',
            }} />
            <div style={{ fontSize: '0.62rem', color: '#8890b0', textAlign: 'center', lineHeight: 1.2 }}>{b.label}</div>
          </div>
        );
      })}
    </div>
  </div>
);

const AnalyticsPage = () => {
  const { data } = useData();
  const [dlMonth, setDlMonth] = useState(new Date().getMonth());

  const employees = data.users.filter(u => u.role === 'employee');
  const clients   = data.clients;

  // Employee stats bars
  const empBars = employees.map(emp => {
    const tasks = data.tasks.filter(t => t.assignedTo === emp.id);
    const done  = tasks.filter(t => t.status === 'done').length;
    return { label: emp.name.split(' ')[0], value: tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0 };
  });

  // Client progress bars
  const clientBars = clients.map(c => ({ label: c.name.split(' ')[0], value: c.progress }));

  // Budget data per client  
  const budgetBars = clients.map(c => ({
    label: c.name.split(' ')[0],
    value: parseInt((c.budget || '$0').replace(/[^0-9]/g, ''), 10) / 1000,
  }));

  // Month-wise budget (simulated per month)
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const downloadBudget = () => {
    const rows = [
      ['Client', 'Project', 'Budget', 'Progress', 'Status'],
      ...clients.map(c => [c.name, c.project, c.budget, `${c.progress}%`, c.status]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `budget-${MONTHS[dlMonth]}-2026.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const DEPT_COLORS = {
    'Social Media': '#0ea5e9', 'SEO': '#10b981', 'Web Dev': '#f59e0b',
    'Ads': '#ef4444', 'Blogs': '#ec4899', 'Reports': '#6366f1',
  };

  return (
    <div className="anim-fade-in">
      <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 20 }}>Analytics</div>

      {/* Charts row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <BarChart
          title="Employee Task Completion (%)"
          bars={empBars}
          maxVal={100}
          unit="%"
        />
        <BarChart
          title="Client Project Progress (%)"
          bars={clientBars}
          maxVal={100}
          unit="%"
        />
      </div>

      {/* Budget tracking */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Budget Tracking — Per Client</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={dlMonth}
              onChange={e => setDlMonth(Number(e.target.value))}
              style={{ background: '#1e2035', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: '0.78rem' }}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m} 2026</option>)}
            </select>
            <button onClick={downloadBudget}
              style={{ padding: '7px 14px', borderRadius: 8, background: '#10b981', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              Download CSV
            </button>
          </div>
        </div>

        {/* Budget table */}
        <table className="tf-table" style={{ marginBottom: 0 }}>
          <thead>
            <tr><th>Client</th><th>Project</th><th>Budget</th><th>Spent %</th><th>Status</th></tr>
          </thead>
          <tbody>
            {clients.map((c, i) => {
              const spentPct = Math.round(c.progress * 0.9);
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>{c.name}</td>
                  <td style={{ color: '#8890b0' }}>{c.project}</td>
                  <td style={{ fontWeight: 700, color: '#10b981' }}>{c.budget}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
                        <div style={{ height: '100%', width: `${spentPct}%`, background: BAR_COLORS[i % BAR_COLORS.length], borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#8890b0', minWidth: 28 }}>{spentPct}%</span>
                    </div>
                  </td>
                  <td><span style={{ background: c.status === 'active' ? '#10b98122' : '#f59e0b22', color: c.status === 'active' ? '#10b981' : '#f59e0b', padding: '3px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700 }}>{c.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Department performance */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 16 }}>Department Performance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
          {data.departments.map(dept => {
            const color = DEPT_COLORS[dept.name] || '#7c3aed';
            return (
              <div key={dept.id} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>{dept.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#8890b0', marginBottom: 10 }}>Head: {dept.head}</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${dept.performance}%`, background: color, borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: '0.72rem', color, fontWeight: 700 }}>{dept.performance}% efficiency</div>
                <div style={{ fontSize: '0.68rem', color: '#8890b0', marginTop: 4 }}>{dept.completed}/{dept.tasks} tasks done</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
