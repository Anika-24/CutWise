import React from 'react';
import { Check } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from '@/components/ui/dialog';
import { useProject } from '@/lib/ProjectContext';

const STEPS = [
  { n: 1, label: 'Material' },
  { n: 2, label: 'Pieces' },
  { n: 3, label: 'Optimize' },
  { n: 4, label: 'Results' },
];

export default function Stepper() {
  const { step, setStep, layout, pieces, projectId, projectName, material, assumptions, selectedOffcutIds, savedProjects, resetDemo } = useProject();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const materialStepRef = React.useRef(null);

  const canGoTo = (n) => {
    if (n <= 2) return true;
    if (n === 3) return true;
    if (n === 4) return !!layout;
    return false;
  };

  const startNewProject = () => {
    setConfirmOpen(false);
    resetDemo();
  };

  const handleStepClick = (stepNumber) => {
    if (!canGoTo(stepNumber)) return;
    if (stepNumber !== 1) {
      setStep(stepNumber);
      return;
    }
    if (step === 1) return;

    const savedProject = savedProjects.find((project) => project.id === projectId);
    const matchesSavedProject = savedProject &&
      savedProject.name === projectName &&
      JSON.stringify(savedProject.material) === JSON.stringify(material) &&
      JSON.stringify(savedProject.pieces) === JSON.stringify(pieces) &&
      JSON.stringify(savedProject.productionSettings ?? {}) === JSON.stringify(assumptions) &&
      JSON.stringify(savedProject.selectedOffcutIds ?? []) === JSON.stringify(selectedOffcutIds);
    const hasUnsavedWork = !matchesSavedProject && (
      pieces.length > 0 || Boolean(layout) || (projectName && projectName !== 'Untitled Project')
    );

    if (hasUnsavedWork) setConfirmOpen(true);
    else resetDemo();
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2 bg-white rounded-2xl border border-[#E2E8E4] p-1.5 shadow-sm">
      {STEPS.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        const enabled = canGoTo(s.n);
        return (
          <div key={s.n} className="contents">
            <button
              ref={s.n === 1 ? materialStepRef : undefined}
              disabled={!enabled}
              onClick={() => handleStepClick(s.n)}
              className={`stepper-item flex items-center gap-2.5 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-[#123D26] text-white shadow'
                  : done
                  ? 'text-[#15803D] hover:bg-[#DCFCE7]'
                  : enabled
                  ? 'text-[#64748B] hover:bg-[#F4F7F5]'
                  : 'text-[#94A3B8] cursor-not-allowed'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  active
                    ? 'bg-[#16A34A] text-white'
                  : done
                    ? 'step-complete-badge bg-[#16A34A] text-white'
                    : 'bg-[#F4F7F5] text-[#64748B]'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : String(s.n).padStart(2, '0')}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`step-connector w-4 sm:w-8 h-px ${done ? 'step-connector-filled bg-[#16A34A]' : 'bg-[#E2E8E4]'}`} />
            )}
          </div>
        );
      })}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogPortal>
          <DialogOverlay className="save-dialog-overlay" />
          <DialogPrimitive.Content
            className="save-dialog-content fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                startNewProject();
              }
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              materialStepRef.current?.focus();
            }}
          >
            <DialogTitle className="font-display text-lg font-bold">Start a new project?</DialogTitle>
            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
              Your current project has not been saved. Starting a new project will clear it.
            </DialogPrimitive.Description>
            <form onSubmit={(event) => { event.preventDefault(); startNewProject(); }} className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Cancel</button>
              <button type="submit" className="save-project-confirm rounded-lg px-4 py-2 text-sm font-semibold text-white">Start New</button>
            </form>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
