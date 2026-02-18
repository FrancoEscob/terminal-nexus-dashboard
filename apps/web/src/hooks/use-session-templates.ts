import { useEffect, useState } from 'react';
import type { SessionType } from '@/types/session';

const TEMPLATE_STORAGE_KEY = 'tn-session-templates';

export interface SessionTemplate {
  id: string;
  name: string;
  type: SessionType;
  workdir: string;
  flags: string[];
  command?: string;
}

function readTemplates(): SessionTemplate[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SessionTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates: SessionTemplate[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

export function useSessionTemplates() {
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);

  useEffect(() => {
    setTemplates(readTemplates());
  }, []);

  const saveTemplate = (template: Omit<SessionTemplate, 'id'>) => {
    const next: SessionTemplate = {
      ...template,
      id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const merged = [next, ...templates].slice(0, 30);
    setTemplates(merged);
    writeTemplates(merged);
  };

  return {
    templates,
    saveTemplate,
  };
}
