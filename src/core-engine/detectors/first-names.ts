/**
 * Common first names in Spain: Spanish, Catalan, Basque and Galician, plus
 * the most frequent among residents born in Latin America, Morocco and
 * Romania. Lowercase and without accents; compare with `foldName`.
 */
const NAMES = `
aaron abel abigail abril adela adolfo adrian adriana agata agustin agustina
aina ainara ainhoa aitana aitor alba albert alberto alejandra alejandro
alex alexandra alexandre alexis alfonso alfredo alicia alma alvaro amaia
amaya amelia ana anabel anais andrea andres andreu angel angela angeles
angelica angustias anna antonia antonio araceli arantxa arantza ariadna
ariana ariel arnau arturo asier asuncion aurelio aurora axel beatriz
begona belen benito benjamin bernardo berta blanca borja brenda bruno
camila candela carla carlos carles carmelo carmen carolina catalina cayetana
cecilia celia cesar christian cintia claudia clara concepcion consuelo
cristian cristina cristobal dafne damian daniel daniela dario david debora
diana diego dolores domingo dylan edgar eduard eduardo elena eli elisa
elisabet eloy elsa elvira emilia emilio emma encarnacion enric enrique
eric erik ernesto esperanza esteban estefania estela ester esther eugenia
eugenio eulalia eva evaristo ezequiel fabian fatima federico felipe felix
fermin fernando fidel flor florencia francesc francisca francisco franco
gabriel gabriela gaizka gael gemma genoveva gerard gerardo german gil
gines gisela gloria gonzalo gorka gracia gregorio guadalupe guillem
guillermo gustavo hector helena hernan hilario horacio hugo humberto
ignacio igor imanol inaki ines inigo inmaculada irene iris irune isaac isabel
isidro ismael ivan izan jacinto jacobo jaime jan javier jesus joan joaquim
joaquin joel jon jordi jorge jose josefa josefina josep juan juana judit
julia julian julio justo karen karim karla laia lara laura lautaro leandro
leire leo leon leonardo leonor leticia lidia liliana lola lorena lorenzo
lourdes lucas lucia luciana luciano lucio luis luisa luna macarena
magdalena maialen maite manuel manuela marc marcela marcelo marcos
margarita mari maria mariana marina mario marisa marisol marta martin
martina mateo matias mauricio maximo mercedes miguel mikel milagros miriam
miren mohamed mohammed monica montserrat montse nahia naia natalia nerea
nicolas nieves noa noelia norma nuria octavio olga oliver olivia omar
oriol oscar pablo paco paloma paola pascual patricia pau paula paz pedro
pepe pere pilar pol rafael ramiro ramon raquel raul rebeca regina reyes
ricardo roberto rocio rodrigo rogelio rolando roman romina rosa rosalia
rosario ruben rufino ruth salvador samuel sandra santiago sara sebastian
sergi sergio silvia simon sofia sol soledad sonia susana tamara teresa
tomas toni ulises unai urko valentin valentina valeria vanesa vanessa
vicenta vicente victor victoria vidal virginia xabier xavier xavi ximena
xoan xose xurxo yaiza yolanda yeray zoe
ahmed ali amina fatma hamza hassan hicham karima khadija mustafa nadia
rachid said samira youssef yassine
alexandru andrei constantin cristi florin gheorghe ioana ion ionut mihai
mihaela nicolae vasile
alonso amparo andoni aritz asun ane anton begonya bernat dani enara
estibaliz eider garazi haizea iker ion jone josu julen maddi maialen markel
oihane uxue xabi
`;

/**
 * First names that are also everyday words, places or dates. They count as a
 * name only next to a surname, a title such as "Sra." or a greeting.
 */
const AMBIGUOUS = `
abril alba alma amparo angel angeles angustias asuncion aurora begona
belen blanca candela carmelo cesar concepcion consuelo cruz dolores domingo
ion jan said
encarnacion esperanza estrella fatima flor gloria gracia guadalupe iris
jesus julio leon leo lourdes luna mar marina mercedes milagros montserrat
nieves noa olivia paloma pastor paz pilar reyes rosa rosario salvador
santiago sol soledad victoria vidal gil franco simon roman regina justo
norma salud
`;

function wordSet(list: string): ReadonlySet<string> {
  return new Set(list.split(/\s+/).filter(Boolean));
}

export const FIRST_NAMES = wordSet(NAMES);
export const AMBIGUOUS_FIRST_NAMES = wordSet(AMBIGUOUS);

/** `"Iñaki"` -> `"inaki"`: lowercase without diacritics. */
export function foldName(word: string): string {
  return word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
