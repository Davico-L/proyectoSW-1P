export type HelpTopic = { id: string; question: string; answer: string };

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "empezar",
    question: "¿Cómo empiezo a usar la herramienta?",
    answer:
      "Creá una cuenta con \"Crear cuenta\" (nombre de usuario y contraseña de mínimo 6 caracteres) o entrá con \"Iniciar sesión\".\nEn \"Mis diagramas\" escribí un nombre (opcional) y tocá \"Crear diagrama\", o tocá \"Abrir\" en uno que ya tengas.\nPara volver a la lista desde el lienzo, abrí el menú principal y elegí \"Mis diagramas\".\nEl diagrama se guarda solo, no hace falta un botón de guardar.",
  },
  {
    id: "crear-clase",
    question: "¿Cómo creo una clase con atributos y métodos?",
    answer:
      "1. Tocá el botón \"Nueva clase UML\" de la barra superior.\n2. Escribí el nombre en \"Nombre de la clase\" (obligatorio).\n3. En \"Atributos\" tocá \"+ Agregar atributo\" y completá nombre, tipo (String, Integer, Long, Boolean, Double o Date) y visibilidad (public, private o protected).\n4. En \"Métodos\" tocá \"+ Agregar método\" y completá nombre, tipo de retorno (los mismos tipos o void) y visibilidad.\n5. Tocá \"Confirmar\".",
  },
  {
    id: "editar-clase",
    question: "¿Cómo edito una clase?",
    answer:
      "Hacé doble clic sobre la clase. Se abre \"Editar Clase UML\" donde podés cambiar el nombre, agregar o quitar atributos y métodos (con el botón ✕ de cada uno) y tocar \"Confirmar\".",
  },
  {
    id: "crear-relacion",
    question: "¿Cómo agrego una relación (por ejemplo de herencia)?",
    answer:
      "1. En la barra superior elegí el tipo: \"Relación UML: Asociación\", \"Herencia\", \"Composición\" o \"Agregación\".\n2. Hacé clic en la clase de origen (el indicador dice \"Seleccione la clase de origen\").\n3. Hacé clic en la clase de destino.\nNo se puede relacionar una clase consigo misma. Para cancelar tocá la ✕ del indicador.\nEn Herencia, el origen es la clase hija y el destino la clase padre.",
  },
  {
    id: "multiplicidad",
    question: "¿Cómo cambio la multiplicidad de una relación?",
    answer:
      "Hacé doble clic sobre la relación. En \"Editar multiplicidades\" elegí \"Multiplicidad origen\" y \"Multiplicidad destino\" entre 1, 0..1, 0..*, 1..* y *, y tocá \"Confirmar\".",
  },
  {
    id: "cambiar-tipo-relacion",
    question: "¿Cómo cambio el tipo de una relación?",
    answer:
      "El tipo no se puede cambiar sobre una relación existente. Eliminala y volvé a crearla eligiendo el tipo que querés.",
  },
  {
    id: "borrar",
    question: "¿Cómo borro una clase o una relación?",
    answer:
      "Seleccionala en el lienzo y presioná Supr o Backspace (o usá el ícono de papelera del menú flotante). Si borrás una clase, también se borran las relaciones conectadas a ella.",
  },
  {
    id: "compartir",
    question: "¿Cómo comparto el diagrama con un compañero?",
    answer:
      "1. Tocá \"Compartir\" en la barra superior.\n2. Tocá \"Copiar\" para copiar el enlace.\n3. Pasale el enlace a tu compañero. Quien lo abra puede editar el diagrama con vos en tiempo real.",
  },
  {
    id: "ia-texto",
    question: "¿Cómo uso el asistente de IA para editar con texto?",
    answer:
      "1. Tocá el botón flotante de destellos (Asistente IA) para abrir el panel \"Asistente Copilot UML\".\n2. En modo Editar escribí qué querés hacer, por ejemplo: \"Agregá una clase Cliente con nombre y email\".\n3. Presioná Enter para enviar (Shift+Enter hace un salto de línea).\nLa IA modifica el diagrama por vos.",
  },
  {
    id: "ia-voz",
    question: "¿Cómo uso la voz o el dictado por micrófono?",
    answer:
      "1. Abrí el asistente y tocá el botón de micrófono (\"Dictar instrucción por voz\").\n2. Hablá y revisá el texto que aparece en el cuadro.\n3. Presioná Enter para enviarlo.\nNecesitás dar permiso al micrófono en el navegador. Si el botón de micrófono aparece deshabilitado, tu navegador no soporta dictado: usá el chat de texto.",
  },
  {
    id: "ia-foto",
    question: "¿Cómo creo un diagrama a partir de una foto?",
    answer:
      "1. Abrí el asistente y tocá el clip (\"Adjuntar imagen\") o pegá la imagen desde el portapapeles.\n2. Usá una imagen JPG, PNG o WEBP de un diagrama de clases, de hasta 15 MB.\n3. Enviala y la IA agrega al lienzo las clases y relaciones que reconozca.",
  },
  {
    id: "generar-backend",
    question: "¿Cómo genero el backend?",
    answer:
      "Con tu diagrama abierto y con al menos una clase, tocá \"Generar Backend\" en la barra superior. Se descarga un ZIP con un proyecto Spring Boot (Maven): una entidad, un repositorio y un controlador por cada clase, una colección de Postman y un docker-compose con Postgres. Las relaciones con \"muchos\" en ambos extremos se generan como muchos a muchos.",
  },
  {
    id: "ejecutar-backend",
    question: "¿Cómo ejecuto el backend generado?",
    answer:
      "1. Requisitos: necesitás tener instalados Java 17 o superior, Maven y Docker.\n2. Descomprimí el ZIP descargado y abrí una terminal en la carpeta del proyecto.\n3. Levantá la base de datos PostgreSQL ejecutando: docker compose up -d\n4. Iniciá la aplicación ejecutando: mvn spring-boot:run\n5. La API se iniciará en el puerto 8081 (http://localhost:8081).\n6. Para probar los endpoints, abrí Postman e importá el archivo postman-collection.json que viene incluido.",
  },
  {
    id: "xmi",
    question: "¿Cómo exporto o importo un diagrama en XMI?",
    answer:
      "Para exportar tocá \"Exportar a XMI\" en la barra superior: se descarga un archivo XMI 2.1.\nPara importar tocá \"Importar desde XMI\" y elegí un archivo .xmi o .xml: las clases y relaciones se dibujan en el lienzo.",
  },
  {
    id: "asistente",
    question: "¿Qué puedo hacer con este asistente?",
    answer:
      "El asistente tiene dos modos.\nEditar: le pedís por texto, voz o foto que agregue, modifique o elimine clases y relaciones, y lo hace sobre el diagrama.\nAyuda: me preguntás cómo usar la herramienta y te explico los pasos, sin modificar el diagrama.",
  },
  {
    id: "generar-deshabilitado",
    question: "El botón Generar Backend está deshabilitado, ¿qué hago?",
    answer:
      "Asegurate de tener un diagrama abierto desde \"Mis diagramas\" (el diagrama se guarda solo). Además, el diagrama tiene que tener al menos una clase. Si ya lo tenés y sigue deshabilitado, esperá unos segundos a que termine de guardarse.",
  },
];
