import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
      {/* Title */}
      <div className="animate-fade-in">
        <p className="text-sm font-display tracking-[0.4em] uppercase text-empyrean-gold/70 mb-2">
          A Tactical Card Game
        </p>
        <h1 className="font-display text-5xl sm:text-7xl font-bold text-empyrean-gold drop-shadow-[0_0_24px_rgba(212,175,55,0.4)]">
          Empyrean Hero
        </h1>
        <p className="mt-4 text-empyrean-ash/80 max-w-md mx-auto leading-relaxed">
          Draft your heroes. Build your strategy. Overcome your rivals.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs animate-slide-up">
        <button
          className="btn-primary text-center"
          onClick={() => navigate('/lobby')}
        >
          Play Online
        </button>
        <button
          className="btn-secondary text-center"
          onClick={() => {
            // TODO: local/offline play
          }}
        >
          Local Play
        </button>
        <button
          className="btn-secondary text-center text-empyrean-ash/60 border-white/20"
          onClick={() => {
            // TODO: tutorial
          }}
        >
          How to Play
        </button>
      </div>

      {/* Footer */}
      <p className="text-xs text-white/30 absolute bottom-6">
        v0.0.1 — Early Access
      </p>
    </div>
  );
}
