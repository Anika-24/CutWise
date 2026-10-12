import React from 'react';
import { Info, Sparkles, FolderOpen, Volume2, Mic } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import { useProject } from '@/lib/ProjectContext';

const cardClass = 'settings-card relative rounded-2xl border border-[rgba(27,77,62,0.12)] dark:border-[rgba(163,193,173,0.18)] bg-card p-6 shadow-[0_8px_22px_rgba(15,47,37,0.08),0_2px_5px_rgba(15,47,37,0.04)] dark:shadow-[0_8px_22px_rgba(0,0,0,0.2)] transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-[0_12px_28px_rgba(15,47,37,0.14),0_3px_8px_rgba(52,169,157,0.08)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.28)]';

function SectionHeading({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#34A99D] to-[#256B55] text-white shadow-sm">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <h2 className="font-display font-semibold text-foreground">{children}</h2>
    </div>
  );
}

export default function Settings() {
  const { savedProjects, deleteProject } = useProject();
  const [voiceOutput, setVoiceOutput] = React.useState(true);
  const [speechRecognition, setSpeechRecognition] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);
  const clearButtonRef = React.useRef(null);
  const cancelButtonRef = React.useRef(null);
  const speechOutputSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const speechRecognitionSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const handleClearAll = () => {
    savedProjects.forEach(() => deleteProject(0));
    setClearOpen(false);
  };

  const voiceControls = [
    { label: 'Enable Voice Output', icon: Volume2, enabled: voiceOutput, setEnabled: setVoiceOutput, supported: speechOutputSupported },
    { label: 'Enable Speech Recognition', icon: Mic, enabled: speechRecognition, setEnabled: setSpeechRecognition, supported: speechRecognitionSupported },
  ];

  return (
    <div className="mx-auto max-w-[800px] p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preferences for this demo session.</p>
      </div>

      <div className="space-y-4">
        <section className={`${cardClass} overflow-hidden`}>
          <span className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-[#34A99D] to-[#256B55]" aria-hidden="true" />
          <div className="mb-4"><SectionHeading icon={Sparkles}>AI &amp; Voice</SectionHeading></div>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">The CutWise AI assistant uses a server-side language model with your live project context. Voice output uses your browser's speech synthesis; voice input uses the browser's speech recognition where available.</p>
          <div className="space-y-3">
            {voiceControls.map(({ label, icon: Icon, enabled, setEnabled, supported }) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon className="h-4 w-4 text-[#256B55] dark:text-[#6FD6B0]" aria-hidden="true" />
                  <span>{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${!supported ? 'bg-muted text-muted-foreground' : enabled ? 'bg-[#E8F5EE] text-[#1B4D3E] dark:bg-[rgba(52,169,157,0.18)] dark:text-[#E8F3EC]' : 'bg-muted text-muted-foreground'}`}>
                    {!supported ? 'Not supported' : enabled ? 'Ready' : 'Off'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-label={label}
                    aria-checked={enabled && supported}
                    disabled={!supported}
                    onClick={() => setEnabled((value) => !value)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#34A99D] focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50 ${enabled && supported ? 'bg-gradient-to-r from-[#34A99D] to-[#256B55]' : 'bg-[#A3C1AD]'}`}
                  >
                    <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${enabled && supported ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">These voice switches are visual-only; they do not change assistant behavior or persist after refresh.</p>
        </section>

        <section className={cardClass}>
          <div className="mb-4"><SectionHeading icon={FolderOpen}>Saved projects</SectionHeading></div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Projects stored locally in this browser.</p>
            <span className="rounded-full bg-[#E8F5EE] px-3 py-1 text-xs font-semibold text-[#1B4D3E] dark:bg-[rgba(52,169,157,0.18)] dark:text-[#E8F3EC]">
              {savedProjects.length === 0 ? 'No Projects Stored' : `${savedProjects.length} Project${savedProjects.length === 1 ? '' : 's'} Stored`}
            </span>
          </div>
          <button
            ref={clearButtonRef}
            type="button"
            disabled={savedProjects.length === 0}
            onClick={() => setClearOpen(true)}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors duration-200 hover:border-red-300 hover:bg-red-50 hover:text-[#DC2626] focus-visible:border-red-300 focus-visible:text-[#DC2626] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear all saved projects
          </button>
        </section>

        <section className={`${cardClass} flex items-start gap-3 border-l-4 border-l-[#1B4D3E] bg-[rgba(52,169,157,0.08)] text-[#12332A] backdrop-blur-md dark:border-l-[#6FD6B0] dark:bg-[rgba(52,169,157,0.16)] dark:text-[#E8F3EC]`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#34A99D] to-[#256B55] text-white shadow-sm">
            <Info className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="text-sm text-[#12332A] dark:text-[#E8F3EC]">
            <p className="mb-1 font-semibold">About CutWise</p>
            CutWise is a material cutting optimization demo. The optimizer is a real MaxRects-BSSF packer. All utilization, waste, and cost figures are computed from the validated layout — nothing is hardcoded.
          </div>
        </section>
      </div>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogPortal>
          <DialogOverlay className="save-dialog-overlay" />
          <DialogPrimitive.Content
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-projects-title"
            aria-describedby="clear-projects-description"
            className="save-dialog-content fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancelButtonRef.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              clearButtonRef.current?.focus();
            }}
          >
            <DialogPrimitive.Title id="clear-projects-title" className="font-display text-lg font-bold">Clear all saved projects?</DialogPrimitive.Title>
            <DialogPrimitive.Description id="clear-projects-description" className="mt-2 text-sm text-muted-foreground">
              This permanently deletes {savedProjects.length} saved {savedProjects.length === 1 ? 'project' : 'projects'}. This cannot be undone.
            </DialogPrimitive.Description>
            <div className="mt-5 flex justify-end gap-2">
              <button ref={cancelButtonRef} type="button" onClick={() => setClearOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Cancel</button>
              <button type="button" onClick={handleClearAll} className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B91C1C]">Delete All</button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
