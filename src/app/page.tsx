import {
  ArrowRightIcon,
  BanIcon,
  BuildingIcon,
  CreditCardIcon,
  FileLockIcon,
  IdCardIcon,
  KeyRoundIcon,
  LandmarkIcon,
  MailIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  WifiOffIcon,
} from "lucide-react";
import { Workbench } from "@/components/app/workbench";
import { Logo } from "@/components/brand/logo";
import { HeroDemo } from "@/components/site/hero-demo";
import { NetworkProbe } from "@/components/site/network-probe";
import { SpotlightCard } from "@/components/site/spotlight-card";
import { buttonVariants } from "@/components/ui/button";
import type { PiiEntityType } from "@/core-engine/types";
import { entityStyle } from "@/lib/entity-style";
import { FAQ } from "@/lib/faq";

const STEPS = [
  {
    title: "Pega o suelta tu archivo",
    text: "Texto libre, CSV o Excel con datos de clientes, pacientes o empleados.",
  },
  {
    title: "Envía solo los marcadores",
    text: "Cada dato sensible se cambia por un marcador como [DNI_1]. La IA trabaja sin ver nada real.",
  },
  {
    title: "Restaura la respuesta",
    text: "Pega lo que te devuelve la IA y vuelven los datos reales en su sitio.",
  },
];

const DETECTED: {
  name: string;
  detail: string;
  example: string;
  token: string;
  type: PiiEntityType;
  icon: typeof IdCardIcon;
}[] = [
  {
    name: "DNI y NIE",
    detail: "Letra de control mod-23",
    example: "12345678Z",
    token: "[DNI_1]",
    type: "DNI",
    icon: IdCardIcon,
  },
  {
    name: "CIF",
    detail: "Dígito o letra de control",
    example: "B12345674",
    token: "[CIF_1]",
    type: "CIF",
    icon: BuildingIcon,
  },
  {
    name: "IBAN español",
    detail: "Verificación mod-97",
    example: "ES91 2100 0418 4502 0005 1332",
    token: "[IBAN_1]",
    type: "IBAN",
    icon: LandmarkIcon,
  },
  {
    name: "Móvil",
    detail: "6XX y 7XX, con o sin +34",
    example: "+34 612 345 678",
    token: "[PHONE_1]",
    type: "PHONE",
    icon: SmartphoneIcon,
  },
  {
    name: "Email",
    detail: "Dominio y formato válidos",
    example: "ana@empresa.es",
    token: "[EMAIL_1]",
    type: "EMAIL",
    icon: MailIcon,
  },
  {
    name: "Tarjeta de pago",
    detail: "Algoritmo de Luhn",
    example: "4111 1111 1111 1111",
    token: "[CREDIT_CARD_1]",
    type: "CREDIT_CARD",
    icon: CreditCardIcon,
  },
];

const PRIVACY = [
  {
    icon: ShieldCheckIcon,
    title: "El código corre en tu navegador",
    text: "No hay servidor que procese tus datos: la web es un conjunto de archivos estáticos.",
  },
  {
    icon: WifiOffIcon,
    title: "Red bloqueada por diseño",
    text: "La página declara una política de seguridad que impide cualquier conexión saliente, aunque hubiera un fallo.",
  },
  {
    icon: KeyRoundIcon,
    title: "Clave solo en memoria",
    text: "La bóveda se cifra con AES-GCM y su clave nunca se guarda. Al cerrar la pestaña, desaparece.",
  },
];

const PROOF = [
  { value: "0", label: "bytes enviados a ningún servidor" },
  { value: "≈ 1 s", label: "para 100.000 filas de CSV, en nuestras pruebas" },
  {
    value: "AES-256",
    label: "cifrado de la bóveda, con clave solo en memoria",
  },
  { value: "7", label: "tipos de dato detectados, más tu lista de nombres" },
];

