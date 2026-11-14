import type {ReactNode} from 'react';

type ButtonProps = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Secondary (outlined) appearance. */
  outline?: boolean;
  /** Destructive action appearance. */
  danger?: boolean;
  size?: 'md' | 'lg';
};

export function PrimaryButton({children, onClick, disabled = false, outline = false, danger = false, size = 'md'}: ButtonProps) {
  const variant = danger ? 'btn-danger' : outline ? 'btn-outline' : 'btn-primary';
  return (
    <button type="button" className={`btn ${variant} ${size === 'lg' ? 'btn-lg' : ''}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Status({kind = 'info', children}: {kind?: 'info' | 'warn' | 'success' | 'error'; children: ReactNode}) {
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

export function LabeledMetric({label, value, caption}: {label: string; value: string | number; caption?: string}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {caption && <small>{caption}</small>}
    </div>
  );
}

export function PageHeader({title, children, actions}: {title: string; children?: ReactNode; actions?: ReactNode}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

const ICONS: Record<string, ReactNode> = {
  route: (<><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" /></>),
  ice: (<><path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" /><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" /></>),
  science: (<><path d="M9 3h6M10 3v6.2L5.2 18a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3L14 9.2V3" /><path d="M7.5 15h9" /></>),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  alert: (<><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.5v.1" /></>),
};

export function Icon({name, size = 20}: {name: keyof typeof ICONS | string; size?: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}

export const MISSION_ICON: Record<string, string> = {
  'rover-navigation-jezero': 'route',
  'water-ice-arcadia': 'ice',
  'past-life-jezero': 'science',
};
