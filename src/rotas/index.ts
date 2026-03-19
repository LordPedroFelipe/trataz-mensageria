import { Router } from 'express';
import { MensageriaControlador } from '../apresentacao/controladores/MensageriaControlador';
import { SaudeControlador } from '../apresentacao/controladores/SaudeControlador';

const rotas = Router();
const saudeCtrl = new SaudeControlador();
const mensageriaCtrl = new MensageriaControlador();

rotas.get('/health', (req, res) => saudeCtrl.obter(req, res));
rotas.get('/mensageria/dry-run', (req, res) => mensageriaCtrl.dryRun(req, res));
rotas.get('/mensageria/auditoria', (req, res) => mensageriaCtrl.historico(req, res));

export { rotas };
