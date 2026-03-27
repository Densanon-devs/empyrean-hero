import { useState } from 'react';
import { useGameContext } from '../../context/GameContext';
import { getSocket } from '../../socket/client';
import HealModal from './HealModal';
import EnhanceModal from './EnhanceModal';
import RecruitModal from './RecruitModal';

// ─────────────────────────────────────────────────────────────────────────────
// ActionSelector — HERO action picker (H / E / R / O)
// Shown when it is the local player's turn and no action has been selected yet.
// H/E/R open selection modals; O delegates to CombatResolver via onOvercome.
// ─────────────────────────────────────────────────────────────────────────────

interface ActionSelectorProps {
  /** Called when the player clicks Overcome so GameBoard can show CombatResolver */
  onOvercome: () => void;
}

type OpenModal = 'heal' | 'enhance' | 'recruit' | null;

export default function ActionSelector({ onOvercome }: ActionSelectorProps) {
  const { playerId } = useGameContext();
  const [openModal, setOpenModal] = useState<OpenModal>(null);

  function handlePassTurn() {
    if (!playerId) return;
    getSocket().emit('game:action', { type: 'PASS_TURN', playerId }, () => {});
  }

  return (
    <>
      <div className="panel">
        <p className="text-xs text-white/50 uppercase tracking-widest mb-3 text-center">
          Choose your action
        </p>

        <div className="grid grid-cols-4 gap-2">
          <ActionBtn
            colorClass="heal"
            emoji="💚"
            letter="H"
            label="Heal"
            sublabel="Un-fatigue heroes"
            onClick={() => setOpenModal('heal')}
          />
          <ActionBtn
            colorClass="enhance"
            emoji="✨"
            letter="E"
            label="Enhance"
            sublabel="Draw & play cards"
            onClick={() => setOpenModal('enhance')}
          />
          <ActionBtn
            colorClass="recruit"
            emoji="➕"
            letter="R"
            label="Recruit"
            sublabel="Deploy heroes"
            onClick={() => setOpenModal('recruit')}
          />
          <ActionBtn
            colorClass="overcome"
            emoji="⚔️"
            letter="O"
            label="Overcome"
            sublabel="Attack an opponent"
            onClick={onOvercome}
          />
        </div>

        {/* Short descriptions */}
        <div className="mt-3 grid grid-cols-2 gap-1 text-[10px] text-white/40">
          <p><span className="text-white/60 font-semibold">Heal:</span> Un-fatigue heroes</p>
          <p><span className="text-white/60 font-semibold">Enhance:</span> Draw &amp; play cards</p>
          <p><span className="text-white/60 font-semibold">Recruit:</span> Deploy from reserves</p>
          <p><span className="text-white/60 font-semibold">Overcome:</span> Declare attack</p>
        </div>

        <button
          className="mt-3 w-full text-xs text-white/30 hover:text-white/60 transition-colors"
          onClick={handlePassTurn}
        >
          Pass turn
        </button>
      </div>

      {/* Modals — rendered outside the panel via portals */}
      {openModal === 'heal'    && <HealModal    onClose={() => setOpenModal(null)} />}
      {openModal === 'enhance' && <EnhanceModal onClose={() => setOpenModal(null)} />}
      {openModal === 'recruit' && <RecruitModal onClose={() => setOpenModal(null)} />}
    </>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

interface ActionBtnProps {
  colorClass: 'heal' | 'enhance' | 'recruit' | 'overcome';
  emoji: string;
  letter: string;
  label: string;
  sublabel: string;
  onClick: () => void;
}

function ActionBtn({ colorClass, emoji, letter, label, sublabel, onClick }: ActionBtnProps) {
  return (
    <button className={`hero-action-btn ${colorClass}`} onClick={onClick}>
      <span className="text-xl">{emoji}</span>
      <span>{letter}</span>
      <span className="text-[10px] opacity-70 font-body font-normal">{label}</span>
    </button>
  );
}
