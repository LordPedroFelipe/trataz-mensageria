import { AppDataSource } from '../../config/data-source';
import { Reminder } from '../../dominio/entidades/Reminder';

export class ReminderRepositorio {
  async listarAtivos(): Promise<Reminder[]> {
    return AppDataSource.getRepository(Reminder)
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.tratamento', 'tratamento')
      .leftJoinAndSelect('r.paciente', 'paciente')
      .leftJoinAndSelect('r.conteudo', 'conteudo')
      .leftJoinAndSelect('tratamento.profissional', 'profissional')
      .where('r.ativo = :ativo', { ativo: true })
      .andWhere('paciente.email IS NOT NULL')
      .getMany();
  }

  async buscarPorId(id: number): Promise<Reminder | null> {
    return AppDataSource.getRepository(Reminder)
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.tratamento', 'tratamento')
      .leftJoinAndSelect('r.paciente', 'paciente')
      .leftJoinAndSelect('r.conteudo', 'conteudo')
      .leftJoinAndSelect('tratamento.profissional', 'profissional')
      .where('r.id = :id', { id })
      .getOne();
  }
}
