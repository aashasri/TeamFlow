import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../../context/DataContext';

const TimerWidget = ({ activeTask }) => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const { setData } = useData();
  const timerRef = useRef(null);

  useEffect(() => {
    if (activeTask) {
      setSeconds(activeTask.loggedSeconds || 0);
    } else {
      setSeconds(0);
      setIsActive(false);
    }
  }, [activeTask]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const saveTime = () => {
    if (activeTask) {
      setData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === activeTask.id ? { ...t, loggedSeconds: seconds } : t)
      }));
    }
  };

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      if (seconds > 0) saveTime();
    }
    return () => {
      clearInterval(timerRef.current);
      // 🔥 CRITICAL: Save current seconds even on unmount (Sign Out)
      if (isActive && seconds > 0) saveTime();
    };
  }, [isActive, seconds, activeTask, saveTime]);

  const fmtTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div className="timer-display" style={{ fontSize: '42px', fontWeight: 800, background: 'linear-gradient(135deg,var(--accent),var(--blue))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        {fmtTime(seconds)}
      </div>
      <div className="timer-label" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>LOGGED TIME</div>
      <div className="timer-task-name" style={{ fontSize: '13px', fontWeight: 600, margin: '16px 0', minHeight: '20px' }}>
        {activeTask ? activeTask.title : 'No active task'}
      </div>
      <div className="timer-btns" style={{ display: 'flex', gap: '10px' }}>
        <button className={`btn ${isActive ? 'btn-red' : 'btn-primary'}`} 
                onClick={toggleTimer} disabled={!activeTask}>
          {isActive ? '⏹ Stop' : '▶ Start'}
        </button>
        <button className="btn btn-ghost" onClick={() => setSeconds(0)} disabled={!activeTask}>🔄 Reset</button>
      </div>
    </div>
  );
};

export default TimerWidget;
