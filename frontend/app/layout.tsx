import type { Metadata } from "next";
import {Inter, Poppins, Geist } from "next/font/google";
import "./globals.css";
import {UserProvider} from "@/providers/UserContext";
import {Toaster} from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "EnderTeX",
  description: "TeX editor with no restrictions",
  applicationName: "EnderTeX",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
      <html
          lang="en"
          className={cn("h-full", "antialiased", inter.variable, poppins.variable, "font-sans", geist.variable)}
      >
      <body className="min-h-full flex flex-col">
      <UserProvider>
        {children}
        <Toaster/>
      </UserProvider>
      </body>
      </html>
  );
}
