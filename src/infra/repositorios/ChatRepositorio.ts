import { AppDataSource } from '../../config/data-source';
import { ChatConversation } from '../../dominio/entidades/ChatConversation';
import { ChatMessage } from '../../dominio/entidades/ChatMessage';

export class ChatRepositorio {
  async buscarOuCriarConversaPacienteProfissional(patientId: number, professionalId: number): Promise<ChatConversation> {
    const conversationRepo = AppDataSource.getRepository(ChatConversation);
    const existente = await conversationRepo.findOne({
      where: {
        patientId,
        professionalId
      }
    });

    if (existente) {
      return existente;
    }

    return conversationRepo.save(
      conversationRepo.create({
        patientId,
        professionalId,
        clinicId: null
      })
    );
  }

  async criarMensagemPaciente(conversationId: number, patientId: number, content: string): Promise<ChatMessage> {
    const messageRepo = AppDataSource.getRepository(ChatMessage);
    return messageRepo.save(
      messageRepo.create({
        conversationId,
        senderId: patientId,
        senderType: 'PATIENT',
        content,
        read: false
      })
    );
  }
}
