import { AppDataSource } from '../../config/data-source';
import { Profissional } from '../../dominio/entidades/Profissional';
import { logger } from '../../config/logger';

export class ProfissionalRepositorio {
  async buscarNovosApos(dataIso: string): Promise<Profissional[]> {
    const data = new Date(dataIso);
    return AppDataSource.getRepository(Profissional)
      .createQueryBuilder('p')
      .where('p.criadoEm > :data', { data })
      .andWhere('(p.email IS NOT NULL OR p.telefone IS NOT NULL)')
      .getMany();
  }

  async marcarBoasVindasEnviado(id: number): Promise<boolean> {
    logger.warn({ entidade: 'profissional', profissionalId: id }, 'Schema atual de Professional nao possui coluna de controle de notificacao; auditoria sera a fonte de verdade do envio');
    return false;
  }
}
