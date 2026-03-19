# Documentacao de Notificacoes

## Visao geral

Este servico e responsavel por detectar eventos de negocio no banco de dados e disparar notificacoes por email e WhatsApp.

Hoje o fluxo e baseado em polling:

1. O worker roda em intervalo fixo.
2. O servico consulta o banco procurando registros novos com dados de contato.
3. Antes de enviar, consulta a tabela `MessageDispatchAudit` para bloquear reenvio quando ja existe `success` para a mesma combinacao de entidade, tipo de notificacao e canal.
4. Para cada tentativa, registra uma linha de auditoria com sucesso, falha ou skip.

Arquivos principais:

- `src/processos/iniciarWorker.ts`
- `src/servicos/MensageriaServico.ts`
- `src/servicos/EmailServico.ts`
- `src/servicos/WhatsappServico.ts`
- `src/infra/repositorios/PacienteRepositorio.ts`
- `src/infra/repositorios/ProfissionalRepositorio.ts`
- `src/infra/repositorios/TratamentoRepositorio.ts`
- `src/infra/repositorios/MessageDispatchAuditRepositorio.ts`
- `src/dominio/entidades/MessageDispatchAudit.ts`

## Tabela de auditoria

Tabela propria da mensageria:

- `MessageDispatchAudit`

Objetivo:

- registrar tentativas de envio
- registrar sucesso
- registrar falha
- registrar skip
- bloquear reenvio com base em sucesso anterior

Campos atuais:

- `id`
- `entityType`
- `entityId`
- `notificationType`
- `channel`
- `status`
- `destination`
- `reason`
- `providerMessageId`
- `errorMessage`
- `attemptedAt`
- `createdAt`
- `updatedAt`

Comportamento:

- uma linha por tentativa
- o bloqueio de reenvio acontece quando ja existe um `success` para a chave logica
- chave logica atual: `entityType + entityId + notificationType + channel`

## Como o disparo acontece

O disparo nasce da leitura do banco da aplicacao.

As tabelas de origem monitoradas hoje sao:

- `Patient`
- `Professional`
- `Treatment`

Quando o servico encontra um registro novo com destino disponivel, ele:

1. determina os canais possiveis
2. verifica na `MessageDispatchAudit` se aquele canal ja teve `success`
3. se ja teve `success`, registra `skipped`
4. se nao teve, tenta enviar
5. registra `success`, `failed` ou `skipped`

## Worker

O worker e iniciado na subida da aplicacao, desde que `WORKER_ATIVO=true`.

Comportamento atual:

- executa um ciclo imediatamente ao iniciar
- executa novos ciclos conforme `WORKER_INTERVALO_MS`
- impede sobreposicao de ciclos
- registra `warn` se um ciclo ainda estiver rodando quando outro deveria comecar
- usa a auditoria como fonte de verdade para reenvio

Configuracoes relacionadas:

- `WORKER_ATIVO`
- `WORKER_INTERVALO_MS`

## Fontes de dados e regras de busca

### Pacientes

Tabela monitorada:

- `Patient`

Regras atuais:

- `createdAt > watermark`
- `email IS NOT NULL OR phone IS NOT NULL`

Acao:

- tenta boas-vindas por email
- tenta boas-vindas por WhatsApp
- consulta a auditoria para decidir se bloqueia o reenvio

### Profissionais

Tabela monitorada:

- `Professional`

Regras atuais:

- `createdAt > watermark`
- `email IS NOT NULL OR phone IS NOT NULL`

Acao:

- tenta boas-vindas por email
- tenta boas-vindas por WhatsApp
- consulta a auditoria para decidir se bloqueia o reenvio

### Tratamentos

Tabela monitorada:

- `Treatment`

Regras atuais:

- `createdAt > watermark`

Dependencias de dados:

- relacionamento com `Patient`
- relacionamento com `Professional`

Acao:

- tenta lembrete por email para o paciente
- tenta lembrete por WhatsApp para o paciente
- consulta a auditoria para decidir se bloqueia o reenvio

