# Trataz Mensageria

Servico de mensageria da plataforma Trataz, responsavel por detectar eventos de negocio no banco de dados e disparar notificacoes por email e WhatsApp com auditoria propria de tentativas, sucesso, falha e bloqueio de reenvio.

## Sumario

- [Visao Geral](#visao-geral)
- [Objetivos do Servico](#objetivos-do-servico)
- [Arquitetura](#arquitetura)
- [Fluxos de Negocio](#fluxos-de-negocio)
- [Catalogo de Notificacoes](#catalogo-de-notificacoes)
- [Auditoria de Envios](#auditoria-de-envios)
- [Endpoints](#endpoints)
- [Stack Tecnica](#stack-tecnica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Rodar](#como-rodar)
- [Configuracao de Ambiente](#configuracao-de-ambiente)
- [Migracoes](#migracoes)
- [Dry-Run e Operacao Segura](#dry-run-e-operacao-segura)
- [Fluxo de Envio](#fluxo-de-envio)
- [Logs e Observabilidade](#logs-e-observabilidade)
- [Exemplos de Uso](#exemplos-de-uso)
- [Decisoes de Arquitetura](#decisoes-de-arquitetura)
- [Riscos e Cuidados](#riscos-e-cuidados)
- [Roadmap Tecnico](#roadmap-tecnico)
- [Documentacao Complementar](#documentacao-complementar)

## Visao Geral

Este projeto foi construido para operar como um servico especializado de mensageria da Trataz.

Ele consulta o banco da aplicacao principal, identifica entidades elegiveis para notificacao e tenta disparar mensagens pelos canais configurados. Cada tentativa e registrada em uma tabela propria de auditoria chamada `MessageDispatchAudit`, que tambem funciona como fonte de verdade para evitar reenvios indevidos por canal.

Hoje o processamento e baseado em polling, com um worker intervalado que roda em background.

## Objetivos do Servico

- centralizar disparos de email e WhatsApp
- desacoplar notificacoes do sistema principal
- permitir auditoria completa das tentativas de envio
- evitar duplicidade com bloqueio por sucesso anterior
- oferecer operacao segura com dry-run e endpoints de consulta
- preparar a base para evolucao futura para filas, retries e observabilidade mais robusta

## Arquitetura

Arquitetura atual, em alto nivel:

1. a API sobe com Express
2. inicializa conexao com MySQL via TypeORM
3. inicia um worker intervalado, quando habilitado
4. o worker consulta tabelas do dominio da aplicacao
5. o servico decide quais canais ainda estao pendentes para cada entidade
6. antes de enviar, consulta a auditoria para verificar se ja existe `success`
7. tenta o envio via SMTP ou Twilio
8. grava uma linha na `MessageDispatchAudit` com `success`, `failed` ou `skipped`

Principais componentes:

- `src/server.ts`: bootstrap da aplicacao
- `src/app.ts`: configuracao do Express
- `src/processos/iniciarWorker.ts`: orquestracao do worker
- `src/servicos/MensageriaServico.ts`: coordenacao do fluxo principal
- `src/servicos/EmailServico.ts`: envio de email
- `src/servicos/WhatsappServico.ts`: envio de WhatsApp
- `src/infra/repositorios/*.ts`: acesso ao banco de dados
- `src/dominio/entidades/*.ts`: mapeamento de entidades TypeORM

## Fluxos de Negocio

O servico observa atualmente tres entidades do banco principal:

- `Patient`
- `Professional`
- `Treatment`

Fluxos implementados:

1. boas-vindas para paciente
2. boas-vindas para profissional
3. lembrete de tratamento

Regra geral do worker:

- buscar registros criados apos o `watermark` do ciclo
- identificar canais possiveis com base nos destinos disponiveis
- verificar na auditoria se aquele canal ja teve `success`
- enviar apenas o que ainda esta pendente
- registrar a tentativa na auditoria

## Catalogo de Notificacoes

### 1. Welcome Patient

- entidade: `Patient`
- tipo de notificacao: `welcome_patient`
- canais: `email`, `whatsapp`
- dados usados:
  - `firstName`
  - `lastName`
  - `email`
  - `phone`
  - `tempPassword`

### 2. Welcome Professional

- entidade: `Professional`
- tipo de notificacao: `welcome_professional`
- canais: `email`, `whatsapp`
- dados usados:
  - `fullName`
  - `email`
  - `phone`
  - `tempPassword`

### 3. Treatment Reminder

- entidade: `Treatment`
- tipo de notificacao: `treatment_reminder`
- canais: `email`, `whatsapp`
- dados usados:
  - `Treatment.name`
  - `Patient.firstName`
  - `Patient.email`
  - `Patient.phone`
  - `Professional.fullName`

## Auditoria de Envios

A tabela `MessageDispatchAudit` e uma das partes mais importantes do servico.

Ela existe para:

- registrar todas as tentativas de envio
- registrar erros e motivos de skip
- armazenar o identificador retornado pelo provedor
- evitar reenvio quando ja houve sucesso anterior

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

Semantica dos status:

- `success`: envio aceito pelo provedor
- `failed`: tentativa realizada com erro
- `skipped`: envio deliberadamente ignorado, por exemplo por ausencia de configuracao ou por sucesso anterior

Chave logica usada para bloqueio de reenvio:

- `entityType + entityId + notificationType + channel`

Se ja existe um `success` para essa combinacao, o envio e bloqueado e uma nova linha `skipped` e registrada.

## Endpoints

### Health Check

`GET /health`

Retorna o estado basico do servico.

Exemplo:

```bash
curl "http://localhost:3000/health"
```

### Dry-Run

`GET /mensageria/dry-run`

Mostra o que seria enviado sem disparar mensagens reais e sem gravar tentativa de envio.

Exemplo:

```bash
curl "http://localhost:3000/mensageria/dry-run"
```

### Auditoria

`GET /mensageria/auditoria`

Consulta o historico de tentativas registradas na `MessageDispatchAudit`.

Query params suportados:

- `limit`
- `entityType`
- `entityId`
- `channel`
- `status`

Exemplos:

```bash
curl "http://localhost:3000/mensageria/auditoria"
```

```bash
curl "http://localhost:3000/mensageria/auditoria?limit=20"
```

```bash
curl "http://localhost:3000/mensageria/auditoria?entityType=patient&entityId=123"
```

```bash
curl "http://localhost:3000/mensageria/auditoria?channel=email&status=success"
```

```bash
curl "http://localhost:3000/mensageria/auditoria?entityType=treatment&status=failed&limit=50"
```

Valores aceitos:

- `entityType`: `patient`, `professional`, `treatment`
- `channel`: `email`, `whatsapp`
- `status`: `success`, `failed`, `skipped`

## Stack Tecnica

- Node.js
- TypeScript
- Express
- TypeORM
- MySQL
- Nodemailer
- Twilio
- Pino
- ESLint

## Estrutura do Projeto

```text
src/
  apresentacao/
    controladores/
  compartilhado/
    middlewares/
    tipos/
  config/
  dominio/
    entidades/
  infra/
    migracoes/
    repositorios/
  processos/
  rotas/
  servicos/
docs/
  NOTIFICACOES.md
```

## Como Rodar

### Requisitos

- Node.js 20+
- npm
- acesso ao banco MySQL alvo
- credenciais SMTP e, se necessario, Twilio

### Instalar dependencias

```bash
npm install
```

### Rodar em desenvolvimento

```bash
npm run dev
```

### Gerar build

```bash
npm run build
```

### Rodar build compilado

```bash
npm start
```

### Validar qualidade basica

```bash
npm run lint
```

## Configuracao de Ambiente

Exemplo resumido:

```env
PORT=3000
PORTA=3000
NIVEL_LOG=info
DATABASE_URL=mysql://usuario:senha@host:3306/banco
DB_SYNC=false
WORKER_ATIVO=true
WORKER_INTERVALO_MS=60000
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_SEGURO=true
SMTP_USUARIO=contato@trataz.com
SMTP_SENHA=senha
EMAIL_DE=contato@trataz.com
TWILIO_SID=
TWILIO_TOKEN=
TWILIO_WHATSAPP_ORIGEM=whatsapp:+14155238886
```

### Variaveis principais

#### Aplicacao

- `PORT`: porta HTTP injetada pela plataforma, como Heroku
- `PORTA`: fallback para execucao local
- `NIVEL_LOG`: nivel do logger Pino

#### Banco

- `DATABASE_URL`: string completa de conexao, prioritaria sobre configuracoes separadas
- `DB_HOST`
- `DB_PORT`
- `DB_USUARIO`
- `DB_SENHA`
- `DB_NOME`
- `DB_SYNC`: manter `false` em STG e producao

#### Worker

- `WORKER_ATIVO`: habilita o processamento automatico
- `WORKER_INTERVALO_MS`: intervalo do polling em milissegundos

#### SMTP

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SEGURO`
- `SMTP_USUARIO`
- `SMTP_SENHA`
- `EMAIL_DE`

#### Twilio

- `TWILIO_SID`
- `TWILIO_TOKEN`
- `TWILIO_WHATSAPP_ORIGEM`

## Migracoes

```bash
npm run typeorm -- migration:show
```

```bash
npm run typeorm -- migration:run
```

## Dry-Run e Operacao Segura

Modo seguro recomendado para validacao inicial:

- `WORKER_ATIVO=false`
- `DB_SYNC=false`
- SMTP vazio ou desabilitado, se nao quiser envio real
- Twilio vazio ou desabilitado, se nao quiser envio real

Roteiro seguro:

1. configurar banco
2. aplicar migration da auditoria
3. subir a API com `WORKER_ATIVO=false`
4. validar `/health`
5. validar `/mensageria/dry-run`
6. validar `/mensageria/auditoria`
7. so depois ligar o worker automatico


## Logs e Observabilidade

O servico usa `pino` como logger.

Atualmente ele registra:

- inicializacao da aplicacao
- estado do worker
- inicio e fim dos ciclos
- quantidade de registros encontrados por tipo
- tentativas por canal
- bloqueios por sucesso anterior
- sucesso, falha e skip por canal
- erros nao tratados

## Exemplos de Uso

### Subir localmente

```bash
npm install
npm run dev
```

### Verificar saude

```bash
curl "http://localhost:3000/health"
```

### Ver o que seria enviado

```bash
curl "http://localhost:3000/mensageria/dry-run"
```

### Consultar historico de auditoria

```bash
curl "http://localhost:3000/mensageria/auditoria?limit=50"
```

### Consultar apenas sucessos de email para um paciente

```bash
curl "http://localhost:3000/mensageria/auditoria?entityType=patient&entityId=123&channel=email&status=success"
```

## Documentacao Complementar

A documentacao funcional detalhada de notificacoes esta em:

- [docs/NOTIFICACOES.md](/c:/Users/pfsou/Projetos/mensageria-typeorm/mensageria-typeorm/docs/NOTIFICACOES.md:1)
- [docs/DEPLOY_HEROKU.md](/c:/Users/pfsou/Projetos/mensageria-typeorm/mensageria-typeorm/docs/DEPLOY_HEROKU.md:1)

## Status Atual

O projeto ja possui:

- API Express funcional
- worker intervalado
- integracao com MySQL via TypeORM
- envio de email via SMTP
- envio de WhatsApp via Twilio
- dry-run operacional
- auditoria propria de tentativas
- bloqueio de reenvio por sucesso anterior
- endpoint de historico de auditoria
