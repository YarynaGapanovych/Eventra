import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { allowedFrontendOrigins } from './auth/frontend-redirect';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: allowedFrontendOrigins(),
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && req.path === '/health') {
      res.status(200).send('ok');
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const port = Number(process.env.PORT ?? 3001);
  try {
    await app.listen(port);
    console.log(`API listening on http://localhost:${port}`);
  } catch (err) {
    const code =
      err instanceof Error && 'code' in err
        ? (err as NodeJS.ErrnoException).code
        : undefined;
    if (code === 'EADDRINUSE') {
      throw new Error(
        `Port ${port} is already in use. Stop the other process using that port, then restart the API.`,
      );
    }
    throw err;
  }
}

void bootstrap();
