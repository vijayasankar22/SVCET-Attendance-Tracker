
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseProvider } from '@/firebase';
import { AuthProvider } from '@/context/auth-context';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  applicationName: 'Attendance Tracker',
  title: 'Attendance Tracker',
  description: 'Student Attendance Tracker',
  manifest: "/manifest.webmanifest",
  icons: {
    apple: '/svcet-logo.png',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#2b8a5b" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`} suppressHydrationWarning>
        <FirebaseProvider>
          <AuthProvider>
            <FirebaseErrorListener />
            {children}
          </AuthProvider>
        </FirebaseProvider>
        <Toaster />
      </body>
    </html>
  );
}
