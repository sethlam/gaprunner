export const metadata = {
  title: 'GapRunner',
  description: 'GapRunner on Next.js',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', touchAction: 'manipulation' }}>{children}</body>
    </html>
  );
}
