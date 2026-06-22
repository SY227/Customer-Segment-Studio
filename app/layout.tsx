import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Customer Segment Studio | Segment Guild",
  description:
    "A visual customer segmentation studio that turns order data into nine clear customer groups with practical growth, retention, and reactivation actions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
