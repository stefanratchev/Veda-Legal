import type { Metadata } from "next";
import { Roboto, Roboto_Condensed } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const robotoCondensed = Roboto_Condensed({
  variable: "--font-roboto-condensed",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Veda Legal - Practice Management",
  description: "Legal practice management and timesheet tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${roboto.variable} ${robotoCondensed.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
