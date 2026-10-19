import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Comunidade Display 3K | Acesso Exclusivo GOPLAK',
  description: 'Acesso à esteira industrial de displays GOPLAK, mentoria prática e plataforma de gestão.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function Display3KLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
