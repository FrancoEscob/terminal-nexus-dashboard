'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  addTerminalOutputListener,
  addTerminalResizeListener,
  joinSession,
  leaveSession,
  sendTerminalInput,
  sendTerminalResize,
} from '@/lib/socket-client';
import { useUiStore } from '@/lib/stores/ui-store';

interface XTermProps {
  sessionId: string;
  readOnly?: boolean;
  className?: string;
  syncResize?: boolean;
  clearSignal?: number;
  onReady?: () => void;
}

export function XTerm({
  sessionId,
  readOnly = false,
  className,
  syncResize = false,
  clearSignal = 0,
  onReady,
}: XTermProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);

  const addSubscribedSession = useUiStore((state) => state.addSubscribedSession);
  const removeSubscribedSession = useUiStore((state) => state.removeSubscribedSession);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let unsubscribeOutput: (() => void) | null = null;
    let unsubscribeResize: (() => void) | null = null;

    const initialize = async () => {
      const [{ Terminal }, { FitAddon }, { SearchAddon }, { WebglAddon }] = await Promise.all([
        import('xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-search'),
        import('@xterm/addon-webgl'),
      ]);

      if (cancelled || !containerRef.current) return;

      const terminal = new Terminal({
        convertEol: true,
        cursorBlink: !readOnly,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: 12,
        lineHeight: 1.2,
        theme: {
          background: '#0b1020',
          foreground: '#dbe2f2',
          cursor: '#8ad4ff',
          selectionBackground: '#274264',
        },
        disableStdin: readOnly,
        scrollback: 1000,
      });

      const fitAddon = new FitAddon();
      const searchAddon = new SearchAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(searchAddon);

      try {
        terminal.loadAddon(new WebglAddon());
      } catch {
        // WebGL addon is optional and can fail on some GPUs/drivers.
      }

      terminal.open(containerRef.current);
      fitAddon.fit();
      if (syncResize) {
        void sendTerminalResize(sessionId, terminal.cols, terminal.rows);
      }

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      resizeObserver = new ResizeObserver(() => {
        fitAddonRef.current?.fit();
        if (syncResize && terminalRef.current) {
          void sendTerminalResize(sessionId, terminalRef.current.cols, terminalRef.current.rows);
        }
      });
      resizeObserver.observe(containerRef.current);

      if (!readOnly) {
        terminal.onData((data: string) => {
          void sendTerminalInput(sessionId, data);
        });
      }

      void joinSession(sessionId);
      addSubscribedSession(sessionId);

      unsubscribeOutput = addTerminalOutputListener((outputSessionId, data) => {
        if (outputSessionId === sessionId) {
          terminal.write(data);
        }
      });

      unsubscribeResize = addTerminalResizeListener((incomingSessionId, _cols, _rows) => {
        if (incomingSessionId === sessionId) {
          fitAddonRef.current?.fit();
        }
      });

      onReady?.();
    };

    void initialize();

    return () => {
      cancelled = true;
      unsubscribeOutput?.();
      unsubscribeResize?.();
      removeSubscribedSession(sessionId);
      void leaveSession(sessionId);
      resizeObserver?.disconnect();
      terminalRef.current?.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [addSubscribedSession, onReady, readOnly, removeSubscribedSession, sessionId, syncResize]);

  useEffect(() => {
    if (!terminalRef.current || clearSignal === 0) return;
    terminalRef.current.clear();
  }, [clearSignal]);

  return <div ref={containerRef} className={cn('h-full w-full', className)} />;
}
