import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ activePage, timeTrack }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false);
  }, [activePage]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  if (!user) return null;

  const isSocialMediaEmp = user.role === 'employee' && user.dept === 'Social Media';

  const getNavItems = () => {
    switch (user.role) {
      case 'manager':
        return [
          { section: 'OVERVIEW',  items: [
            { id: 'overview',      icon: '', label: 'Dashboard'        },
            { id: 'clients',       icon: '', label: 'Clients'           },
            { id: 'workload',      icon: '', label: 'Employee Details'  },
          ]},
          { section: 'WORK',  items: [
            { id: 'tasks',         icon: '', label: 'Tasks'             },
            { id: 'planner',       icon: '', label: 'Monthly Planner'   },
            { id: 'meetings',      icon: '', label: 'Meetings'          },
            { id: 'social-cal',    icon: '', label: 'Social Calendar'   },
            { id: 'blogs-sheet',   icon: '', label: 'Bloog Sheet'       },
          ]},
          { section: 'ANALYTICS', items: [
            { id: 'reports',       icon: '', label: 'Analytics'         },
            { id: 'team-access',   icon: '', label: 'Team Access'       },
          ]},
        ];
      case 'employee':
        return [
          { section: 'WORK', items: [
            { id: 'tasks',      icon: '', label: 'Current Tasks' },
            { id: 'tasks-todo',       icon: '', label: 'To Do'             },
            { id: 'tasks-inprogress', icon: '', label: 'In Progress'       },
            { id: 'tasks-review',     icon: '', label: 'Awaiting Review'   },
            { id: 'tasks-done',       icon: '', label: 'Completed'         },
            { id: 'calendar',   icon: '', label: 'My Calendar'   },
            { id: 'meetings',   icon: '', label: 'Meetings'      },
            ...(isSocialMediaEmp ? [{ id: 'social-cal', icon: '', label: 'Social Calendar' }] : []),
            ...(user.dept === 'Blogs' ? [{ id: 'blogs-sheet', icon: '', label: 'Bloog Sheet' }] : []),
            { id: 'capacity',   icon: '', label: 'Performance'   },
          ]},
        ];
      case 'client':
        return [
          { section: 'CLIENT', items: [
            { id: 'overview',  icon: '', label: 'Project Overview' },
            { id: 'meetings',  icon: '', label: 'My Meetings'      },
            { id: 'reports',   icon: '', label: 'My Reports'       },
            { id: 'feedback',  icon: '', label: 'Feedback'         },
          ]},
        ];
      default: return [];
    }
  };

  const sections = getNavItems();

  const handleNav = (itemId) => {
    navigate(`/${user.role}/${itemId}`);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile hamburger button — fixed top-left */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Toggle menu"
      >
        <span className={`hamburger-icon ${mobileOpen ? 'open' : ''}`}>
          <span /><span /><span />
        </span>
      </button>

      {/* Overlay backdrop */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">🌊</div>
          <div className="logo-text">TeamFlow</div>
        </div>

        <div className="sidebar-user">
          <div className="avatar">{user.avatar}</div>
          <div className="user-info">
            <div className="name">{user.name}</div>
            <div className="role" style={{ textTransform: 'capitalize' }}>{user.role}{isSocialMediaEmp ? ' · SM' : ''}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map(({ section, items }) => (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {timeTrack && (
            <div style={{ padding: '0 20px 10px', fontSize: '0.72rem', color: '#8890b0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
              Logged today: <strong style={{ color: '#fff' }}>{timeTrack}</strong>
            </div>
          )}
          <button onClick={logout} className="btn-logout">
            <span></span> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

