
import express from 'express';
import 'reflect-metadata';
import { rotas } from './rotas';
import { erroMiddleware } from './compartilhado/middlewares/erroMiddleware';

export const app = express();
app.use(express.json());
app.use(rotas);
app.use(erroMiddleware);
