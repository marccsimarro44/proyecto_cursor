import {
  BanIcon,
  FileLockIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  WifiOffIcon,
} from "lucide-react";
import { Workbench } from "@/components/app/workbench";
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

const DETECTED = [
  {
    name: "DNI y NIE",
    detail: "Letra de control mod-23",
    example: "12345678Z",
  },
  { name: "CIF", detail: "Dígito o letra de control", example: "B12345674" },
  {
    name: "IBAN español",
    detail: "Verificación mod-97",
    example: "ES91 2100 0418 4502 0005 1332",
  },
  {
    name: "Móvil",
    detail: "6XX y 7XX, con o sin +34",
    example: "+34 612 345 678",
  },
  {
    name: "Email",
    detail: "Dominio y formato válidos",
    example: "ana@empresa.es",
  },
  {
    name: "Tarjeta de pago",
    detail: "Algoritmo de Luhn",
    example: "4111 1111 1111 1111",
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

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <header className="border-border/60 sticky top-0 z-10 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
          <a
            href="#"
            className="font-heading flex items-center gap-2 text-lg font-semibold"
          >
            <ShieldCheckIcon
              className="text-primary size-5"
              aria-hidden="true"
            />
            PromptShield
          </a>
          <nav aria-label="Principal" className="hidden gap-6 text-sm sm:flex">
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
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="bg-grid pointer-events-none absolute inset-0"
          />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pt-14 pb-16">
            <div className="flex max-w-3xl flex-col gap-5">
              <p className="text-primary flex items-center gap-2 font-mono text-sm">
                <span className="bg-primary size-1.5 rounded-full" />
                100 % en tu navegador · sin cuentas · sin servidores
              </p>
              <h1 className="text-4xl font-semibold text-balance sm:text-6xl">
                Usa ChatGPT con tus datos reales sin entregárselos
              </h1>
              <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
                PromptShield cambia DNI, NIE, CIF, IBAN, teléfonos y emails por
                marcadores antes de que el texto salga de tu equipo, y los
                restaura cuando la IA responde. Pensado para formatos españoles,
                con Excel y CSV incluidos.
              </p>
            </div>
            <Workbench />
          </div>
        </section>

        <section
          id="como-funciona"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16"
        >
          <h2 className="text-3xl font-semibold">Cómo funciona</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="bg-card ring-foreground/10 rounded-xl p-5 ring-1"
              >
                <span className="text-primary font-mono text-sm">
                  0{index + 1}
                </span>
                <h3 className="mt-2 text-lg font-medium">{step.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="que-detecta"
          className="border-border/60 scroll-mt-20 border-y"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-16">
            <h2 className="text-3xl font-semibold">Qué detecta, y qué no</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Cada número se valida con su propio checksum: si no cuadra, no se
              marca. Menos falsos positivos y menos texto estropeado.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DETECTED.map((item) => (
                <li
                  key={item.name}
                  className="bg-card ring-foreground/10 rounded-xl p-5 ring-1"
                >
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-muted-foreground text-sm">{item.detail}</p>
                  <code className="bg-muted mt-3 inline-block rounded px-2 py-1 font-mono text-xs">
                    {item.example}
                  </code>
                </li>
              ))}
            </ul>
            <div className="border-pii/30 bg-pii/5 mt-6 flex gap-3 rounded-xl border p-5">
              <BanIcon
                className="text-pii mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm">
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
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16"
        >
          <h2 className="text-3xl font-semibold">
            Privacidad que puedes comprobar
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            En una herramienta de privacidad, prometer no basta. Esto es lo que
            hace PromptShield y cómo verificarlo.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {PRIVACY.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="bg-card ring-foreground/10 rounded-xl p-5 ring-1"
              >
                <Icon className="text-primary size-5" aria-hidden="true" />
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{text}</p>
              </li>
            ))}
          </ul>
          <div className="bg-card ring-foreground/10 mt-4 flex gap-4 rounded-xl p-5 ring-1">
            <FileLockIcon
              className="text-primary mt-0.5 size-5 shrink-0"
              aria-hidden="true"
            />
            <div className="text-sm">
              <p className="font-medium">Compruébalo en 20 segundos</p>
              <ol className="text-muted-foreground mt-1 list-decimal pl-5">
                <li>Carga esta página.</li>
                <li>Desconecta el wifi o activa el modo avión.</li>
                <li>Protege un texto o un archivo: sigue funcionando.</li>
              </ol>
            </div>
          </div>
        </section>

        <section id="faq" className="border-border/60 scroll-mt-20 border-t">
          <div className="mx-auto w-full max-w-3xl px-5 py-16">
            <h2 className="text-3xl font-semibold">Preguntas frecuentes</h2>
            <div className="mt-8 flex flex-col gap-3">
              {FAQ.map(({ question, answer }) => (
                <details
                  key={question}
                  className="bg-card ring-foreground/10 group rounded-xl ring-1"
                >
                  <summary className="cursor-pointer list-none px-5 py-4 font-medium marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {question}
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="text-muted-foreground px-5 pb-4 text-sm">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-border/60 border-t">
        <div className="text-muted-foreground mx-auto w-full max-w-6xl px-5 py-8 text-xs">
          <p>
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
