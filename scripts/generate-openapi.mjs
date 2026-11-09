import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import * as shared from '@nexora/shared';
const named = {
  Register: shared.registerSchema,
  Login: shared.loginSchema,
  Category: shared.categorySchema,
  Product: shared.productSchema,
  ProductUpdate: shared.productSchema.safeExtend({ version: z.number().int().nonnegative() }),
  Movement: shared.movementSchema,
  Invitation: shared.invitationSchema,
  AcceptInvitation: shared.acceptInvitationSchema,
  Employee: shared.employeeSchema,
  Settings: shared.settingsSchema,
  Forgot: z.object({ email: shared.emailSchema }).strict(),
  Reset: z.object({ token: z.string().length(64), password: shared.passwordSchema }).strict(),
  Switch: z.object({ membershipId: z.uuid() }).strict(),
  ProductStatus: z
    .object({ active: z.boolean(), version: z.number().int().nonnegative() })
    .strict(),
  Customer: shared.customerSchema,
  CustomerUpdate: z
    .object({ version: z.number().int().nonnegative(), data: shared.customerSchema })
    .strict(),
  Address: shared.addressSchema,
  Order: shared.orderSchema,
  OrderUpdate: z
    .object({ version: z.number().int().nonnegative(), order: shared.orderSchema })
    .strict(),
  Sale: shared.saleSchema,
  OrderVersion: shared.orderVersionSchema,
  CancelOrder: shared.cancelOrderSchema,
};
const schemas = Object.fromEntries(
  Object.entries(named).map(([key, schema]) => [key, z.toJSONSchema(schema, { io: 'input' })]),
);
schemas.Error = {
  type: 'object',
  required: ['code', 'message'],
  properties: {
    code: { type: 'string' },
    message: { type: 'string' },
    requestId: { type: 'string' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        properties: { path: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
};
const operations = [
  ['get', '/auth/csrf', 'Emitir token CSRF', null, 'public'],
  ['post', '/auth/register', 'Crear usuario, comercio y sesión', 'Register', 'public'],
  ['post', '/auth/login', 'Iniciar sesión', 'Login', 'public'],
  ['post', '/auth/forgot', 'Solicitar recuperación', 'Forgot', 'public'],
  ['post', '/auth/reset', 'Restablecer contraseña una sola vez', 'Reset', 'public'],
  ['get', '/auth/session', 'Consultar usuario y membresías', null, 'session'],
  ['post', '/auth/renew', 'Rotar sesión sin ampliar expiración absoluta', null, 'session'],
  ['post', '/auth/logout', 'Revocar sesión', null, 'session'],
  ['post', '/auth/switch', 'Seleccionar membresía propia', 'Switch', 'session'],
  [
    'post',
    '/invitations/accept',
    'Aceptar invitación; cuenta existente requiere contraseña actual',
    'AcceptInvitation',
    'public',
  ],
  ['get', '/products', 'Listar catálogo paginado', null, 'catalog:read'],
  ['post', '/products', 'Crear producto y variantes sin existencias', 'Product', 'catalog:write'],
  ['get', '/products/{id}', 'Consultar producto', null, 'catalog:read'],
  [
    'put',
    '/products/{id}',
    'Editar producto con control de versión',
    'ProductUpdate',
    'catalog:write',
  ],
  [
    'patch',
    '/products/{id}/status',
    'Archivar sin existencias o restaurar',
    'ProductStatus',
    'catalog:write',
  ],
  [
    'post',
    '/products/{id}/image',
    'Guardar imagen privada JPEG/PNG/WebP; máximo 5 MB y 16 MP',
    null,
    'catalog:write',
  ],
  ['get', '/images/{id}', 'Leer imagen privada del tenant', null, 'catalog:read'],
  ['get', '/categories', 'Consultar categorías', null, 'catalog:read'],
  ['post', '/categories', 'Crear categoría', 'Category', 'catalog:write'],
  ['put', '/categories/{id}', 'Editar categoría', 'Category', 'catalog:write'],
  ['delete', '/categories/{id}', 'Eliminar categoría sin productos', null, 'catalog:write'],
  ['get', '/inventory/movements', 'Consultar historial paginado', null, 'inventory:read'],
  [
    'post',
    '/inventory/movements',
    'Registrar cambio de stock transaccional e idempotente',
    'Movement',
    'inventory:write',
  ],
  [
    'get',
    '/reports/dashboard',
    'Resumen de stock actual y movimientos del periodo',
    null,
    'reports:read',
  ],
  [
    'get',
    '/reports/inventory.csv',
    'Exportar stock actual; máximo 10000 variantes',
    null,
    'reports:read',
  ],
  [
    'get',
    '/reports/movements.csv',
    'Exportar movimientos; máximo 10000 registros',
    null,
    'reports:read',
  ],
  ['get', '/employees', 'Listar miembros e invitaciones pendientes', null, 'employees:manage'],
  [
    'post',
    '/employees/invite',
    'Invitar persona por correo o buzón local',
    'Invitation',
    'employees:manage',
  ],
  [
    'patch',
    '/employees/{id}',
    'Modificar rol o acceso; revoca sesiones',
    'Employee',
    'employees:manage',
  ],
  ['delete', '/invitations/{id}', 'Revocar invitación pendiente', null, 'employees:manage'],
  ['get', '/settings', 'Consultar configuración del comercio', null, 'settings:manage'],
  ['put', '/settings', 'Actualizar nombre del comercio', 'Settings', 'settings:manage'],
  ['get', '/customers', 'Listar clientes paginados', null, 'customers:read'],
  ['post', '/customers', 'Crear cliente', 'Customer', 'customers:write'],
  ['get', '/customers/{id}', 'Consultar cliente, direcciones y compras', null, 'customers:read'],
  [
    'put',
    '/customers/{id}',
    'Editar cliente con control de versión',
    'CustomerUpdate',
    'customers:write',
  ],
  ['post', '/customers/{id}/addresses', 'Agregar dirección', 'Address', 'customers:write'],
  [
    'delete',
    '/customers/{id}/addresses/{addressId}',
    'Eliminar dirección',
    null,
    'customers:write',
  ],
  ['get', '/orders', 'Listar pedidos con filtros', null, 'orders:read'],
  ['post', '/orders', 'Crear borrador sin comprometer stock', 'Order', 'orders:write'],
  ['get', '/orders/{id}', 'Consultar pedido, líneas e historial', null, 'orders:read'],
  ['put', '/orders/{id}', 'Editar borrador con control de versión', 'OrderUpdate', 'orders:write'],
  [
    'post',
    '/orders/{id}/confirm',
    'Confirmar y reservar existencias',
    'OrderVersion',
    'orders:write',
  ],
  [
    'post',
    '/orders/{id}/complete',
    'Completar y consumir la reserva',
    'OrderVersion',
    'orders:write',
  ],
  ['post', '/orders/{id}/cancel', 'Cancelar y liberar la reserva', 'CancelOrder', 'orders:write'],
  ['post', '/sales', 'Registrar venta directa y descontar stock', 'Sale', 'orders:write'],
  ['get', '/reports/sales', 'Resumen de ventas completadas del periodo', null, 'reports:read'],
  ['get', '/reports/sales.csv', 'Exportar ventas; máximo 10000 registros', null, 'reports:read'],
];
const paths = {};
for (const [method, path, summary, body, permission] of operations) {
  const mutation = method !== 'get',
    security = {};
  if (permission !== 'public') security.Session = [];
  if (mutation) {
    security.CsrfHeader = [];
    security.CsrfCookie = [];
  }
  const parameters = [];
  if (path.includes('{id}'))
    parameters.push({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    });
  if (path.includes('{addressId}'))
    parameters.push({
      name: 'addressId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    });
  if (mutation)
    parameters.push({
      name: 'Origin',
      in: 'header',
      required: true,
      schema: { type: 'string', format: 'uri' },
      description: 'Debe coincidir con APP_ORIGIN.',
    });
  if (method === 'get' && ['/customers', '/orders'].includes(path))
    parameters.push(
      {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
      },
      { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
    );
  if (method === 'get' && path === '/orders')
    parameters.push(
      {
        name: 'status',
        in: 'query',
        schema: { type: 'string', enum: ['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] },
      },
      { name: 'channel', in: 'query', schema: { type: 'string', enum: ['COUNTER', 'DELIVERY'] } },
      { name: 'customerId', in: 'query', schema: { type: 'string', format: 'uuid' } },
    );
  if (method === 'get' && ['/products', '/inventory/movements'].includes(path))
    parameters.push({
      name: 'page',
      in: 'query',
      schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
    });
  if (method === 'get' && path === '/products')
    parameters.push(
      { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
      { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
      {
        name: 'archived',
        in: 'query',
        schema: { type: 'string', enum: ['true', 'false'], default: 'false' },
      },
    );
  if (
    method === 'get' &&
    [
      '/reports/dashboard',
      '/reports/movements.csv',
      '/reports/sales',
      '/reports/sales.csv',
      '/inventory/movements',
      '/orders',
    ].includes(path)
  )
    for (const name of ['from', 'to'])
      parameters.push({
        name,
        in: 'query',
        required: !['/inventory/movements', '/orders'].includes(path),
        schema: { type: 'string', format: 'date' },
        description:
          'Días de Colombia, ambos límites inclusivos. Si se filtra historial, enviar ambos.',
      });
  if (method === 'post' && ['/inventory/movements', '/orders', '/sales'].includes(path))
    parameters.push({
      name: 'Idempotency-Key',
      in: 'header',
      required: true,
      schema: { type: 'string', minLength: 16, maxLength: 100, pattern: '^[a-zA-Z0-9-]+$' },
    });
  const responses = {
    default: {
      description:
        'Error de validación (422), sesión (401), permiso/CSRF (403), recurso (404), conflicto (409), frecuencia (429) o servicio (503/500).',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
  };
  const created =
    method === 'post' &&
    [
      '/auth/register',
      '/products',
      '/categories',
      '/inventory/movements',
      '/employees/invite',
      '/products/{id}/image',
      '/customers',
      '/customers/{id}/addresses',
      '/orders',
      '/sales',
    ].includes(path);
  const media = path.endsWith('.csv')
    ? 'text/csv'
    : path === '/images/{id}'
      ? 'image/webp'
      : 'application/json';
  responses[created ? '201' : '200'] = {
    description:
      'Operación completada. DTO de respuesta tipado en packages/shared/src/index.ts; dinero como string decimal y fechas ISO UTC.',
    content: { [media]: { schema: media === 'application/json' ? {} : { type: 'string' } } },
  };
  const operation = {
    summary,
    description: `Ámbito: ${permission}. El tenant se obtiene del servidor y nunca se acepta en el cuerpo.`,
    security: Object.keys(security).length ? [security] : [],
    parameters,
    responses,
  };
  if (body)
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema: { $ref: `#/components/schemas/${body}` } } },
    };
  if (path === '/products/{id}/image')
    operation.requestBody = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['image'],
            properties: { image: { type: 'string', format: 'binary' } },
          },
        },
      },
    };
  (paths[path] ??= {})[method] = operation;
}
const spec = {
  openapi: '3.1.0',
  info: {
    title: 'NEXORA — API',
    version: '0.2.0',
    description:
      'Contrato de solicitudes y seguridad de las Fases 1 y 2. Respuestas de dominio tipadas en @nexora/shared. Cookies locales sin prefijo; producción usa __Host-nexora_session y __Host-nexora_csrf con Secure. No incluye fases posteriores.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    schemas,
    securitySchemes: {
      Session: { type: 'apiKey', in: 'cookie', name: 'nexora_session' },
      CsrfHeader: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
      CsrfCookie: { type: 'apiKey', in: 'cookie', name: 'nexora_csrf' },
    },
  },
  paths,
};
writeFileSync('docs/openapi.json', JSON.stringify(spec, null, 2) + '\n');
console.log(`${operations.length} operaciones documentadas.`);
