# Operacao de Ambientes

## Objetivo

Este documento consolida a operacao de STG e producao da mensageria e do backend relacionado.

Ele cobre:

- deploy por branch
- apps Heroku por ambiente
- configuracao de variaveis
- URLs corretas dos servicos
- comandos de restart e logs
- validacao basica apos deploy
- checklist operacional

## Apps Heroku

### Mensageria

- STG: `trataz-mensageria-stg`
- Producao: `trataz-mensageria-node`

### Backend principal

- STG: `trataz-api-staging`
- Producao: `trataz-api`

## Branches e deploy

### Regra de branch

- STG publica a branch local `staging`
- Producao publica a branch local `main`

### Deploy STG da mensageria

No repositorio [`mensageria-typeorm`]

```bash
git checkout staging
git pull
git push heroku-stg staging:main
```

Se o remote ainda nao existir:

```bash
heroku git:remote -a trataz-mensageria-stg -r heroku-stg
```

### Deploy producao da mensageria

No repositorio [`mensageria-typeorm`]

```bash
git checkout main
git pull
git push heroku main
```

Se quiser usar um remote explicito para producao:

```bash
heroku git:remote -a trataz-mensageria-node -r heroku-prod
git push heroku-prod main:main
```

### Deploy STG do backend principal

No repositorio `trataz-backend`:

```bash
git checkout staging
git pull
git push heroku-stg-api staging:main
```

Se o remote ainda nao existir:

```bash
heroku git:remote -a trataz-api-staging -r heroku-stg-api
```

### Deploy producao do backend principal

No repositorio `trataz-backend`:

```bash
git checkout main
git pull
git push heroku-prod-api main:main
```

Se o remote ainda nao existir:

```bash
heroku git:remote -a trataz-api -r heroku-prod-api
```

## URLs dos servicos

### Mensageria STG

- base URL: `https://trataz-mensageria-stg-22f5b2a430ad.herokuapp.com`
- health: `https://trataz-mensageria-stg-22f5b2a430ad.herokuapp.com/health`
- dry-run: `https://trataz-mensageria-stg-22f5b2a430ad.herokuapp.com/mensageria/dry-run`
- auditoria: `https://trataz-mensageria-stg-22f5b2a430ad.herokuapp.com/mensageria/auditoria?limit=20`

### Mensageria producao

- base URL: `https://trataz-mensageria-node-209bcf13ab17.herokuapp.com`

## Variaveis importantes

### MENSAGERIA_SERVICE_URL no backend principal

STG:

```bash
heroku config:set MENSAGERIA_SERVICE_URL="https://trataz-mensageria-stg-22f5b2a430ad.herokuapp.com" -a trataz-api-staging
```

Producao:

```bash
heroku config:set MENSAGERIA_SERVICE_URL="https://trataz-mensageria-node-209bcf13ab17.herokuapp.com" -a trataz-api
```

### DATABASE_URL da mensageria

Nao gravar credenciais reais neste documento.

Use o formato:

```bash
heroku config:set DATABASE_URL="mysql://USUARIO:SENHA@HOST:3306/BANCO" -a NOME-DO-APP
```

Exemplos de apps:

- STG: `trataz-mensageria-stg`
- Producao: `trataz-mensageria-node`

### Outras variaveis operacionais da mensageria

```bash
heroku config:set PORTA=3000 -a NOME-DO-APP
heroku config:set NIVEL_LOG=info -a NOME-DO-APP
heroku config:set FRONTEND_URL="https://www.trataz.com.br" -a NOME-DO-APP
heroku config:set APP_TIMEZONE="America/Sao_Paulo" -a NOME-DO-APP
heroku config:set DB_SYNC=false -a NOME-DO-APP
heroku config:set WORKER_ATIVO=false -a NOME-DO-APP
heroku config:set WORKER_INTERVALO_MS=60000 -a NOME-DO-APP
heroku config:set SMTP_HOST="smtp.gmail.com" -a NOME-DO-APP
heroku config:set SMTP_PORT=465 -a NOME-DO-APP
heroku config:set SMTP_SEGURO=true -a NOME-DO-APP
heroku config:set SMTP_USUARIO="SEU_EMAIL" -a NOME-DO-APP
heroku config:set SMTP_SENHA="SUA_SENHA_DE_APP" -a NOME-DO-APP
heroku config:set EMAIL_DE="SEU_EMAIL" -a NOME-DO-APP
heroku config:set TWILIO_SID="" -a NOME-DO-APP
heroku config:set TWILIO_TOKEN="" -a NOME-DO-APP
heroku config:set TWILIO_WHATSAPP_ORIGEM="whatsapp:+14155238886" -a NOME-DO-APP
```

