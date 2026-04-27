import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { AppDataSource } from '../../config/data-source';
import { PasswordReset } from '../../dominio/entidades/PasswordReset';

const PASSWORD_SETUP_PURPOSE = 'PASSWORD_SETUP';
const PASSWORD_RESET_PURPOSE = 'PASSWORD_RESET';

export class PasswordResetRepositorio {
  private repositorio(): Repository<PasswordReset> {
    return AppDataSource.getRepository(PasswordReset);
  }

  async buscarPendentesApos(dataIso: string): Promise<PasswordReset[]> {
    const data = new Date(dataIso);
    return this.repositorio().find({
      where: {
        criadoEm: MoreThan(data),
        used: false,
        expiraEm: MoreThan(new Date()),
        purpose: PASSWORD_RESET_PURPOSE
      },
      order: {
        criadoEm: 'ASC'
      }
    });
  }

  async buscarPorId(id: string): Promise<PasswordReset | null> {
    return this.repositorio().findOne({ where: { id } });
  }

  async buscarPasswordResetValidoPorId(id: string): Promise<PasswordReset | null> {
    return this.repositorio().findOne({
      where: {
        id,
        used: false,
        expiraEm: MoreThan(new Date()),
        purpose: PASSWORD_RESET_PURPOSE
      }
    });
  }

  async buscarPasswordSetupValidoPorId(id: string): Promise<PasswordReset | null> {
    return this.repositorio().findOne({
      where: {
        id,
        used: false,
        expiraEm: MoreThan(new Date()),
        purpose: PASSWORD_SETUP_PURPOSE
      }
    });
  }

  async buscarUltimoPendentePorEmail(email: string): Promise<PasswordReset | null> {
    return this.repositorio().findOne({
      where: {
        email,
        used: false,
        expiraEm: MoreThan(new Date()),
        purpose: PASSWORD_RESET_PURPOSE
      },
      order: {
        criadoEm: 'DESC'
      }
    });
  }

  async buscarExpiradosAte(data: Date): Promise<PasswordReset[]> {
    return this.repositorio().find({
      where: {
        used: false,
        expiraEm: LessThanOrEqual(data)
      }
    });
  }
}
