import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fieldstone — AtlasLayer',
  description: 'Agricultural land analytics: satellite crop analysis, soil intelligence, and yield-oriented environmental insights.',
};

export default function FieldstoneLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
