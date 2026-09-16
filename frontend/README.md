# Frontend - Cliente Web (Excalidraw)

Este directorio contiene la aplicación cliente web del proyecto, basada en el repositorio oficial de código abierto [Excalidraw](https://github.com/excalidraw/excalidraw).

## Modificaciones Planificadas

Se mantendrá la arquitectura base del proyecto, planificando las siguientes modificaciones clave:

### 1. Persistencia con Backend Propio
- **Sustitución de Local Storage**: Reemplazar el almacenamiento local del navegador (`localStorage` / IndexedDB) por comunicación directa con nuestro backend (`/backend`).
- **Sincronización de Diagramas**: Envío y recuperación del estado del lienzo (`elements`, `appState`, `files`) mediante APIs REST y/o WebSockets para persistencia multiusuario y respaldo seguro en base de datos.

### 2. Panel Lateral para Asistente de IA
- **Interfaz del Asistente**: Integración de un panel lateral (sidebar) colapsable en la vista principal de la aplicación.
- **Interacción y Asistencia**: Espacio de interacción para chatear con el asistente de IA, solicitar generación y estructuración de diagramas, y recibir sugerencias o transformaciones directamente sobre los elementos del lienzo.

---

## Comandos de Desarrollo

Para ejecutar el entorno local de desarrollo:

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor de desarrollo
npm run dev
```

El servidor estará disponible en `http://localhost:3000` (o el siguiente puerto disponible, ej. `http://localhost:3001`).

---

*Proyecto base: [Excalidraw](https://github.com/excalidraw/excalidraw) (Licencia MIT).*
