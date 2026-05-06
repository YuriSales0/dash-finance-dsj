"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info", durationMs: number = 4000) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, variant, durationMs }]);
    },
    []
  );

  const value: ToastContextValue = {
    show,
    success: (m, d) => show(m, "success", d),
    error: (m, d) => show(m, "error", d ?? 6000),
    info: (m, d) => show(m, "info", d),
  };

  function dismiss(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm"
          role="region"
          aria-label="Notifications"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, toast.durationMs);
    return () => clearTimeout(id);
  }, [toast.durationMs, onDismiss]);

  const styles =
    toast.variant === "success"
      ? "bg-green-50 border-green-200 text-green-900"
      : toast.variant === "error"
      ? "bg-red-50 border-red-200 text-red-900"
      : "bg-blue-50 border-blue-200 text-blue-900";

  const Icon =
    toast.variant === "success" ? CheckCircle2 : toast.variant === "error" ? AlertTriangle : Info;
  const iconColor =
    toast.variant === "success"
      ? "text-green-600"
      : toast.variant === "error"
      ? "text-red-600"
      : "text-blue-600";

  return (
    <div
      role="status"
      className={`shadow-lg rounded-lg border px-4 py-3 flex items-start gap-3 ${styles} animate-in fade-in slide-in-from-right`}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${iconColor}`} />
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        onClick={onDismiss}
        aria-label="Dispensar notificação"
        className="shrink-0 opacity-50 hover:opacity-100 transition"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No-op fallback se algum component foi renderizado fora do provider
    // (ex: storybook). Loga warning mas nao quebra a UI.
    if (typeof window !== "undefined") {
      console.warn("useToast() chamado fora de ToastProvider — toast ignorado");
    }
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
