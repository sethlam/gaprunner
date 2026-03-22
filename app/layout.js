export const metadata = {
  title: 'GapRunner',
  description: 'GapRunner on Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
