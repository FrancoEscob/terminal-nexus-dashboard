import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TerminalModal } from '@/components/TerminalModal';
import type { SessionSummary } from '@/types/session';

vi.mock('@/components/XTerm', () => ({
  XTerm: () => <div data-testid="xterm-mock" />,
}));

vi.mock('@/components/PresenceIndicator', () => ({
  PresenceIndicator: () => <div data-testid="presence-mock" />,
}));

vi.mock('@/components/TerminalToolbar', () => ({
  TerminalToolbar: () => <div data-testid="toolbar-mock" />,
}));

vi.mock('@/hooks/use-presence', () => ({
  usePresenceTracker: vi.fn(),
}));

vi.mock('@/hooks/use-session-actions', () => ({
  useSessionActions: () => ({
    killSession: vi.fn(async () => undefined),
    restartSession: vi.fn(async () => undefined),
    clearSession: vi.fn(async () => undefined),
    isMutating: false,
    error: undefined,
  }),
}));

vi.mock('@/hooks/use-audit-logs', () => ({
  appendAuditLog: vi.fn(),
}));

const session: SessionSummary = {
  id: 's-modal',
  name: 'modal-session',
  type: 'shell',
  workdir: '/tmp/project',
  command: '/bin/bash',
  flags: [],
  status: 'running',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('TerminalModal', () => {
  it('closes when clicking on backdrop', () => {
    const onClose = vi.fn();

    render(<TerminalModal session={session} onClose={onClose} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside modal content', () => {
    const onClose = vi.fn();

    render(<TerminalModal session={session} onClose={onClose} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByText('modal-session'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('still closes on backdrop after interacting inside modal content', () => {
    const onClose = vi.fn();

    render(<TerminalModal session={session} onClose={onClose} onChanged={vi.fn()} />);

    fireEvent.click(screen.getByText('modal-session'));
    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
