import './globals.css';

export const metadata = {
  title: 'MoinuFlix Cinema Studio Admin',
  description: 'Private 5.1 & Two-Tier Cinematic Ingestion Hub',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#070b14] text-white selection:bg-red-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
