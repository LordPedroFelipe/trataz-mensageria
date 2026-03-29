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

  async buscarComSenhaTemporariaAtualizadaApos(dataIso: string): Promise<Profissional[]> {
    const data = new Date(dataIso);
    return AppDataSource.getRepository(Profissional)
      .createQueryBuilder('p')
      .where('p.atualizadoEm > :data', { data })
      .andWhere('p.senhaTemporaria IS NOT NULL')
      .andWhere('p.email IS NOT NULL')
      .getMany();
  }

  async buscarPorId(id: number): Promise<Profissional | null> {
    return AppDataSource.getRepository(Profissional).findOne({ where: { id } });
  }

  async marcarBoasVindasEnviado(id: number): Promise<boolean> {
    logger.warn({ entidade: 'profissional', profissionalId: id }, 'Schema atual de Professional nao possui coluna de controle de notificacao; auditoria sera a fonte de verdade do envio');
    return false;
  }

  async marcarSenhaTemporariaEnviada(id: number): Promise<boolean> {
    logger.warn({ entidade: 'profissional', profissionalId: id }, 'Schema atual de Professional nao possui coluna de controle de envio; auditoria sera a fonte de verdade');
    return false;
  }
}
