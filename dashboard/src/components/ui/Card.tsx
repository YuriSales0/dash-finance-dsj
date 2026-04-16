interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function Card({ title, children, className = "", action }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-900">{title}</h3>
          {action}
        </div>
      )}
      <div className="card-body">{children}</div>
    </div>
  );
}
