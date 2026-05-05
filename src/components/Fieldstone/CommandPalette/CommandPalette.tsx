"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './CommandPalette.module.css';
import { Search, Map, Layers, Zap, FlaskConical, BookmarkPlus, Download, X, FileText, SlidersHorizontal } from 'lucide-react';

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'Navigation' | 'Layers' | 'Analysis' | 'Portfolio' | 'Export';
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandAction[];
}

export default function CommandPalette({ isOpen, onClose, actions }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim() === ''
    ? actions
    : actions.filter(a => {
        const q = query.toLowerCase();
        return (
          a.label.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.keywords?.some(k => k.toLowerCase().includes(q))
        );
      });

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandAction[]>>((acc, action) => {
    if (!acc[action.category]) acc[action.category] = [];
    acc[action.category].push(action);
    return acc;
  }, {});

  // Flat list for keyboard nav
  const flatList = Object.values(grouped).flat();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  const execute = useCallback((action: CommandAction) => {
    action.action();
    onClose();
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatList[selectedIdx]) {
      execute(flatList[selectedIdx]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  let flatIdx = 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Search Input */}
        <div className={styles.searchRow}>
          <Search size={16} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Search commands, layers, actions..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.escKey}>ESC</kbd>
        </div>

        <div className={styles.results}>
          {flatList.length === 0 ? (
            <div className={styles.empty}>No commands match "{query}"</div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className={styles.group}>
                <div className={styles.groupLabel}>{category.toUpperCase()}</div>
                {items.map(action => {
                  const idx = flatIdx++;
                  const isSelected = idx === selectedIdx;
                  return (
                    <button
                      key={action.id}
                      className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                      onClick={() => execute(action)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                    >
                      <span className={styles.itemIcon}>{action.icon}</span>
                      <span className={styles.itemContent}>
                        <span className={styles.itemLabel}>{action.label}</span>
                        {action.description && (
                          <span className={styles.itemDesc}>{action.description}</span>
                        )}
                      </span>
                      <kbd className={styles.itemCategory}>{action.category}</kbd>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> execute</span>
          <span><kbd>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
