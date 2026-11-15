import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import express, { type NextFunction, type Request, type Response } from 'express';
import { isLocal } from '../config';
import { AppError } from '../platform/errors';
import { SERVICES, type Services } from '../services';
import { CoreController, KnowledgeController, RunsController, SyncController } from './controllers';
import { ProductController } from './product-controller';

@Catch()
class Errors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    if (res.headersSent) return;
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const trace_id = String(res.getHeader('X-Trace-Id') ?? randomUUID());
    if (status >= 500) {
      console.error(JSON.stringify({ level:'error',trace_id,method:req.method,status,
        type: error instanceof Error ? error.name : 'Unknown',code: error instanceof AppError ? error.code : undefined }));
    }
    res.status(status).json({
      error: error instanceof AppError
        ? { code: error.code,message: error.message,retryable: error.retryable,details: error.details,trace_id }
        : { code: status === 404 ? 'RESOURCE_NOT_FOUND' : status === 413 ? 'VALIDATION_BODY_SIZE' : status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_HTTP',
            message: status >= 500 ? 'Request failed' : status === 413 ? 'Request body too large' : 'Invalid request',
            retryable: status >= 500, details: {},trace_id },
    });
  }
}

export async function createApp(services: Services, quiet = false) {
  const app = await NestFactory.create({
    module: class ApiModule {},
    controllers: [CoreController,KnowledgeController,RunsController,SyncController,ProductController],
    providers: [{ provide: SERVICES,useValue: services }],
  },{ bodyParser:false,logger:quiet ? false : ['error','warn'] });
  const configuredOrigins = (process.env.AKW_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean);
  const loopback = (value: string) => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(value);
  app.use((req: Request,res: Response,next: NextFunction) => {
    const trace_id = randomUUID();
    res.setHeader('X-Trace-Id',trace_id);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    const origin = req.get('origin');
    const forwarded = req.get('x-forwarded-host');
    const host = req.get('host');
    const safeOrigin = !origin || configuredOrigins.includes(origin) || (isLocal && /^https?:\/\//.test(origin) && loopback(origin.replace(/^https?:\/\//,'')));
    if ((isLocal && (!host || !loopback(host) || (forwarded && !loopback(forwarded)))) || (!['GET','HEAD','OPTIONS'].includes(req.method) && !safeOrigin)) {
      res.status(403).json({ error:{ code:'PERMISSION_ORIGIN',message:'Origin or host unavailable',retryable:false,details:{},trace_id } });
      return;
    }
    next();
  });
  app.use(express.json({ limit: '12mb' }));
  app.useGlobalFilters(new Errors());
  return app;
}
