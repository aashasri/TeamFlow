import React, { useState } from 'react';

const NotepadPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState(() => localStorage.getItem('tf_note') || '');

  const handleChange = (e) => {
    setNote(e.target.value);
    localStorage.setItem('tf_note', e.target.value);
  };

  return (
    <>
      <div className="notepad-btn" onClick={() => setIsOpen(!isOpen)}>📝</div>
      <div className={`notepad-panel ${isOpen ? 'open' : ''}`}>
        <div className="notepad-header">
          <h3>Quick Notepad</h3>
          <button className="btn-icon" onClick={() => setIsOpen(false)}>✖</button>
        </div>
        <div className="notepad-body">
          <textarea 
            placeholder="Jot down quick thoughts..."
            value={note}
            onChange={handleChange}
          />
        </div>
      </div>
    </>
  );
};

export default NotepadPanel;
