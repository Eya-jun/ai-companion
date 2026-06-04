import { useEffect, useState } from 'react';
import styles from './StatEditor.module.css';

interface NumberSliderModalProps {
  open: boolean;
  title: string;        // 例如 "编辑好感度"
  initial: number;      // 0–100
  hint?: string;        // 副标题 / 提示
  confirmLabel?: string;
  onCancel: () => void;
  onSave: (value: number) => Promise<void> | void;
}

/**
 * 通用 0-100 数值滑块弹窗。用于编辑好感度、亲密度等。
 * 模式: bottom-sheet,跟 SearchModal 同款 overlay+slide-up。
 */
export default function NumberSliderModal({
  open,
  title,
  initial,
  hint,
  confirmLabel = '保存',
  onCancel,
  onSave,
}: NumberSliderModalProps) {
  const [value, setValue] = useState<number>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initial);
      setErr(null);
      setSaving(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const onSubmit = async () => {
    if (saving) return;
    setErr(null);
    setSaving(true);
    try {
      await onSave(Math.round(value));
      // 成功后由 onSave 父级关掉弹窗
    } catch (e: any) {
      setErr(e?.message || '保存失败');
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className={styles.cancel} onClick={onCancel}>取消</button>
        </div>

        <div className={styles.body}>
          <div className={styles['big-number']}>{Math.round(value)}</div>

          <div className={styles['slider-wrap']}>
            <input
              className={styles.slider}
              type="range"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={e => setValue(parseInt(e.target.value, 10))}
            />
            <div className={styles['slider-row']}>
              <span>0</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>

          {hint && <div className={styles.hint}>{hint}</div>}
          {err && <div className={styles.error}>{err}</div>}
        </div>

        <div className={styles.actions}>
          <button className={styles.btn} onClick={onCancel} disabled={saving}>取消</button>
          <button
            className={`${styles.btn} ${styles['btn-primary']}`}
            onClick={onSubmit}
            disabled={saving}
          >
            {saving ? '保存中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
