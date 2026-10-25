import './globals.css';

export const metadata = {
  title: 'MoinuFlix Auto-Flow Admin',
  description: 'Private 5.1 OTT Catalog & Chunk Manager',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
