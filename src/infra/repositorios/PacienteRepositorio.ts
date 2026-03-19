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

  async marcarBoasVindasEnviado(id: number): Promise<boolean> {
    logger.warn({ entidade: 'paciente', pacienteId: id }, 'Schema atual de Patient nao possui coluna de controle de notificacao; auditoria sera a fonte de verdade do envio');
    return false;
  }
}
