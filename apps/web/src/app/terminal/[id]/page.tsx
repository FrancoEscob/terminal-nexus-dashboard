import { Suspense } from 'react';
import { TerminalFullscreenView } from '@/components/TerminalFullscreenView';

interface TerminalPageProps {
  params: Promise<{ id: string }>;
}

export default async function TerminalFullscreenPage({ params }: TerminalPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950 p-6 text-slate-300">Cargando terminal...</main>}>
      <TerminalFullscreenView sessionId={id} />
    </Suspense>
  );
}
