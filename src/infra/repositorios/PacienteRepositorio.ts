import { AppDataSource } from '../../config/data-source';
import { Paciente } from '../../dominio/entidades/Paciente';
import { logger } from '../../config/logger';

export class PacienteRepositorio {
  async buscarNovosApos(dataIso: string): Promise<Paciente[]> {
    const data = new Date(dataIso);
    return AppDataSource.getRepository(Paciente)
      .createQueryBuilder('p')
      .where('p.criadoEm > :data', { data })
      .andWhere('(p.email IS NOT NULL OR p.telefone IS NOT NULL)')
      .getMany();
  }

  async buscarComSenhaTemporariaAtualizadaApos(dataIso: string): Promise<Paciente[]> {
    const data = new Date(dataIso);
    return AppDataSource.getRepository(Paciente)
      .createQueryBuilder('p')
      .where('p.atualizadoEm > :data', { data })
      .andWhere('p.senhaTemporaria IS NOT NULL')
      .andWhere('p.email IS NOT NULL')
      .getMany();
  }

  async buscarPorId(id: number): Promise<Paciente | null> {
    return AppDataSource.getRepository(Paciente).findOne({ where: { id } });
  }

  async marcarBoasVindasEnviado(id: number): Promise<boolean> {
    logger.warn({ entidade: 'paciente', pacienteId: id }, 'Schema atual de Patient nao possui coluna de controle de notificacao; auditoria sera a fonte de verdade do envio');
    return false;
  }

  async marcarSenhaTemporariaEnviada(id: number): Promise<boolean> {
    logger.warn({ entidade: 'paciente', pacienteId: id }, 'Schema atual de Patient nao possui coluna de controle de envio; auditoria sera a fonte de verdade');
    return false;
  }
}
