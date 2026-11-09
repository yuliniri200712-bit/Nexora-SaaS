import express from 'express';
import type { ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { config, csrfCookie } from './core/config.js';
import { equal } from './core/crypto.js';
import { AppError } from './core/errors.js';
import { db } from './infrastructure/database.js';
import { authRoutes } from './modules/auth/routes.js';
import { apiRoutes } from './routes.js';
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', false);
app.use(helmet());
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.set('X-Request-Id', req.requestId).set('Cache-Control', 'no-store');
  next();
});
app.use(cookieParser());
app.use(express.json({ limit: '128kb' }));
app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/ready', async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: 'ready' });
});
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: config.NODE_ENV === 'test' ? 5000 : 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { code: 'RATE_LIMIT', message: 'Demasiadas solicitudes. Intenta en un minuto.' },
  }),
);
app.use('/api', (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('Origin'),
      header = req.get('X-CSRF-Token'),
      cookie: unknown = req.cookies?.[csrfCookie];
    if (
      origin !== config.APP_ORIGIN ||
      typeof cookie !== 'string' ||
      !header ||
      !equal(header, cookie)
    )
      throw new AppError(403, 'CSRF', 'La sesión de seguridad cambió. Recarga la página.');
  }
  next();
});
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', apiRoutes);
app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Ruta no disponible.')));
const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({
      code: 'VALIDATION',
      message: 'Revisa los datos del formulario.',
      fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      requestId: req.requestId,
    });
    return;
  }
  if (error instanceof AppError) {
    res
      .status(error.status)
      .json({ code: error.code, message: error.message, requestId: req.requestId });
    return;
  }
  if (error instanceof multer.MulterError) {
    res.status(422).json({
      code: 'UPLOAD',
      message: 'Sube una sola imagen de hasta 5 MB.',
      requestId: req.requestId,
    });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const unavailable = ['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2028'].includes(error.code);
    const status = unavailable ? 503 : error.code === 'P2025' ? 404 : 409;
    res.status(status).json({
      code: unavailable ? 'SERVICE_UNAVAILABLE' : 'DATA_CONFLICT',
      message: unavailable
        ? 'El servicio de datos no está disponible. Intenta nuevamente en un momento.'
        : error.code === 'P2002'
          ? 'Ya existe un registro con esos datos.'
          : error.code === 'P2003'
            ? 'El registro está asociado a otros datos.'
            : 'Los datos cambiaron. Actualiza e intenta de nuevo.',
      requestId: req.requestId,
    });
    return;
  }
  if (error instanceof SyntaxError) {
    res
      .status(400)
      .json({ code: 'INVALID_JSON', message: 'Solicitud no válida.', requestId: req.requestId });
    return;
  }
  console.error(
    JSON.stringify({
      event: 'request.failed',
      requestId: req.requestId,
      errorType: error instanceof Error ? error.name : 'Unknown',
    }),
  );
  res.status(500).json({
    code: 'INTERNAL',
    message: 'No pudimos completar la operación. Intenta nuevamente.',
    requestId: req.requestId,
  });
};
app.use(errorHandler);
