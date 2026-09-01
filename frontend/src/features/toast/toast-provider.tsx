import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (kind: ToastKind, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev.slice(-3), { id, kind, title, description }]);
      window.setTimeout(() => dismiss(id), 4800);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-card border border-black/5 bg-surface p-3.5 shadow-pop anim-rise',
              'border-l-[3px]',
              t.kind === 'success' && 'border-l-success',
              t.kind === 'error' && 'border-l-destructive',
              t.kind === 'info' && 'border-l-primary',
            )}
            role="status"
          >
            {t.kind === 'success' && <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />}
            {t.kind === 'error' && <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />}
            {t.kind === 'info' && <Info className="mt-0.5 size-5 shrink-0 text-primary" />}
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-small p-1 text-muted transition-colors hover:bg-canvas hover:text-ink"
              aria-label="Fechar notificação"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useApiToast() {
  const { toast } = useToast();
  return {
    toast: {
      success: (title: string, description?: string) => toast('success', title, description),
      error: (title: string, description?: string) => toast('error', title, description),
      info: (title: string, description?: string) => toast('info', title, description),
    },
  };
}
