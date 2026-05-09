"use client";
import * as React from "react";
import {
  Toast,
  ToastDescription,
  ToastProvider as RadixToastProvider,
  ToastTitle,
  ToastViewport,
  ToastClose,
} from "./toast";

type ToastItem = {
  id: number;
  title?: string;
  description?: string;
  variant?: "default" | "danger" | "success";
};

type ToastContextValue = {
  toast: (t: Omit<ToastItem, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const id = React.useRef(0);

  const toast = React.useCallback((t: Omit<ToastItem, "id">) => {
    setItems((prev) => [...prev, { id: ++id.current, ...t }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <RadixToastProvider swipeDirection="right">
        {children}
        {items.map((t) => (
          <Toast
            key={t.id}
            onOpenChange={(open) => {
              if (!open) {
                setItems((prev) => prev.filter((p) => p.id !== t.id));
              }
            }}
            className={
              t.variant === "danger"
                ? "border-rose-300/60 bg-rose-50"
                : t.variant === "success"
                  ? "border-emerald-300/60 bg-emerald-50"
                  : ""
            }
          >
            <div className="flex flex-col gap-1">
              {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
              {t.description ? (
                <ToastDescription>{t.description}</ToastDescription>
              ) : null}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </RadixToastProvider>
    </ToastContext.Provider>
  );
}
