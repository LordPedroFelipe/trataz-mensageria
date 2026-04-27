# Deploy no Heroku

## Objetivo

Este guia documenta como subir este servico Node.js no Heroku, validar a operacao com seguranca e substituir o servico legado sem interromper a mensageria.

Ele cobre:

- criacao de app no Heroku
- deploy por Git
- configuracao de variaveis
- pipeline opcional de staging para producao
- validacao inicial
- ativacao do worker
- troca do servico antigo
- rollback

## Premissas

- Heroku CLI instalado
- acesso a conta Heroku correta
- acesso ao banco MySQL de producao
- acesso as credenciais SMTP e, se aplicavel, Twilio
- este repositorio ja preparado para Heroku com:
  - leitura de `PORT`
  - `Procfile`
  - `heroku-postbuild`

Arquivos relacionados:

- [`Procfile`](/c:/Users/pfsou/Projetos/mensageria-typeorm/mensageria-typeorm/Procfile)
- [`package.json`](/c:/Users/pfsou/Projetos/mensageria-typeorm/mensageria-typeorm/package.json)
- [`src/config/ambiente.ts`](/c:/Users/pfsou/Projetos/mensageria-typeorm/mensageria-typeorm/src/config/ambiente.ts)

## Comandos basicos do Heroku

Ver quais apps estao acessiveis na conta atual:

```bash
heroku apps
```

Ver se ja existe login ativo:

```bash
heroku auth:whoami
```

Fazer login:

```bash
heroku login
```

Ver logs em tempo real:

```bash
heroku logs --tail -a SEU-APP
```

Ver variaveis configuradas:

```bash
heroku config -a SEU-APP
```

## Apps visiveis nesta conta

Na conta atualmente autenticada, os apps visiveis eram:

- `rocky-earth-44311`
- `trataz-api`
- `trataz-api-staging`
- `trataz-mensageria`

Se o servico legado em .NET for `trataz-mensageria`, ele pode ser desligado somente depois da validacao do novo app.

## Estrategia recomendada de troca

Fluxo seguro:

1. criar um app novo no Heroku para o servico Node
2. subir o app novo com `WORKER_ATIVO=false`
3. validar `health`, conexao com banco, `dry-run` e auditoria
4. validar SMTP e Twilio se necessario
5. ativar o worker no app novo
6. monitorar logs
7. desligar o app legado

Isso reduz o risco de disparo duplicado e permite rollback mais simples.

## Criar um novo app

Exemplo com nome sugestivo:

```bash
heroku create trataz-mensageria-node
heroku git:remote -a trataz-mensageria-node
```

Se quiser manter o app antigo rodando enquanto valida o novo, nao reutilize o nome do servico legado.

## Deploy por Git

No primeiro deploy:

```bash
git add .
git commit -m "Prepare Heroku deploy"
git push heroku main
```

Se o branch principal local for `master`:

```bash
git push heroku master:main
```

Subir o dyno web:

```bash
heroku ps:scale web=1 -a trataz-mensageria-node
```

## Variaveis de ambiente

### Recomendacao de seguranca

Nao commitar credenciais reais em arquivos versionados de documentacao.

Para producao, prefira:

- manter segredos somente no Heroku Config Vars
- usar seu `.env` local apenas como referencia operacional
- revisar se o `.env` local nao sera commitado por engano

### Configurar manualmente

Base minima:

```bash
heroku config:set NIVEL_LOG=info -a trataz-mensageria-node
heroku config:set DATABASE_URL="mysql://usuario:senha@host:3306/banco" -a trataz-mensageria-node
heroku config:set DB_SYNC=false -a trataz-mensageria-node
heroku config:set WORKER_ATIVO=false -a trataz-mensageria-node
heroku config:set WORKER_INTERVALO_MS=60000 -a trataz-mensageria-node
```

SMTP:

```bash
heroku config:set SMTP_HOST="smtp.gmail.com" -a trataz-mensageria-node
heroku config:set SMTP_PORT=465 -a trataz-mensageria-node
heroku config:set SMTP_SEGURO=true -a trataz-mensageria-node
heroku config:set SMTP_USUARIO="seu-email@gmail.com" -a trataz-mensageria-node
heroku config:set SMTP_SENHA="sua-senha-de-app" -a trataz-mensageria-node
heroku config:set EMAIL_DE="seu-email@gmail.com" -a trataz-mensageria-node
```

Twilio:

```bash
heroku config:set TWILIO_SID="AC..." -a trataz-mensageria-node
heroku config:set TWILIO_TOKEN="..." -a trataz-mensageria-node
heroku config:set TWILIO_WHATSAPP_ORIGEM="whatsapp:+14155238886" -a trataz-mensageria-node


heroku config:set TWILIO_TEMPLATE_PASSWORD_SETUP_LINK="HX83c54f3b789f3b7fa11bc94940b72b77" -a trataz-mensageria-stg

```

### Carregar usando o `.env` atual

