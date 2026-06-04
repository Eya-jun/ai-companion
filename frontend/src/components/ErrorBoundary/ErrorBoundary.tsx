import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || '未知错误' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 静默记到 console,不阻塞用户恢复路径
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className={styles.root} role="alert">
        <div className={styles.card}>
          <div className={styles.icon} aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h1 className={styles.title}>出错了</h1>
          <p className={styles.message}>{this.state.message}</p>
          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={this.handleReset}>
              试着重试
            </button>
            <button className={styles.btnPrimary} onClick={this.handleReload}>
              重新加载页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}