## Catalogo atual de notificacoes

### 1. Boas-vindas para paciente

Evento de negocio:

- novo paciente identificado no banco

Canais:

- Email
- WhatsApp

Dados usados:

- `firstName`
- `lastName`
- `email`
- `phone`
- `tempPassword`

Tipo de notificacao na auditoria:

- `welcome_patient`

### 2. Boas-vindas para profissional

Evento de negocio:

- novo profissional identificado no banco

Canais:

- Email
- WhatsApp

Dados usados:

- `fullName`
- `email`
- `phone`
- `tempPassword`

Tipo de notificacao na auditoria:

- `welcome_professional`

### 3. Lembrete de tratamento

Evento de negocio:

- novo tratamento identificado no banco

Canais:

- Email
- WhatsApp

Dados usados:

- `Treatment.name`
- `Patient.firstName`
- `Patient.email`
- `Patient.phone`
- `Professional.fullName`

Tipo de notificacao na auditoria:

- `treatment_reminder`

## Canais de envio

### Email

Biblioteca:

- `nodemailer`

Configuracao:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SEGURO`
- `SMTP_USUARIO`
- `SMTP_SENHA`
- `EMAIL_DE`

Comportamento importante:

- se SMTP nao estiver configurado, o servico registra `skipped` na auditoria
- em sucesso, guarda `providerMessageId` com o `messageId`
- em falha, guarda `errorMessage`

### WhatsApp

Biblioteca:

- `twilio`

Configuracao:

- `TWILIO_SID`
- `TWILIO_TOKEN`
- `TWILIO_WHATSAPP_ORIGEM`

Comportamento importante:

- se Twilio nao estiver configurado, o servico registra `skipped` na auditoria
- em sucesso, guarda `providerMessageId` com o `sid`
- em falha, guarda `errorMessage`

## Banco de dados

O servico pode usar:

- `DATABASE_URL`
- ou configuracao separada com `DB_HOST`, `DB_PORT`, `DB_USUARIO`, `DB_SENHA`, `DB_NOME`

Observacoes:

- `DATABASE_URL` tem prioridade no setup atual
- `DB_SYNC` controla `synchronize` do TypeORM
- em STG e producao, manter `DB_SYNC=false`
- a tabela `MessageDispatchAudit` deve ser criada por migration

## Migration da auditoria

Arquivo:

- `src/infra/migracoes/20260318212000-CriarMessageDispatchAudit.ts`

Comando sugerido para aplicar:

```bash
npm run typeorm migration:run -- -d src/config/data-source.ts
```

Se preferir gerar o SQL manualmente antes de rodar em STG, eu posso montar tambem.

## Variaveis de ambiente

### Aplicacao

- `PORTA`
- `NIVEL_LOG`

### Banco

- `DATABASE_URL`
- `DB_HOST`
- `DB_PORT`
- `DB_USUARIO`
- `DB_SENHA`
- `DB_NOME`
- `DB_SYNC`

### Worker

- `WORKER_ATIVO`
- `WORKER_INTERVALO_MS`

### SMTP

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SEGURO`
- `SMTP_USUARIO`
- `SMTP_SENHA`
- `EMAIL_DE`

### Twilio

- `TWILIO_SID`
- `TWILIO_TOKEN`
- `TWILIO_WHATSAPP_ORIGEM`

## Dry-run

Existe um endpoint para inspecionar o que seria enviado sem disparar notificacoes reais e sem gravar tentativa de envio.

Endpoint:

- `GET /mensageria/dry-run`

O retorno inclui:

- `watermarkISO` usado na consulta
- totais por tipo de notificacao
- lista dos itens pendentes
- canais que ainda seriam usados considerando o bloqueio por `success`
- destinos encontrados no banco

Uso recomendado:

1. subir a API com `WORKER_ATIVO=false`
2. chamar `GET /mensageria/dry-run`
3. validar se os registros encontrados batem com o esperado
4. so depois ativar o worker real

## Endpoint de auditoria

