# SCCP Hax — versão para Render

Site com servidor Node.js, cadastro/login com usuário e senha, galeria compartilhada, notícias/anúncios, perfis e Chat Timão. Mantém a identidade visual alvinegra do projeto anterior.

## Administrador

O usuário administrador é **KahLebz**. A senha escolhida foi configurada apenas na cópia local como hash scrypt, no arquivo `.env`, que é ignorado pelo Git e não acompanha o ZIP público. A senha em texto puro não fica no código.

Depois de entrar em `/conta`, acesse `/noticias` e clique em **Publicar anúncio**. É possível escrever título, resumo e texto, publicar para todos e remover anúncios. O administrador também pode moderar mensagens do Chat Timão. Contas comuns não podem publicar anúncios, mesmo alterando a posição do perfil para Comissão.

Para configurar ou trocar a senha local:

```powershell
npm run configurar-admin
```

O programa oculta a digitação e grava somente o hash. Para alterar a senha da publicação, atualize `ADMIN_PASSWORD_HASH` no Render e reinicie a publicação. O administrador é reservado no servidor e não pode ser criado pelo cadastro público.

## Testar no computador

Requer Node.js 24.17 ou superior:

```powershell
npm ci
npm run build
npm start
```

Abra http://localhost:3000. Sem `DATABASE_URL`, a prévia usa SQLite em `data/site.sqlite`. Em produção, `DATABASE_URL` é obrigatório: o servidor se recusa a usar um banco temporário, para evitar perda silenciosa de dados.

## Publicar no Render

1. Coloque o código em um repositório GitHub, GitLab ou Bitbucket. Inclua `render.yaml`, `package-lock.json`, `client`, `server`, `public` e `scripts`. Não envie `.env`, `data` ou `node_modules`.
2. Crie um Blueprint no Render com esse repositório. O arquivo define um Web Service Node e um PostgreSQL, ambos no plano gratuito.
3. Quando solicitado, defina `ADMIN_PASSWORD_HASH` com o valor protegido do `.env` local. Não use a senha em texto puro nesse campo. `ADMIN_USERNAME` já está definido como `KahLebz`.
4. O Render liga `DATABASE_URL` automaticamente ao PostgreSQL do Blueprint. O servidor cria as tabelas ao iniciar.
5. Depois da publicação, confira `/healthz`, entre em `/conta` e publique seu primeiro anúncio em `/noticias`.

O PostgreSQL gratuito do Render expira **30 dias após a criação**. Esta foi a opção escolhida para a primeira publicação. Antes do vencimento, faça backup e migre ou altere o plano. O serviço web gratuito também pode suspender por inatividade e demorar para voltar. Referência: https://render.com/docs/free.

As fotos ficam no PostgreSQL para sobreviver às novas publicações, sem depender do disco temporário do serviço. O mural tem limite de 100 fotos, cada uma com até 6 MB. Os dados da hospedagem anterior não são transferidos automaticamente: esta versão possui banco e contas próprios.

## Verificação

```powershell
npm test
npx tsc --noEmit
npm run build
```

Os testes verificam hash de senha, login, reserva do administrador, bloqueio de anúncio por conta comum, proteção de origem, sessão, chat, intervalo entre envios e upload/leitura/exclusão de fotos. Os testes usam SQLite local; o teste de integração com PostgreSQL depende da conexão com o banco no Render.

## Créditos

Foto da torcida: Anderson Bueno Pereira / Wikimedia Commons, CC BY-SA 4.0, com recorte e filtros de exibição. Fonte e licença: https://commons.wikimedia.org/wiki/File:Setor_Norte_%C3%81rea_das_Organizadas.jpg e https://creativecommons.org/licenses/by-sa/4.0/.

Gameplay: HaxBall / Basro, via Kurt Waldowski: https://kurtwaldowski.wordpress.com/2010/12/15/wip-of-the-week-haxball-basro/. Escudo fornecido pelo usuário. Projeto independente de fãs, sem vínculo oficial com o clube ou Haxball.
