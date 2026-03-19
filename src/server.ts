import { app } from './app';
import { ambiente } from './config/ambiente';
import { AppDataSource } from './config/data-source';
import { logger } from './config/logger';
import { iniciarWorkerMensageria } from './processos/iniciarWorker';

(async () => {
  try {
    await AppDataSource.initialize();
    logger.info('Conexao com banco estabelecida');

    if (ambiente.worker.ativo) {
      iniciarWorkerMensageria(ambiente.worker.intervaloMs);
    } else {
      logger.info('Worker de mensageria desativado por configuracao');
    }

    app.listen(ambiente.porta, () => {
      logger.info(`Servidor ouvindo em http://0.0.0.0:${ambiente.porta}`);
    });
  } catch (erro: unknown) {
    logger.error({ erro }, 'Falha na inicializacao');
    process.exit(1);
  }
})();
