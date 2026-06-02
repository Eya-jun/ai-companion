interface Props {
  value: 'easy' | 'normal' | 'hard';
  onChange: (v: 'easy' | 'normal' | 'hard') => void;
}

const OPTIONS = [
  { value: 'easy' as const, label: '💚 简单', desc: '好感度涨得快' },
  { value: 'normal' as const, label: '💛 普通', desc: '正常节奏' },
  { value: 'hard' as const, label: '❤️ 困难', desc: '需要长期培养' },
];

export default function DifficultySelector({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {OPTIONS.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: `2px solid ${value === opt.value ? '#FF6B9D' : 'transparent'}`, borderRadius: 8, background: value === opt.value ? '#FFF0F5' : 'white', cursor: 'pointer' }}>
          <input type="radio" name="difficulty" value={opt.value} checked={value === opt.value} onChange={() => onChange(opt.value)} />
          <span><strong>{opt.label}</strong> · {opt.desc}</span>
        </label>
      ))}
    </div>
  );
}
