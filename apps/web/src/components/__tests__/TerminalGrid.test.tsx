import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TerminalGrid } from '@/components/TerminalGrid';
import type { SessionSummary } from '@/types/session';

vi.mock('@/components/XTerm', () => ({
  XTerm: () => <div data-testid="xterm-mock" />,
}));

const sessions: SessionSummary[] = [
  {
    id: 's1',
    name: 'test-session',
    type: 'shell',
    workdir: 'C:/tmp',
    command: 'cmd.exe',
    flags: [],
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('TerminalGrid', () => {
  it('renders mock sessions in grid', () => {
    render(<TerminalGrid sessions={sessions} isLoading={false} />);
    expect(screen.getByText('test-session')).toBeInTheDocument();
  });
});
