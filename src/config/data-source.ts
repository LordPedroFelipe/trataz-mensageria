import 'reflect-metadata';
import path from 'path';
import { DataSource } from 'typeorm';
import { ambiente } from './ambiente';
import { Paciente } from '../dominio/entidades/Paciente';
import { Profissional } from '../dominio/entidades/Profissional';
import { Tratamento } from '../dominio/entidades/Tratamento';
import { MessageDispatchAudit } from '../dominio/entidades/MessageDispatchAudit';

export const AppDataSource = new DataSource({
  type: 'mysql',
  url: ambiente.databaseUrl,
  host: ambiente.db.host,
  port: ambiente.db.port,
  username: ambiente.db.usuario,
  password: ambiente.db.senha,
  database: ambiente.db.nome,
  entities: [Paciente, Profissional, Tratamento, MessageDispatchAudit],
  migrations: [path.join(__dirname, '..', 'infra', 'migracoes', '*.{js,ts}')],
  synchronize: ambiente.sincronizarBanco,
  logging: false
});
