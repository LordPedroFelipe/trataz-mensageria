
import pino from 'pino';
import { ambiente } from './ambiente';

export const logger = pino({ level: ambiente.nivelLog });
