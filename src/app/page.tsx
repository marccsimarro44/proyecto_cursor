import { ShieldCheckIcon } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <div className="font-heading flex items-center gap-2 text-lg font-semibold">
        <ShieldCheckIcon className="text-primary size-5" aria-hidden="true" />
        PromptShield
      </div>
      <h1 className="max-w-2xl text-4xl font-semibold text-balance sm:text-5xl">
        Anonimiza tus datos antes de enviarlos a la IA
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg text-pretty">
        DNI, NIE, CIF, IBAN y teléfonos se sustituyen por tokens reversibles.
        Nada sale de tu navegador.
      </p>
    </main>
  );
}
