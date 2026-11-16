/**
 * Public address of the site, used for canonical links, the share image,
 * the sitemap and structured data.
 *
 * It defaults to the Cloudflare Pages address. When a custom domain replaces
 * it, set `NEXT_PUBLIC_SITE_URL` in the Pages build settings (or change the
 * default here) and rebuild: nothing else mentions the address.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://proyecto-cursor.pages.dev"
).replace(/\/+$/, "");

export const SITE_NAME = "PromptShield";

export const SITE_TITLE =
  "PromptShield: anonimiza DNI e IBAN antes de usar ChatGPT";

export const SITE_DESCRIPTION =
  "Sustituye nombres, empresas, DNI, NIE, CIF, IBAN, teléfonos y emails por marcadores antes de enviar textos, CSV o Excel a ChatGPT o Claude, y restáuralos después. Todo en tu navegador, sin servidores.";

export const SHARE_TITLE = "Usa ChatGPT con tus datos reales sin entregárselos";

export const SHARE_DESCRIPTION =
  "Anonimiza nombres, DNI, IBAN, teléfonos y emails en textos y Excel antes de enviarlos a la IA. Todo ocurre en tu navegador: tus datos no salen de tu equipo.";

export const SHARE_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "PromptShield: «Usa ChatGPT con tus datos reales sin entregárselos», con marcadores como [DNI_1] y [IBAN_1] en lugar de datos personales.",
} as const;
