import { AppDataSource } from '../../config/data-source';
import { logger } from '../../config/logger';
import { Clinica } from '../../dominio/entidades/Clinica';

export class ClinicaRepositorio {
  async buscarComSenhaTemporariaAtualizadaApos(dataIso: string): Promise<Clinica[]> {
    const data = new Date(dataIso);
    return AppDataSource.getRepository(Clinica)
      .createQueryBuilder('c')
      .where('c.atualizadoEm > :data', { data })
      .andWhere('c.senhaTemporaria IS NOT NULL')
      .andWhere('c.email IS NOT NULL')
      .getMany();
  }

  async buscarPorId(id: number): Promise<Clinica | null> {
    return AppDataSource.getRepository(Clinica).findOne({ where: { id } });
  }

  async marcarSenhaTemporariaEnviada(id: number): Promise<boolean> {
    logger.warn({ entidade: 'clinica', clinicaId: id }, 'Schema atual de Clinic nao possui coluna de controle de envio; auditoria sera a fonte de verdade');
    return false;
  }
}
