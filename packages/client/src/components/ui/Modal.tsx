import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// ─────────────────────────────────────────────────────────────────────────────
// Modal — portal-based overlay
// Full-screen on mobile, centered card on desktop.
// ─────────────────────────────────────────────────────────────────────────────

interface ModalProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({ title, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const maxW = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={[
          'relative w-full bg-empyrean-navy border border-white/20',
          'rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up',
          'flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden',
          maxW,
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h2 className="font-display text-empyrean-gold font-bold text-base sm:text-lg leading-tight">
            {title}
          </h2>
          {onClose && (
            <button
              className="ml-4 shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all text-lg leading-none"
              onClick={onClose}
              aria-label="Close modal"
            >
              ✕
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>

        {/* Sticky footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-white/10 shrink-0 bg-empyrean-navy">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
