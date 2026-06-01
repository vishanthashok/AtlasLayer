import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Parcelis — AtlasLayer',
  description: 'Real estate parcel intelligence: AI-powered property analysis, hazard profiles, and home model recommendations.',
};

export default function ParcelisLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
