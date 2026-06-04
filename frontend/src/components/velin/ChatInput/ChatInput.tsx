import { useState, type KeyboardEvent } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  onPlus?: () => void;
  onMic?: () => void;
  placeholder?: string;
}

export default function ChatInput({ onSend, onPlus, onMic, placeholder = '说点什么…' }: ChatInputProps) {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.root}>
      <button className={styles['icon-btn']} aria-label="附件" onClick={onPlus}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div className={styles.field}>
        <input
          className={styles['field-input']}
          placeholder={placeholder}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
        />
      </div>
      <button className={styles['icon-btn']} aria-label="语音" onClick={onMic}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
        </svg>
      </button>
      <button
        className={[styles['icon-btn'], styles.send].join(' ')}
        aria-label="发送"
        onClick={submit}
        disabled={text.trim().length === 0}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12l14-7-6 16-2-7-6-2z" />
        </svg>
      </button>
    </div>
  );
}
