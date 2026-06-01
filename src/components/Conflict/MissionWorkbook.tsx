'use client';

import { useState } from 'react';
import { Plus, Trash2, Download, FileText, Clock } from 'lucide-react';
import styles from './MissionWorkbook.module.css';

interface Note {
  id: string;
  timestamp: string;
  content: string;
  author: string;
}

interface Investigation {
  id: string;
  name: string;
  createdAt: string;
  pinned: string[];
  notes: Note[];
}

const STORAGE_KEY = 'atlaslayer_workbook';

function loadInvestigations(): Investigation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveInvestigations(invs: Investigation[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invs));
  }
}

export function MissionWorkbook() {
  const [investigations, setInvestigations] = useState<Investigation[]>(() => loadInvestigations());
  const [activeId, setActiveId] = useState<string | null>(investigations[0]?.id ?? null);
  const [newName, setNewName] = useState('');
  const [noteText, setNoteText] = useState('');
  const [authorId] = useState(() => `ANALYST-${Math.random().toString(36).slice(2,6).toUpperCase()}`);

  const active = investigations.find(i => i.id === activeId) ?? null;

  function createInvestigation() {
    const name = newName.trim() || `Investigation ${investigations.length + 1}`;
    const inv: Investigation = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      pinned: [],
      notes: [],
    };
    const updated = [...investigations, inv];
    setInvestigations(updated);
    saveInvestigations(updated);
    setActiveId(inv.id);
    setNewName('');
  }

  function deleteInvestigation(id: string) {
    const updated = investigations.filter(i => i.id !== id);
    setInvestigations(updated);
    saveInvestigations(updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
  }

  function addNote() {
    if (!noteText.trim() || !active) return;
    const note: Note = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      content: noteText.trim(),
      author: authorId,
    };
    const updated = investigations.map(i =>
      i.id === active.id ? { ...i, notes: [...i.notes, note] } : i
    );
    setInvestigations(updated);
    saveInvestigations(updated);
    setNoteText('');
  }

  function deleteNote(noteId: string) {
    if (!active) return;
    const updated = investigations.map(i =>
      i.id === active.id ? { ...i, notes: i.notes.filter(n => n.id !== noteId) } : i
    );
    setInvestigations(updated);
    saveInvestigations(updated);
  }

  function exportPDF() {
    if (!active) return;
    const content = [
      `ATLASLAYER INTELLIGENCE WORKBOOK`,
      `Classification: UNCLASSIFIED // FOR DEMO USE`,
      `Investigation: ${active.name}`,
      `Created: ${new Date(active.createdAt).toLocaleString()}`,
      `Exported: ${new Date().toLocaleString()}`,
      `Operator: ${authorId}`,
      ``,
      `== ANALYST NOTES (${active.notes.length}) ==`,
      ...active.notes.map(n =>
        `[${new Date(n.timestamp).toLocaleString()}] ${n.author}\n${n.content}`
      ),
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workbook_${active.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <FileText size={12} style={{ color: '#00d4ff' }} />
          <span>INVESTIGATIONS</span>
        </div>

        <div className={styles.invList}>
          {investigations.map(inv => (
            <div
              key={inv.id}
              className={`${styles.invItem} ${activeId === inv.id ? styles.invItemActive : ''}`}
              onClick={() => setActiveId(inv.id)}
            >
              <span className={styles.invName}>{inv.name}</span>
              <button
                className={styles.invDelete}
                onClick={e => { e.stopPropagation(); deleteInvestigation(inv.id); }}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>

        <div className={styles.newInv}>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="New investigation name…"
            className={styles.newInvInput}
            onKeyDown={e => { if (e.key === 'Enter') createInvestigation(); }}
          />
          <button className={styles.newInvBtn} onClick={createInvestigation}>
            <Plus size={12} />
          </button>
        </div>
      </div>

      <div className={styles.main}>
        {!active ? (
          <div className={styles.empty}>
            <FileText size={28} style={{ color: '#1e2a3a' }} />
            <span>Create an investigation to begin</span>
          </div>
        ) : (
          <>
            <div className={styles.mainHeader}>
              <div>
                <div className={styles.invTitle}>{active.name}</div>
                <div className={styles.invMeta}>
                  Created {new Date(active.createdAt).toLocaleDateString()} · {active.notes.length} notes · {authorId}
                </div>
              </div>
              <button className={styles.exportBtn} onClick={exportPDF}>
                <Download size={12} /> Export
              </button>
            </div>

            <div className={styles.notes}>
              {active.notes.length === 0 ? (
                <div className={styles.notesEmpty}>No notes yet — add analyst observations below.</div>
              ) : (
                active.notes.map(note => (
                  <div key={note.id} className={styles.note}>
                    <div className={styles.noteMeta}>
                      <Clock size={10} />
                      <span>{new Date(note.timestamp).toLocaleString()}</span>
                      <span className={styles.noteAuthor}>{note.author}</span>
                      <button
                        className={styles.noteDelete}
                        onClick={() => deleteNote(note.id)}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                    <div className={styles.noteContent}>{note.content}</div>
                  </div>
                ))
              )}
            </div>

            <div className={styles.noteInput}>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder={`Add analyst note… (${authorId})`}
                className={styles.noteTextarea}
                rows={3}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
              />
              <button className={styles.addNoteBtn} onClick={addNote}>
                <Plus size={12} /> Add Note
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