Se voce quer subir exatamente os valores do `.env` local atual sem copiar um a um, use PowerShell:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)=(.*)$') {
    heroku config:set "$($matches[1])=$($matches[2])" -a trataz-mensageria-node
  }
}
```

Observacoes:

- isso envia os valores atuais do seu `.env` local para o Heroku
- revise o arquivo antes de executar, porque ele pode conter segredos de producao
- o Heroku injeta `PORT` automaticamente, entao `PORTA` pode existir apenas como fallback local

### Configuracao sugerida para o primeiro deploy

No primeiro deploy em producao:

```bash
heroku config:set DB_SYNC=false -a trataz-mensageria-node
heroku config:set WORKER_ATIVO=false -a trataz-mensageria-node
```

Depois da validacao:

```bash
heroku config:set WORKER_ATIVO=true -a trataz-mensageria-node
heroku restart -a trataz-mensageria-node
```

## Validacao apos deploy

Ver o status do dyno:

```bash
heroku ps -a trataz-mensageria-node
```

Abrir o app:

```bash
heroku open -a trataz-mensageria-node
```

Validar saude:

```bash
curl "https://trataz-mensageria-node.herokuapp.com/health"
```

Validar dry-run:

```bash
curl "https://trataz-mensageria-node.herokuapp.com/mensageria/dry-run"
```

Validar auditoria:

```bash
curl "https://trataz-mensageria-node.herokuapp.com/mensageria/auditoria?limit=20"
```

Inspecionar logs:

```bash
heroku logs --tail -a trataz-mensageria-node
```

O que verificar:

- inicializacao sem erro de conexao com banco
- endpoint `/health` respondendo
- `dry-run` retornando itens coerentes
- ausencia de erro SMTP ou Twilio, se configurados
- auditoria acessivel

## Worker e operacao segura

Este servico executa polling do banco e pode disparar envios automaticamente.

Por isso:

- o deploy inicial deve subir com `WORKER_ATIVO=false`
- o worker so deve ser ativado depois da validacao
- durante a troca, o ideal e evitar dois workers ativos apontando para o mesmo banco

## Pipeline do Heroku

Pipeline e opcional, mas recomendado se houver staging e producao separados.

Criar um pipeline usando o app de staging como primeiro membro:

```bash
heroku pipelines:create trataz-mensageria -a trataz-api-staging -s staging
```

Adicionar o app de producao ao pipeline:

```bash
heroku pipelines:add trataz-mensageria -a trataz-mensageria-node -s production
```

Promover a ultima release de staging para producao:

```bash
heroku pipelines:promote -a trataz-api-staging -t trataz-mensageria-node
```

Observacao importante:

- se `trataz-api-staging` nao for a app correta para esta mensageria, crie uma staging propria para o servico antes de usar pipeline

## Troca do servico antigo

Quando o novo app estiver validado e com o worker ativo:

```bash
heroku ps:scale web=0 -a APP-ANTIGO
```

Se o legado em .NET for `trataz-mensageria`, o comando seria:

```bash
heroku ps:scale web=0 -a trataz-mensageria
```

Antes de desligar o app antigo, confirme:

- novo app com `web=1`
- `/health` ok
- logs sem erro
- worker habilitado somente no app novo

## Rollback

Se houver problema depois da virada:

1. desligue o worker do app novo
2. religue o app antigo
3. inspecione logs e corrija antes de tentar nova virada

Comandos uteis:

```bash
heroku config:set WORKER_ATIVO=false -a trataz-mensageria-node
heroku restart -a trataz-mensageria-node
heroku ps:scale web=1 -a trataz-mensageria
heroku logs --tail -a trataz-mensageria-node
```

## Checklist de virada

- `heroku auth:whoami` confirma a conta correta
- `heroku apps` confirma os apps esperados
- app novo criado
- config vars revisadas
- `DATABASE_URL` aponta para o banco correto
- `DB_SYNC=false`
- primeiro deploy com `WORKER_ATIVO=false`
- `/health` ok
- `/mensageria/dry-run` ok
- `/mensageria/auditoria` ok
- SMTP validado
- Twilio validado, se aplicavel
- worker ativado somente no app novo
- app antigo desligado

## Comandos de operacao rapida

Criar app:

```bash
heroku create trataz-mensageria-node
```

Associar remoto git:

```bash
heroku git:remote -a trataz-mensageria-node
```

Ver logs:

```bash
heroku logs --tail -a trataz-mensageria-node
```

Reiniciar:

```bash
heroku restart -a trataz-mensageria-node
```

Escalar web:

```bash
heroku ps:scale web=1 -a trataz-mensageria-node
```

Desligar app antigo:

```bash
heroku ps:scale web=0 -a trataz-mensageria
```

## Referencias

- Heroku Node.js deploy: https://devcenter.heroku.com/articles/deploying-nodejs
- Heroku Procfile: https://devcenter.heroku.com/articles/procfile
- Heroku Node behavior: https://devcenter.heroku.com/articles/nodejs-behavior-in-heroku
