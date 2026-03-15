import React, { ReactNode } from "react";
import { MdClose } from "react-icons/md";

interface InfoModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  bodyClassName?: string;
}

export default function InfoModal({
  title,
  children,
  onClose,
  className,
  bodyClassName,
}: InfoModalProps) {
  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div
        className={`info-modal ${className || ""}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="info-modal-header">
          <h4 className="info-modal-title">{title}</h4>
          <button
            type="button"
            className="info-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            {/* @ts-ignore */}
            <MdClose size={18} />
          </button>
        </div>
        <div className={`info-modal-body ${bodyClassName || ""}`.trim()}>
          {children}
        </div>
      </div>
    </div>
  );
}