Endpoint:

- `GET /mensageria/auditoria`

Query params suportados hoje:

- `limit`
- `entityType`
- `entityId`
- `channel`
- `status`

Exemplos por parametro:

- `limit`

```bash
curl "http://localhost:3000/mensageria/auditoria?limit=10"
```

- `entityType`

```bash
curl "http://localhost:3000/mensageria/auditoria?entityType=patient"
```

- `entityId`

```bash
curl "http://localhost:3000/mensageria/auditoria?entityId=123"
```

- `channel`

```bash
curl "http://localhost:3000/mensageria/auditoria?channel=email"
```

- `status`

```bash
curl "http://localhost:3000/mensageria/auditoria?status=success"
```

Exemplo:

```bash
curl "http://localhost:3000/mensageria/auditoria"
```

```bash
curl "http://localhost:3000/mensageria/auditoria?limit=50&entityType=patient&entityId=123&channel=email&status=success"
```

```bash
curl "http://localhost:3000/mensageria/auditoria?entityType=treatment&status=failed&limit=20"
```

```bash
curl "http://localhost:3000/mensageria/auditoria?entityType=patient&entityId=123"
```

Retorno:

- lista das ultimas tentativas registradas
- status, canal, destino, motivo, providerMessageId e erro quando existir

## Como testar sem disparar mensagem real

### Modo seguro recomendado

Use:

- `WORKER_ATIVO=false`
- `DB_SYNC=false`
- SMTP vazio
- Twilio vazio

Isso permite:

- validar subida da API
- validar conexao com banco
- validar endpoint `/health`
- validar dry-run

### Para testar leitura do banco

1. Suba a aplicacao com `WORKER_ATIVO=false`.
2. Verifique se a API conecta ao banco sem erro.
3. Consulte `/health`.
4. Consulte `/mensageria/dry-run`.

### Para testar disparo controlado

1. Aplique a migration da `MessageDispatchAudit`.
2. Ative `WORKER_ATIVO=true`.
3. Configure apenas o canal que deseja testar.
4. Crie um registro controlado no banco.
5. Observe logs da aplicacao.
6. Consulte `/mensageria/auditoria`.

## Riscos e cuidados

### Uso com banco de STG

Ao conectar este servico ao banco de staging da aplicacao:

- ele pode encontrar dados reais de teste
- ele pode disparar notificacoes reais se SMTP ou Twilio estiverem configurados
- sem a migration da auditoria aplicada, o bloqueio de reenvio nao funciona

Recomendacao:

- aplicar a migration primeiro
- validar com `WORKER_ATIVO=false`
- so ativar o worker depois de confirmar conexao, dry-run e auditoria

### Polling com base em `createdAt`

O modelo atual usa consulta por janela temporal mais auditoria. Isso funciona para MVP, mas tem limitacoes:

- o evento depende da leitura periodica do banco
- nao ha fila nem retry estruturado por mensagem
- nao ha historico detalhado alem da auditoria de tentativas

## Melhorias recomendadas

### Curto prazo

- adicionar filtros no dry-run por email, tipo e janela de tempo
- adicionar filtros no endpoint de auditoria por entidade, canal e status
- registrar payload resumido do template utilizado

### Medio prazo

- criar tabela propria de auditoria de envios
- registrar tentativas, sucesso, falha, motivo e canal
- separar templates de mensagem do codigo
- criar retry controlado por politica de erro

### Longo prazo

- migrar de polling para eventos ou fila
- desacoplar a mensageria do banco transacional da aplicacao
- suportar retry, dead-letter e observabilidade por mensagem

## Resumo executivo

Hoje este servico faz tres tipos de notificacao:

- boas-vindas para paciente
- boas-vindas para profissional
- lembrete de tratamento

Os disparos acontecem a partir da leitura do banco da aplicacao principal.
A tabela `MessageDispatchAudit` e a fonte de verdade para tentativas e para bloqueio de reenvio por canal.
Os canais atuais sao email e WhatsApp.
