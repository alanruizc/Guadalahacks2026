import styles from './ActionFeedback.module.css';

export type NotificationVariant = 'success' | 'info' | 'warning';

export interface NotificationMessage {
  text: string;
  variant?: NotificationVariant;
}

interface ActionFeedbackProps {
  message: NotificationMessage | null;
}

export function ActionFeedback({ message }: ActionFeedbackProps) {
  if (!message) return null;

  const variant = message.variant ?? 'info';

  return (
    <div
      className={styles.toast}
      data-variant={variant}
      role="status"
      aria-live="polite"
    >
      <span className={styles.icon} aria-hidden>
        {variant === 'success' ? '✓' : variant === 'warning' ? '!' : 'ℹ'}
      </span>
      <span className={styles.text}>{message.text}</span>
    </div>
  );
}
