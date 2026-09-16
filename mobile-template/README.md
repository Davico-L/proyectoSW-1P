# Mobile Template - Aplicación Móvil (Flutter)

Plantilla base para la aplicación móvil del proyecto, desarrollada con **Flutter** y **Dart**, preparada con dependencias nativas para persistencia local y procesamiento de voz.

## Dependencias Incluidas en `pubspec.yaml`

- **`sqflite`**: Soporte para base de datos relacional SQLite local en Android e iOS.
- **`speech_to_text`**: API nativa para reconocimiento y transcripción de voz a texto.
- *Nota*: Ambas librerías están agregadas, resueltas y verificadas en la compilación, listas para su integración funcional en futuras fases.

## Estructura del Módulo

```text
mobile-template/
├── lib/
│   └── main.dart            # Pantalla de ejemplo única con Material 3
├── test/
│   └── widget_test.dart     # Prueba de humo de renderizado
├── android/                 # Configuración nativa Android (Gradle, permisos)
├── ios/                     # Configuración nativa iOS
└── pubspec.yaml             # Definición del paquete y dependencias
```

## Ejecución y Compilación

### 1. Obtener dependencias
```bash
flutter pub get
```

### 2. Analizar y probar código
```bash
flutter analyze
flutter test
```

### 3. Ejecutar en Emulador o Dispositivo
```bash
# Listar emuladores y dispositivos disponibles
flutter devices
flutter emulators

# Iniciar la aplicación
flutter run

# O especificar un emulador/dispositivo puntual:
flutter run -d <device_id>
```

### 4. Compilar APK de Android (Debug)
```bash
flutter build apk --debug
```
*El APK generado se ubica en `build/app/outputs/flutter-apk/app-debug.apk`.*
