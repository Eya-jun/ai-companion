import type { CSSProperties, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../Avatar';
import styles from './CharacterCard.module.css';
import { type ThemeKey, themeFor } from '../../../theme/characterThemes';

interface CharacterCardProps {
  id: string;
  name: string;
  tagline?: string;
  preview: string;
  time: string;
  unread?: number;
  online?: boolean;
  style?: CSSProperties;
}

export default function CharacterCard({
  id, name, tagline, preview, time, unread = 0, online = false, style,
}: CharacterCardProps) {
  const navigate = useNavigate();
  const theme: ThemeKey = themeFor(name);
  const firstChar = name.charAt(0);

  const handleAvatarClick = (e: MouseEvent) => {
    e.stopPropagation();
    navigate(`/character/${id}`);
  };

  return (
    <div
      className={[styles.root, styles[`theme-${theme}`]].join(' ')}
      style={style}
      onClick={() => navigate(`/chat/${id}`)}
      role="button"
      data-online={online}
    >
      <Avatar
        theme={theme}
        label={firstChar}
        size="lg"
        onClick={handleAvatarClick}
        ariaLabel={`查看 ${name} 资料卡`}
      />
      <div className={styles.meta}>
        <div className={styles.top}>
          <span className={styles.name}>{name}</span>
          {tagline && <span className={styles.tag}>{tagline}</span>}
          <span className={styles.time}>{time}</span>
        </div>
        <div className={styles.bottom}>
          <span className={styles.preview}>{preview}</span>
          {unread > 0 && <span className={styles.unread}>{unread}</span>}
        </div>
      </div>
    </div>
  );
}
