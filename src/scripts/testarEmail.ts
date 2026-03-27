import 'dotenv/config';
import { EmailServico } from '../servicos/EmailServico';

async function main(): Promise<void> {
  const destino = process.argv[2] ?? process.env.SMTP_USUARIO ?? '';

  if (!destino) {
    throw new Error('Informe o email de destino como argumento ou configure SMTP_USUARIO no .env');
  }

  const emailServico = new EmailServico();
  const resultado = await emailServico.enviarBoasVindasPaciente(
    destino,
    'Teste',
    null,
    '123456'
  );

  console.log(JSON.stringify({
    destino,
    resultado
  }, null, 2));

  if (resultado.status !== 'success') {
    process.exitCode = 1;
  }
}

void main().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.error(mensagem);
  process.exit(1);
});
