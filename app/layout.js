import './globals.css';

export const metadata = {
  title: 'RITIKOMAL LOVE',
  description: 'A private, two-person couple chat.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,600&family=Quicksand:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Same as the original PHP app: Tailwind via CDN, no build step. */}
        <script src="https://cdn.tailwindcss.com" />
      </head>
      <body className="overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
