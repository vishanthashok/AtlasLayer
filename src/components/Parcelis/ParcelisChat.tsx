"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { ChatMessage, AIAnalysisResult } from '../../models/types';
import styles from './ParcelisChat.module.css';
import { Send, MessageSquare, Cpu, XCircle, BarChart2 } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  analysisResult: AIAnalysisResult | null;
}

export default function ParcelisChat({ analysisResult }: Props) {
  const { chatHistory, addChatMessage, clearChatHistory } = useStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    addChatMessage(userMessage);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Send messages as raw text to backend to save tokens, the backend expects objects though
      const response = await fetch('/api/parcelis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatHistory, userMessage],
          context: analysisResult,
          model: useStore.getState().aiModel
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // The backend now returns a JSON string in data.reply
      let parsedContent;
      try {
        parsedContent = JSON.parse(data.reply);
      } catch (e) {
        // Fallback if parsing fails on frontend
        parsedContent = { text: data.reply };
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.reply, // Store raw string for history
        parsedContent: parsedContent, // Store parsed object for rendering
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      addChatMessage(assistantMessage);
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'An error occurred while communicating with Parcelis.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.role === 'user') {
      return <div className={styles.messageText}>{msg.content}</div>;
    }

    // Try to parse if we don't have parsedContent (for backward compatibility)
    let parsed = msg.parsedContent;
    if (!parsed) {
      try {
        parsed = JSON.parse(msg.content);
      } catch (e) {
        return <div className={styles.messageText}>{msg.content}</div>;
      }
    }

    return (
      <div className={styles.structuredMessage}>
        <div className={styles.messageText} dangerouslySetInnerHTML={{ __html: parsed?.text?.replace(/\n/g, '<br/>') || '' }} />
        
        {parsed?.graph && parsed.graph.data && parsed.graph.data.length > 0 && (
          <div className={styles.graphContainer} style={{ marginTop: '15px', height: '200px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(74, 158, 255, 0.2)' }}>
            <div style={{ fontSize: '0.7rem', color: '#4a9eff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <BarChart2 size={12} />
              {parsed.graph.title || 'Data Visualization'}
            </div>
            <ResponsiveContainer width="100%" height="85%">
              {parsed.graph.type === 'line' ? (
                <LineChart data={parsed.graph.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey={parsed.graph.xAxisKey} stroke="#cbd5e1" fontSize={10} />
                  <YAxis stroke="#cbd5e1" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#0a1828', border: '1px solid #4a9eff', borderRadius: '4px', fontSize: '0.8rem' }} />
                  <Line type="monotone" dataKey={parsed.graph.yAxisKey} stroke="#4a9eff" strokeWidth={2} dot={{ r: 4, fill: '#4a9eff' }} />
                </LineChart>
              ) : (
                <BarChart data={parsed.graph.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey={parsed.graph.xAxisKey} stroke="#cbd5e1" fontSize={10} />
                  <YAxis stroke="#cbd5e1" fontSize={10} />
                  <Tooltip contentStyle={{ background: '#0a1828', border: '1px solid #4a9eff', borderRadius: '4px', fontSize: '0.8rem', color: '#fff' }} itemStyle={{ color: '#4a9eff' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey={parsed.graph.yAxisKey} fill="#4a9eff" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <MessageSquare size={14} />
        <span>PARCELIS · CHAT</span>
        {chatHistory.length > 0 && (
          <button 
            onClick={clearChatHistory} 
            className={styles.clearBtn}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.65rem' }}
          >
            CLEAR
          </button>
        )}
      </div>

      <div className={styles.messageList}>
        {chatHistory.length === 0 && !isLoading && (
          <div className={styles.emptyState}>
            <Cpu size={32} className={styles.emptyIcon} />
            <p>Ask questions about the property analysis, market trends, or development constraints.</p>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} className={`${styles.message} ${styles[msg.role]}`}>
            {renderMessageContent(msg)}
            <span className={styles.timestamp}>{msg.timestamp}</span>
          </div>
        ))}

        {isLoading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.loadingDots}>
              <div className={styles.dot} />
              <div className={styles.dot} />
              <div className={styles.dot} />
            </div>
          </div>
        )}

        {error && (
          <div className={styles.errorBanner} style={{ color: '#ef4444', fontSize: '0.75rem', padding: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <XCircle size={12} />
            <span>{error}</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a follow-up question... (e.g. 'Show me a graph of...')"
          className={styles.input}
          disabled={isLoading || !analysisResult}
        />
        <button 
          type="submit" 
          className={styles.sendBtn} 
          disabled={isLoading || !input.trim() || !analysisResult}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
