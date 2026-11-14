import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default:
      "PromptShield: anonimiza DNI, IBAN y datos personales antes de usar ChatGPT",
    template: "%s | PromptShield",
  },
  description:
    "Sustituye DNI, NIE, CIF, IBAN, teléfonos y emails por marcadores antes de enviar textos, CSV o Excel a ChatGPT o Claude, y restáuralos después. Todo en tu navegador, sin servidores.",
  keywords: [
    "anonimizar datos",
    "anonimizar DNI",
    "ChatGPT RGPD",
    "proteger datos personales IA",
    "seudonimización",
    "anonimizar Excel",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "PromptShield",
    title: "Usa ChatGPT con tus datos reales sin entregárselos",
    description:
      "Anonimiza DNI, IBAN, teléfonos y emails en textos y Excel antes de enviarlos a la IA. 100 % en tu navegador.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
