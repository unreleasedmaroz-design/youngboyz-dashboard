import "@fontsource-variable/montserrat";
import "@fontsource-variable/cairo";
import "./globals.css";

export const metadata = {
  title: "YOUNG BOYZ Distribution",
  description: "YOUNG BOYZ Music MENA — artist distribution portal",
};

export const viewport = { themeColor: "#050607" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