const NAV = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#que-detecta", label: "Qué detecta" },
  { href: "#privacidad", label: "Privacidad" },
  { href: "#faq", label: "Preguntas" },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "PromptShield",
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web",
      inLanguage: "es",
      description:
        "Anonimiza DNI, NIE, CIF, IBAN, teléfonos y emails en textos y hojas de cálculo antes de enviarlos a ChatGPT o Claude, con restauración posterior. Funciona en el navegador.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-primary mb-3 font-mono text-xs tracking-widest uppercase">
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="header-glass sticky top-0 z-20 border-b border-transparent">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
          <a href="#" aria-label="PromptShield, inicio">
            <Logo />
          </a>
          <nav aria-label="Principal" className="hidden gap-7 text-sm md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="#herramienta"
            className={buttonVariants({ size: "default" })}
          >
            Probar ahora
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="bg-aurora drift pointer-events-none absolute -inset-[10%]"
          />
          <div
            aria-hidden="true"
            className="bg-grid pointer-events-none absolute inset-0"
          />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-12 px-5 pt-16 pb-12 sm:pt-24">
            <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
              <a
                href="#privacidad"
                className="pill-glow bg-card/60 text-muted-foreground hover:text-foreground flex items-center gap-2.5 rounded-full px-4 py-1.5 text-sm backdrop-blur transition-colors"
              >
                <span
                  className="live-dot bg-primary size-2 rounded-full"
                  aria-hidden="true"
                />
                Privacidad verificable: funciona sin conexión
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
              </a>
              <h1 className="text-gradient text-5xl leading-[1.05] font-semibold text-balance sm:text-7xl">
                Usa ChatGPT con tus datos reales{" "}
                <span className="text-gradient-brand">sin entregárselos</span>
              </h1>
              <p className="text-muted-foreground max-w-2xl text-lg text-pretty sm:text-xl">
                PromptShield cambia DNI, NIE, CIF, IBAN, teléfonos y emails por
                marcadores antes de que el texto salga de tu equipo, y los
                restaura cuando la IA responde. Hecho para formatos españoles,
                con Excel y CSV incluidos.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="#herramienta"
                  className={`${buttonVariants({ size: "lg" })} h-11 gap-2 px-5 text-base shadow-[0_0_40px_-8px_oklch(0.86_0.19_155/80%)]`}
                >
                  Proteger un texto
                  <ArrowRightIcon aria-hidden="true" />
                </a>
                <a
                  href="#privacidad"
                  className={`${buttonVariants({ variant: "outline", size: "lg" })} h-11 px-5 text-base`}
                >
                  Compruébalo tú mismo
                </a>
              </div>
            </div>

            <HeroDemo />
          </div>
        </section>

        <section aria-label="La herramienta" className="relative px-5 pb-8">
          <div className="mx-auto w-full max-w-6xl">
            <Workbench />
          </div>
        </section>

        <section
          aria-label="En cifras"
          className="mx-auto w-full max-w-6xl px-5 py-12"
        >
          <dl className="reveal grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/8 ring-1 ring-white/8 lg:grid-cols-4">
            {PROOF.map(({ value, label }) => (
              <div
                key={label}
                className="bg-background flex flex-col gap-1 p-6"
              >
                <dt className="font-heading text-gradient text-3xl font-semibold tabular-nums">
                  {value}
                </dt>
                <dd className="text-muted-foreground text-sm text-pretty">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          id="como-funciona"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20"
        >
          <div className="reveal">
            <Eyebrow>Cómo funciona</Eyebrow>
            <h2 className="text-gradient max-w-xl text-4xl font-semibold text-balance">
              Tres pasos, y la IA nunca ve un dato real
            </h2>
          </div>
          <ol className="reveal mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <SpotlightCard className="h-full p-6">
                  <span className="bg-primary/12 text-primary ring-primary/25 grid size-9 place-items-center rounded-lg font-mono text-sm ring-1">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm text-pretty">
                    {step.text}
                  </p>
                </SpotlightCard>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="que-detecta"
          className="border-border/60 scroll-mt-20 border-y bg-white/[0.015]"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20">
            <div className="reveal">
              <Eyebrow>Qué detecta, y qué no</Eyebrow>
              <h2 className="text-gradient max-w-xl text-4xl font-semibold text-balance">
                Si el número no cuadra, no se marca
              </h2>
              <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
                Cada dato se valida con su propio checksum. Menos falsos
                positivos y menos texto estropeado.
              </p>
            </div>
            <ul className="reveal mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DETECTED.map((item) => (
                <li key={item.name}>
                  <SpotlightCard className="h-full p-5">
                    <div className="flex items-center gap-3">
                      <span
                        style={entityStyle(item.type)}
                        className="tok grid size-9 place-items-center rounded-lg"
                      >
                        <item.icon className="size-4.5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="leading-tight font-medium">
                          {item.name}
                        </h3>
                        <p className="text-muted-foreground text-xs">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                    <div
                      style={entityStyle(item.type)}
                      className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-xs"
                    >
                      <code className="pii-raw rounded px-1.5 py-0.5">
                        {item.example}
                      </code>
                      <ArrowRightIcon
                        className="text-muted-foreground size-3.5"
                        aria-hidden="true"
                      />
                      <code className="tok rounded px-1.5 py-0.5">
                        {item.token}
                      </code>
                    </div>
                  </SpotlightCard>
                </li>
              ))}
            </ul>
            <div className="reveal border-pii/25 bg-pii/6 mt-6 flex gap-3 rounded-2xl border p-5">
              <BanIcon
                className="text-pii mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm text-pretty">
                <strong>Nombres y direcciones no se detectan solos.</strong> No
                tienen formato que validar y adivinarlos falla mucho. Escribe
                los nombres y empresas a ocultar en la herramienta y se protegen
                igual que el resto. Los teléfonos fijos y los IBAN extranjeros
                tampoco están cubiertos todavía.
              </p>
            </div>
          </div>
        </section>

        <section
          id="privacidad"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20"
        >
          <div className="reveal">
            <Eyebrow>Privacidad</Eyebrow>
            <h2 className="text-gradient max-w-xl text-4xl font-semibold text-balance">
              Privacidad que puedes comprobar
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl text-pretty">
              En una herramienta de privacidad, prometer no basta. Esto es lo
              que hace PromptShield y cómo verificarlo.
            </p>
          </div>
          <ul className="reveal mt-10 grid gap-4 md:grid-cols-3">
            {PRIVACY.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <SpotlightCard className="h-full p-6">
                  <span className="bg-primary/12 text-primary ring-primary/25 grid size-9 place-items-center rounded-lg ring-1">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm text-pretty">
                    {text}
                  </p>
                </SpotlightCard>
              </li>
            ))}
          </ul>
          <div className="reveal surface mt-4 rounded-2xl p-6 ring-1 ring-white/8">
            <NetworkProbe />
          </div>
          <div className="reveal surface mt-4 flex gap-4 rounded-2xl p-6 ring-1 ring-white/8">
            <FileLockIcon
              className="text-primary mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="text-sm">
              <p className="font-medium">O compruébalo en 20 segundos</p>
              <ol className="text-muted-foreground mt-1 list-decimal pl-5">
                <li>Carga esta página.</li>
                <li>Desconecta el wifi o activa el modo avión.</li>
                <li>Protege un texto o un archivo: sigue funcionando.</li>
              </ol>
            </div>
          </div>
        </section>

        <section id="faq" className="border-border/60 scroll-mt-20 border-t">
          <div className="mx-auto w-full max-w-3xl px-5 py-20">
            <div className="reveal text-center">
              <Eyebrow>Preguntas</Eyebrow>
              <h2 className="text-gradient text-4xl font-semibold text-balance">
                Preguntas frecuentes
              </h2>
            </div>
            <div className="reveal mt-10 flex flex-col gap-3">
              {FAQ.map(({ question, answer }) => (
                <details
                  key={question}
                  className="surface group rounded-xl ring-1 ring-white/8 transition-colors open:ring-white/16"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 font-medium marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {question}
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground group-open:text-primary text-xl leading-none transition-transform duration-300 group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="text-muted-foreground px-5 pb-5 text-sm text-pretty">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-5 py-24">
          <div
            aria-hidden="true"
            className="bg-aurora pointer-events-none absolute inset-0 opacity-70"
          />
          <div className="reveal relative mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <h2 className="text-gradient text-4xl font-semibold text-balance sm:text-5xl">
              Pruébalo con tus datos. Ninguno saldrá de tu equipo.
            </h2>
            <a
              href="#herramienta"
              className={`${buttonVariants({ size: "lg" })} h-11 gap-2 px-5 text-base shadow-[0_0_40px_-8px_oklch(0.86_0.19_155/80%)]`}
            >
              Proteger un texto
              <ArrowRightIcon aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-border/60 border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="text-muted-foreground max-w-sm text-sm text-pretty">
              Anonimiza datos personales en tu navegador antes de usar la IA.
              Sin cuentas, sin servidores, sin conexión saliente.
            </p>
          </div>
          <nav
            aria-label="Pie de página"
            className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm md:justify-end"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hover:text-foreground self-start transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <p className="text-muted-foreground border-border/60 border-t pt-6 text-xs text-pretty md:col-span-2">
            PromptShield detecta datos por patrones y puede no cubrir todos los
            casos. Revisa siempre el texto protegido antes de enviarlo. La
            sustitución por marcadores es seudonimización, no anonimización, y
            esta herramienta no constituye asesoramiento legal.
          </p>
        </div>
      </footer>
    </>
  );
}
