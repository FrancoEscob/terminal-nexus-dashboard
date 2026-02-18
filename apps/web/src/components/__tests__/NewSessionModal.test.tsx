import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewSessionModal } from '@/components/NewSessionModal';

const createSessionMock = vi.fn(async () => ({
  id: 'new-session',
  name: 'shell-1234',
  type: 'shell' as const,
  workdir: 'C:/Users/frand/Projects',
  command: 'cmd.exe',
  flags: [],
  status: 'running' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

vi.mock('@/hooks/use-create-session', () => ({
  useCreateSession: () => ({
    createSession: createSessionMock,
    isCreating: false,
    error: undefined,
  }),
}));

vi.mock('@/hooks/use-session-templates', () => ({
  useSessionTemplates: () => ({
    templates: [],
    saveTemplate: vi.fn(),
  }),
}));

describe('NewSessionModal', () => {
  it('submits create session form', async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(<NewSessionModal isOpen onClose={onClose} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/Working Directory/i), {
      target: { value: 'C:\\Users\\frand\\Projects' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Crear sesión/i }));

    expect(createSessionMock).toHaveBeenCalled();
  });
});
