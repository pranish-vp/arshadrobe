"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type ToastType = "info" | "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface AlertContextValue {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function useAlerts(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlerts must be used inside <AlertProvider>");
  return ctx;
}

const TOAST_ICONS: Record<ToastType, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

export default function AlertProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (ok: boolean) => void;
  } | null>(null);
  const idRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ options, resolve });
      }),
    []
  );

  const settle = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  return (
    <AlertContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-8">
        {toasts.map((t) => {
          const Icon = TOAST_ICONS[t.type];
          return (
            <div
              key={t.id}
              role="status"
              className="animate-fade-up pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-cream shadow-lift"
            >
              <Icon
                size={17}
                className={
                  t.type === "error"
                    ? "shrink-0 text-clay-soft"
                    : t.type === "success"
                      ? "shrink-0 text-sage-soft"
                      : "shrink-0 text-cream/70"
                }
              />
              <span className="leading-5">{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-6 backdrop-blur-sm"
          onClick={() => settle(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="animate-fade-up w-full max-w-sm rounded-3xl bg-cream p-6 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  confirmState.options.danger
                    ? "bg-clay-soft text-clay-deep"
                    : "bg-sage-soft text-sage"
                }`}
              >
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold leading-tight">
                  {confirmState.options.title}
                </h2>
                {confirmState.options.body && (
                  <p className="mt-1.5 text-sm leading-5 text-muted">
                    {confirmState.options.body}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => settle(false)}
                className="flex-1 rounded-full border border-sand py-2.5 text-sm font-semibold text-muted transition-all hover:text-ink active:scale-[0.98]"
              >
                {confirmState.options.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`flex-1 rounded-full py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] ${
                  confirmState.options.danger
                    ? "bg-clay-deep hover:bg-clay"
                    : "bg-ink hover:bg-black"
                }`}
              >
                {confirmState.options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}
