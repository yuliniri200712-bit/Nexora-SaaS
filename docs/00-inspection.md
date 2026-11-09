# Inspección inicial

Fecha de revisión: 2026-11-08, zona de referencia America/Bogota.

## Alcance autorizado

El usuario autorizó expresamente la Fase 0 después de confirmar que abarca inspección y documentación de arquitectura, datos, seguridad, diseño visual y roadmap. La implementación de la Fase 1 queda fuera de este trabajo.

## Evidencia local

Directorio inspeccionado: `C:\Users\Usuario\OneDrive\Desktop\Nexora`.

| Comprobación | Resultado observado |
| --- | --- |
| `Get-ChildItem -Force` | Directorio inicialmente vacío, incluidos archivos ocultos |
| `rg --files` con filtros AGENTS, package.json y README | Sin archivos coincidentes |
| AGENTS.md en raíz y ancestros hasta C:\ | No encontrado |
| PROJECT_STATUS.md, README y docs | No existían |
| `git status --short --branch` | Error: no es un repositorio Git |
| `git rev-parse --show-toplevel` | Error: no es un repositorio Git |
| Dependencias, lockfiles, scripts, CI y migraciones | No existen |
| Arquitectura o código funcional previo | No existe en este directorio |

La ausencia de archivos se refiere a esta carpeta; no se ha buscado código en otros proyectos del usuario. No se ha inicializado Git ni creado un remoto. Por no existir historial, no es posible presentar un `git diff`; se verifican los archivos creados y su alcance.

## Herramientas detectadas

| Herramienta | Evidencia | Límite de la comprobación |
| --- | --- | --- |
| Node.js | `node --version`: v24.19.0 | No se comprobó compatibilidad con dependencias aún inexistentes |
| npm | `npm.cmd --version`: 11.17.0 | No se instalaron paquetes |
| Git | `git --version`: 2.55.0.windows.4 | No hay repositorio local |
| Docker CLI | `docker --version`: 29.8.0, build 88096ef | No se comprobó el daemon ni se levantaron contenedores |
| pnpm | Ejecutable detectado en PATH | No se ejecutó ni se eligió como gestor |
| Flutter | Ejecutable detectado; caché declara 3.47.7 stable | Lectura de `C:\dev\flutter\bin\cache\flutter.version.json`; no `flutter doctor` ni build |
| Dart | Ejecutable detectado; caché de Flutter declara 3.13.5 | No se comprobó Android SDK ni dispositivo |
| mysql | No encontrado como comando en PATH | No demuestra ausencia de un servidor local o remoto |

## Entradas y conservación

- Documento fuente: `C:\Users\Usuario\Downloads\Prompt_NEXORA_Codex.md`, 16.097 bytes; copia de referencia en `docs/references/`.
- Imagen aportada: `C:\Users\Usuario\AppData\Local\Temp\codex-clipboard-4cea57f4-ff56-44a6-9239-93832dba308c.png`, 1.132.864 bytes; copia sin modificación en `brand/nexora-reference.png`.
- La referencia muestra cuatro composiciones: marca sobre verde oscuro, símbolo sobre degradado, construcción geométrica y marca blanca sobre textura verde. Es una lámina de identidad, no un paquete de logotipos listo para interfaz.
- SHA-256 de la imagen original: `27E90EFEC8F7C2D74D72247B060463E6DDDC8419D10F05283E948AF0761E4D8E`.

## Estado funcional real

Todos los módulos están pendientes: identidad y negocios; productos; inventario; ventas; pedidos; clientes; empleados; reportes; WhatsApp; repartidores; seguimiento; planes; pagos; landing; administración de NEXORA. La marca tiene una referencia raster disponible. Su sistema de diseño se define en esta fase únicamente como especificación.

Las pruebas unitarias, de integración, E2E, de carga y de seguridad no se pueden ejecutar todavía: faltan código, manifiestos y runners. Las comprobaciones de esta fase cubren integridad de archivos, enlaces locales, consistencia documental y contraste de colores, no comportamiento de producto.
