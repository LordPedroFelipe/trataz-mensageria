import { AppDataSource } from '../../config/data-source';
import { Tratamento } from '../../dominio/entidades/Tratamento';
import { logger } from '../../config/logger';

export class TratamentoRepositorio {
  async buscarNovosApos(dataIso: string): Promise<Tratamento[]> {
    const data = new Date(dataIso);
    return AppDataSource.getRepository(Tratamento)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.paciente', 'paciente')
      .leftJoinAndSelect('t.profissional', 'profissional')
      .where('t.criadoEm > :data', { data })
      .getMany();
  }

  async marcarTratamentoNotificado(id: number): Promise<boolean> {
    logger.warn({ entidade: 'tratamento', tratamentoId: id }, 'Schema atual de Treatment nao possui coluna de controle de notificacao; auditoria sera a fonte de verdade do envio');
    return false;
  }
}