## Migracao da tabela MessageDispatchAudit

### STG

Em STG, a tabela `MessageDispatchAudit` ja existe.

### Producao

Em producao, se a tabela ainda nao existir:

1. configurar `DATABASE_URL` correta
2. manter `WORKER_ATIVO=false`
3. rodar migration
4. validar aplicacao
5. so depois ativar worker

Comando sugerido:

```bash
heroku run "node ./node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js" -a trataz-mensageria-node
```

## Comandos operacionais

### Mensageria producao

```bash
heroku restart -a trataz-mensageria-node
heroku logs --tail -a trataz-mensageria-node
```

### Backend STG

```bash
heroku restart -a trataz-api-staging
heroku logs --tail -a trataz-api-staging
```

### Mensageria STG

```bash
heroku restart -a trataz-mensageria-stg
heroku logs --tail -a trataz-mensageria-stg
```

## Validacao apos deploy

### Mensageria STG

```bash
curl https://trataz-mensageria-stg-22f5b2a430ad.herokuapp.com/health
curl https://trataz-mensageria-stg-22f5b2a430ad.herokuapp.com/mensageria/dry-run
curl "https://trataz-mensageria-stg-22f5b2a430ad.herokuapp.com/mensageria/auditoria?limit=20"
```

### O que deve aparecer nos logs

- `Conexao com banco estabelecida`
- `Worker de mensageria desativado por configuracao` ou inicializacao do worker
- `Servidor ouvindo em http://0.0.0.0:...`
- `State changed from starting to up`

## Worker

### Diferenca entre `WORKER_ATIVO=false` e `WORKER_ATIVO=true`

`WORKER_ATIVO=false`:

- sobe a API normalmente
- conecta no banco
- responde endpoints como `/health`, `/mensageria/dry-run` e `/mensageria/auditoria`
- nao executa o ciclo automatico de mensageria
- nao fica varrendo o banco para disparar emails e WhatsApp sozinho
- e o modo mais seguro para validar deploy, banco, configuracoes e endpoints

`WORKER_ATIVO=true`:

- sobe a API normalmente
- conecta no banco
- inicia o worker intervalado automaticamente
- passa a consultar o banco em ciclos
- tenta enviar mensagens reais conforme as regras implementadas
- grava auditoria de `success`, `failed` e `skipped`

Resumo pratico:

- use `WORKER_ATIVO=false` para validacao segura
- use `WORKER_ATIVO=true` quando o ambiente ja estiver pronto para processar envios reais

### Recomendacao

- STG: subir com `WORKER_ATIVO=false`
- Producao: subir com `WORKER_ATIVO=false` em deploy inicial ou mudancas sensiveis
- so ativar depois de validar `health`, `dry-run` e auditoria

### Ativar worker

```bash
heroku config:set WORKER_ATIVO=true -a NOME-DO-APP
heroku config:set WORKER_ATIVO=true -a trataz-mensageria-stg
heroku config:set WORKER_ATIVO=true -a trataz-mensageria-node
heroku restart -a NOME-DO-APP
heroku restart -a trataz-mensageria-stg
heroku restart -a trataz-mensageria-node
```

## Checklist operacional

- branch correta selecionada antes do push
- remote correto do Heroku
- `DATABASE_URL` correta no app certo
- `MENSAGERIA_SERVICE_URL` correta no backend correspondente
- `DB_SYNC=false`
- `WORKER_ATIVO=false` na validacao inicial
- migration aplicada quando necessario
- `/health` respondendo JSON
- `/mensageria/dry-run` respondendo
- `/mensageria/auditoria` respondendo
- logs sem erro de banco

## Checklist de regra de negocio

### Trial para Free

Validar manualmente o comportamento:

- se o usuario sair de `TRIAL` para `FREE`
- o sistema deve manter somente 5 pacientes ativos
- os demais pacientes ativos devem ser desativados

Observacao:

- esta regra pertence ao backend principal
- vale testar isso em STG depois de qualquer ajuste em assinatura, pacientes ou automacoes relacionadas

## Seguranca

Nao manter segredos reais em arquivos versionados.

Inclui:

- credenciais SMTP
- URLs de banco com usuario e senha
- tokens
- segredos temporarios

Use:

- Heroku Config Vars
- `.env` local fora de versionamento

