export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>DUM RUNNER</title>
        <meta name="description" content="A retro-style grid defense game" />
      </head>
      <body>{children}</body>
    </html>
  );
}
