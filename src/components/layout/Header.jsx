import React from 'react';
import { useLocation } from 'react-router-dom';
import { Save, Sun, Moon, HelpCircle, User, Sparkles } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useProject } from '@/lib/ProjectContext';
import { setTheme, useTheme } from '@/lib/theme';

const STEP_TITLES = {
  1: 'Material',
  2: 'Pieces',
  3: 'Optimize',
  4: 'Results',
};

export default function Header({ onToggleAssistant }) {
  const { projectName, setProjectName, material, matDef, step, saveProject } = useProject();
  const { toast } = useToast();
  const saveButtonRef = React.useRef(null);
  const saveNameInputRef = React.useRef(null);
  const pendingSaveNameRef = React.useRef(null);
  const savingRef = React.useRef(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [fileName, setFileName] = React.useState('');
  const [nameEdited, setNameEdited] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [, resolvedTheme] = useTheme().split(':');
  const dark = resolvedTheme === 'dark';
  const location = useLocation();

  const openSaveDialog = () => {
    setFileName(projectName?.trim() ? projectName : 'Untitled Project');
    setNameEdited(false);
    setSaveError('');
    setSaveOpen(true);
  };

  const closeSaveDialog = () => {
    if (savingRef.current) return;
    setSaveError('');
    setSaveOpen(false);
  };

  const handleSaveSubmit = (event) => {
    event.preventDefault();
    if (savingRef.current) return;
    const trimmedName = fileName.trim();
    if (!trimmedName) {
      setNameEdited(true);
      return;
    }
    savingRef.current = true;
    pendingSaveNameRef.current = trimmedName;
    setSaving(true);
    setSaveError('');
    setProjectName(trimmedName);
  };

  React.useEffect(() => {
    if (!saving || pendingSaveNameRef.current !== projectName) return;
    pendingSaveNameRef.current = null;
    try {
      saveProject();
      setSaveOpen(false);
      toast({ title: 'Project saved successfully', duration: 3000, className: 'save-success-toast' });
    } catch (error) {
      setSaveError(error?.message || 'Could not save project. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [projectName, saveProject, saving, toast]);

  const nameIsValid = fileName.trim().length > 0;
  const visibleError = saveError || (nameEdited && !nameIsValid ? 'File name is required' : '');

  const isWorkspace = location.pathname === '/';

  return (
    <header className="h-16 shrink-0 bg-background border-b border-[#E2E8E4] flex items-center justify-between px-6">
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-[#64748B] font-semibold">
            {isWorkspace ? `Step ${String(step).padStart(2, '0')} · ${STEP_TITLES[step]}` : 'CutWise'}
          </div>
          <div className="font-display font-semibold text-[#172B21] truncate">{projectName}</div>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#fff4d3] text-[#5a3a09] text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#d4a63a]" />
          {matDef.name} · {material.sheetWidth}×{material.sheetHeight}mm
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          ref={saveButtonRef}
          onClick={openSaveDialog}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#172B21] hover:bg-[#F4F7F5] transition-colors"
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">Save</span>
        </button>
        <button
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F4F7F5] transition-colors"
          title={`Switch to ${dark ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#64748B] hover:bg-[#F4F7F5] transition-colors"
          title="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[#2b1d08] text-white flex items-center justify-center text-xs font-semibold" title="Guest">
          <User className="w-4 h-4" />
        </div>
        <button
          onClick={onToggleAssistant}
          className="ml-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-[#d4a63a] text-black hover:bg-[#c2901f] transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">AI</span>
        </button>
      </div>

      <Dialog open={saveOpen} onOpenChange={(open) => { if (open) setSaveOpen(true); else closeSaveDialog(); }}>
        <DialogPortal>
          <DialogOverlay className="save-dialog-overlay" />
          <DialogPrimitive.Content
            className="save-dialog-content fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              requestAnimationFrame(() => {
                saveNameInputRef.current?.focus();
                saveNameInputRef.current?.select();
              });
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              saveButtonRef.current?.focus();
            }}
          >
            <DialogTitle className="font-display text-lg font-bold">Save Project</DialogTitle>
            <form onSubmit={handleSaveSubmit} className="mt-5 space-y-5">
              <div>
                <label htmlFor="save-project-file-name" className="mb-1.5 block text-sm font-medium">File name</label>
                <input
                  ref={saveNameInputRef}
                  id="save-project-file-name"
                  type="text"
                  value={fileName}
                  onChange={(event) => { setFileName(event.target.value); setNameEdited(true); setSaveError(''); }}
                  aria-invalid={Boolean(visibleError)}
                  className="save-project-name-input w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition"
                />
                {visibleError && <p role="alert" className="mt-1.5 text-sm text-red-600">{visibleError}</p>}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeSaveDialog} disabled={saving} className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={!nameIsValid || saving} className="save-project-confirm rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'OK'}</button>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </header>
  );
}
