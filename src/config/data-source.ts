import 'reflect-metadata';
import path from 'path';
import { DataSource } from 'typeorm';
import { ambiente } from './ambiente';
import { Clinica } from '../dominio/entidades/Clinica';
import { Conteudo } from '../dominio/entidades/Conteudo';
import { Paciente } from '../dominio/entidades/Paciente';
import { PasswordReset } from '../dominio/entidades/PasswordReset';
import { Profissional } from '../dominio/entidades/Profissional';
import { Reminder } from '../dominio/entidades/Reminder';
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
  entities: [Clinica, Conteudo, Paciente, PasswordReset, Profissional, Reminder, Tratamento, MessageDispatchAudit],
  migrations: [path.join(__dirname, '..', 'infra', 'migracoes', '*.{js,ts}')],
  synchronize: ambiente.sincronizarBanco,
  logging: false
});
