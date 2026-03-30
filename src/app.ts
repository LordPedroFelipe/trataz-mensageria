
import express from 'express';
import 'reflect-metadata';
import { rotas } from './rotas';
import { erroMiddleware } from './compartilhado/middlewares/erroMiddleware';
import { ambiente } from './config/ambiente';

export const app = express();

app.use((req, res, next) => {
  const origem = req.headers.origin;

  if (origem && ambiente.cors.origins.includes(origem)) {
    res.header('Access-Control-Allow-Origin', origem);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] ?? 'Content-Type, Authorization'
    );
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());
app.use(rotas);
app.use(erroMiddleware);
