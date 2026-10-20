"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className={`modal ${wide ? "modal-wide" : ""}`} aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Tutup dialog" title="Tutup" onClick={onClose}><X size={19} /></button></div>
      {children}
    </dialog>
  );
}