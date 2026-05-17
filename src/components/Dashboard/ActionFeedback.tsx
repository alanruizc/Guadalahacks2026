import styles from './ActionFeedback.module.css';

interface ActionFeedbackProps {
  message: string | null;
}

export function ActionFeedback({ message }: ActionFeedbackProps) {
  if (!message) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      {message}
    </div>
  );
}
