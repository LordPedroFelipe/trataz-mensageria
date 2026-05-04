import { AppDataSource } from '../../config/data-source';
import { TreatmentContent } from '../../dominio/entidades/TreatmentContent';

export class TreatmentContentRepositorio {
  async buscarPorTratamentoEConteudo(treatmentId: number, contentId: number): Promise<TreatmentContent | null> {
    return AppDataSource.getRepository(TreatmentContent).findOne({
      where: {
        treatmentId,
        contentId
      }
    });
  }

  async marcarComoConcluido(id: number): Promise<TreatmentContent> {
    const repositorio = AppDataSource.getRepository(TreatmentContent);
    await repositorio.update({ id }, { status: 'COMPLETED' });
    return repositorio.findOneByOrFail({ id });
  }
}
