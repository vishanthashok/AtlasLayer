import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ConflictLens — AtlasLayer',
  description: 'Real-time global risk intelligence: State Department advisories, news NLP, and social signals on a live world heat map.',
};

export default function ConflictLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
