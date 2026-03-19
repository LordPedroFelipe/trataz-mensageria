import { MensageriaServico } from '../servicos/MensageriaServico';
import { logger } from '../config/logger';

/**
 * Worker simples baseado em intervalo.
 * Em producao, considere mover para fila (bullmq) ou Agenda para estrategias de retry/delay.
 */
export function iniciarWorkerMensageria(intervaloMs = 60000) {
  const svc = new MensageriaServico();
  let cicloEmExecucao = false;

  const executarCiclo = async () => {
    if (cicloEmExecucao) {
      logger.warn('Ciclo anterior ainda em execucao; nova iteracao ignorada');
      return;
    }

    cicloEmExecucao = true;

    try {
      await svc.ciclo();
    } finally {
      cicloEmExecucao = false;
    }
  };

  logger.info({ intervaloMs }, 'Iniciando worker de mensageria');
  void executarCiclo();
  setInterval(() => void executarCiclo(), intervaloMs);
}
