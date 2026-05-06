"use client";

import { useId, type ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
  full?: boolean;
  hint?: string;
}

export function FormField({ label, children, full, hint }: Props) {
  const id = useId();
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700 mb-1">
        {label}
      </label>
      <div data-field-id={id}>{children}</div>
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}
