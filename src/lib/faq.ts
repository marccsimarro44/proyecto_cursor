/** Questions shown on the page and published as FAQ structured data. */
export const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: "¿Mis datos se envían a algún servidor?",
    answer:
      "No. Todo el procesamiento ocurre en tu navegador y la web es un sitio estático, sin servidor que reciba nada. Además, la página declara una política de seguridad que prohíbe cualquier conexión de red saliente. Puedes comprobarlo: carga la página, desconecta internet y sigue funcionando.",
  },
  {
    question: "¿Cómo recupero los datos reales después?",
    answer:
      "Pega la respuesta de la IA en la pestaña Restaurar, con sus marcadores como [DNI_1], y se sustituyen por los valores originales. También funciona con archivos: protege un Excel, procésalo con la IA y restaura el resultado.",
  },
  {
    question: "¿Qué pasa si recargo o cierro la pestaña?",
    answer:
      "La clave que cifra la bóveda solo existe en la memoria de esa pestaña y se destruye al cerrarla o recargarla. Es una decisión de seguridad: nadie podrá leer la bóveda después, tampoco tú. Por eso conviene conservar el texto original y no cerrar la pestaña hasta haber restaurado la respuesta.",
  },
  {
    question: "¿Detecta nombres y direcciones?",
    answer:
      "Nombres y empresas, sí: un nombre no tiene checksum, así que se reconoce por el contexto (un nombre de pila con apellidos, un tratamiento como «Sra.» o «Dr.», un saludo o una firma) y las empresas por su forma jurídica (S.L., S.A.…) o su sector («Gestoría…»). Se puede desactivar, dejar visible un falso positivo con un clic y añadir a mano lo que se escape, como nombres poco comunes o escritos en minúscula. Las direcciones postales aún no se detectan solas: añádelas a tu lista.",
  },
  {
    question: "¿Qué datos detecta?",
    answer:
      "DNI, NIE y CIF (comprobando su letra o dígito de control), IBAN españoles (verificación mod-97), móviles españoles con o sin prefijo +34, correos electrónicos y tarjetas de pago (algoritmo de Luhn). Al validar el checksum, un número que no cuadra no se marca, lo que reduce los falsos positivos. Además, nombres de persona y de empresa, reconocidos por el contexto.",
  },
  {
    question: "¿Basta con esto para cumplir el RGPD?",
    answer:
      "No lo garantiza. La detección funciona por patrones y puede dejar datos sin cubrir, así que revisa siempre el texto protegido antes de enviarlo. Además, reemplazar datos por marcadores reversibles es seudonimización, que reduce el riesgo pero no equivale a anonimizar. PromptShield es una herramienta de apoyo, no asesoramiento legal.",
  },
  {
    question: "¿Qué archivos admite?",
    answer:
      "CSV, TSV, TXT, JSON y otros formatos de texto, que se procesan por partes sin límite práctico de tamaño y conservan su estructura byte a byte salvo los datos sustituidos. También XLSX y XLS, que se cargan enteros en memoria y se devuelven como .xlsx con valores y fórmulas, pero sin estilos, gráficos ni macros.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer: "Hoy es gratuito y no necesitas crear una cuenta.",
  },
];
