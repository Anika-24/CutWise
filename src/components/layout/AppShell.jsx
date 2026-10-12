import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AIAssistant from '@/components/assistant/AIAssistant';

export default function AppShell() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleAssistant={() => setAssistantOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <AIAssistant open={assistantOpen} onToggle={() => setAssistantOpen((open) => !open)} />
    </div>
  );
}
