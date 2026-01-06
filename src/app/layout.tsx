import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "../components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rag-chat",
  description: "A chat application powered by RAG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={cn(inter.className, "min-h-screen antialiased bg-black")}>
        <Providers>
          <main className="h-screen text-white bg-black">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