## Catalogo de comandos Heroku

### Conta e apps

Listar apps visiveis na conta atual:

```bash
heroku apps
```

Ver usuario logado:

```bash
heroku auth:whoami
```

Fazer login:

```bash
heroku login
```

Ver informacoes de um app:

```bash
heroku info -a NOME-DO-APP
```

Ou:

```bash
heroku apps:info -a NOME-DO-APP
```

Abrir o app no navegador:

```bash
heroku open -a NOME-DO-APP
```

### Criacao de app

Criar app:

```bash
heroku create NOME-DO-APP
```

Criar app e associar remote padrao:

```bash
heroku git:remote -a NOME-DO-APP
```

Criar remote com nome customizado:

```bash
heroku git:remote -a NOME-DO-APP -r NOME-DO-REMOTE
```

### Git remotes

Ver remotes configurados:

```bash
git remote -v
```

Remover remote local:

```bash
git remote remove NOME-DO-REMOTE
```

### Deploy

Deploy branch `main` local para app Heroku:

```bash
git push heroku main
```

Deploy branch local `main` para `main` no Heroku com remote customizado:

```bash
git push heroku-prod main:main
```

Deploy branch local `staging` para `main` no Heroku:

```bash
git push heroku-stg staging:main
```

### Buildpacks

Limpar buildpacks:

```bash
heroku buildpacks:clear -a NOME-DO-APP
```

Definir buildpack Node.js:

```bash
heroku buildpacks:set heroku/nodejs -a NOME-DO-APP
```

### Dynos e processo

Ver status dos dynos:

```bash
heroku ps -a NOME-DO-APP
```

Escalar dyno web para 1:

```bash
heroku ps:scale web=1 -a NOME-DO-APP
```

Desligar dyno web:

```bash
heroku ps:scale web=0 -a NOME-DO-APP
```

Reiniciar app:

```bash
heroku restart -a NOME-DO-APP
```

### Logs

Ver logs em tempo real:

```bash
heroku logs --tail -a NOME-DO-APP
```

### Variaveis de ambiente

Listar config vars:

```bash
heroku config -a NOME-DO-APP
```

Ver variaveis de um servico especifico em formato de lista:

```bash
heroku config --app NOME-DO-APP
heroku config --app NOME-DO-APP
heroku config --app trataz-mensageria
heroku config --app trataz-mensageria-stg
heroku config --app trataz-mensageria-node
```

Ler uma config var especifica:

```bash
heroku config:get NOME_DA_VARIAVEL -a NOME-DO-APP
```

Criar ou atualizar uma config var:

```bash
heroku config:set NOME_DA_VARIAVEL="valor" -a NOME-DO-APP
```

Criar varias config vars:

```bash
heroku config:set VAR1="valor1" VAR2="valor2" -a NOME-DO-APP
```

### Migration

Executar migration no runtime Heroku:

```bash
heroku run "node ./node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js" -a NOME-DO-APP
```

Abrir shell remoto:

```bash
heroku run bash -a NOME-DO-APP
```

### Pipeline

Criar pipeline:

```bash
heroku pipelines:create NOME-DO-PIPELINE -a APP-INICIAL -s staging
```

Adicionar app ao pipeline:

```bash
heroku pipelines:add NOME-DO-PIPELINE -a NOME-DO-APP -s production
```

Promover release de um app para o downstream:

```bash
heroku pipelines:promote -a APP-DE-ORIGEM
```

Promover release para app especifico:

```bash
heroku pipelines:promote -a APP-DE-ORIGEM -t APP-DE-DESTINO
```

### Comandos usados neste projeto

Listar apps:

```bash
heroku apps
```

Ver login atual:

```bash
heroku auth:whoami
```

Deploy STG da mensageria:

```bash
git checkout staging
git pull
git push heroku-stg staging:main
```

Deploy producao da mensageria:

```bash
git checkout main
git pull
git push heroku main
```

Restart mensageria STG:

```bash
heroku restart -a trataz-mensageria-stg
```

Logs mensageria STG:

```bash
heroku logs --tail -a trataz-mensageria-stg
```

Restart mensageria producao:

```bash
heroku restart -a trataz-mensageria-node
```

Logs mensageria producao:

```bash
heroku logs --tail -a trataz-mensageria-node
heroku logs --tail -a trataz-api
```

Restart backend STG:

```bash
heroku restart -a trataz-api-staging
```

Logs backend STG:

```bash
heroku logs --tail -a trataz-api-staging
```
