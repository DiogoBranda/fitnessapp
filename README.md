# Forma — Treinar melhor, juntos

Aplicação de acompanhamento de treino em português de Portugal. React, TypeScript e Vite, preparada para Vercel, com Supabase Auth e PostgreSQL para contas e dados reais.

## Funcionalidades

- Perfis de aluno, personal trainer e administrador.
- Associação de alunos através de um código de partilha de utilização única.
- Planos por aluno, com vários treinos e exercícios, séries, intervalo de repetições e descanso.
- Início, pausa e retoma de uma sessão, registo de carga e repetições por série e conclusão do treino.
- Comentários privados ligados a plano + treino + exercício; chat geral entre treinador e aluno.
- Arquivo de planos preservando histórico e conversas.
- Painel por aluno com volume, sessões, séries e duração; relatório CSV compatível com Excel.
- Ginásios adicionados pela comunidade, inventário de equipamentos, pesquisa e filtros.
- Validação de cadeias de ginásios pelo administrador.
- Interface adaptável a telemóvel, navegação por teclado, diálogos com controlo de foco.

## Desenvolvimento

Requer Node.js 22.12+ e npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Sem variáveis de ambiente, a aplicação abre uma demonstração explícita. Os dados de exemplo ficam apenas no `localStorage` deste navegador (`forma-demo-v1`); não são enviados para uma base de dados. O seletor de perfis só existe neste modo. As contas reais obtêm sempre o perfil através da sessão autenticada e do PostgreSQL.

## Supabase

1. Criar um projeto Supabase e executar `supabase/migrations/001_initial.sql` uma única vez na base de dados nova.
2. Configurar em `.env.local` e na Vercel:

```dotenv
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Usar apenas a chave pública de cliente. Nunca colocar uma chave `service_role` em variáveis `VITE_*`.

3. Configurar o Site URL e os Redirect URLs de autenticação para os domínios efetivamente usados. Manter confirmação de email ativa e configurar SMTP para envio de emails em produção.
4. Criar uma conta de treinador e uma de aluno na aplicação. O aluno partilha o código apresentado no painel. O treinador associa-o na página **Alunos**. Um aluno tem um treinador ativo nesta versão.
5. Atribuir o papel de administrador exclusivamente através da administração da base de dados, depois de verificar a identidade da conta:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID_DA_CONTA_VERIFICADA';
```

O registo público nunca permite criar administradores. As regras RLS isolam os dados dos alunos. Administradores validam cadeias e veem perfis, mas não recebem acesso global a sessões, planos ou mensagens privadas. Não existe eliminação de histórico pela API de cliente.

O conteúdo de treinos com sessões ou comentários fica protegido contra alterações estruturais para conservar o contexto histórico. O nome, a descrição e o estado de arquivo do plano podem mudar; criar um novo plano para uma nova prescrição.

## Publicação na Vercel

Importar `DiogoBranda/fitnessapp`, selecionar o preset **Vite**, manter a raiz do repositório, adicionar as duas variáveis acima e publicar. `vercel.json` define a compilação, `dist`, a rota de entrada e os cabeçalhos básicos. As variáveis `VITE_*` são incorporadas durante a compilação: publicar novamente depois de as alterar.

Sem Supabase configurado, a publicação disponibiliza apenas a demonstração. A existência de `vercel.json` não significa que um projeto remoto já tenha sido criado.

## Validação

```sh
npm test
npm run build
```

- Testes de domínio: prescrição, conclusão, volume e exportação CSV com proteção contra fórmulas.
- Testes de interface em DOM: criação/arquivo de planos, registo/retoma/conclusão, comentários contextualizados, contribuição de ginásios e validação de cadeias.
- Testes PostgreSQL com PGlite: a migração real é executada com papéis `anon`/`authenticated` e um simulador mínimo de `auth.uid()`, verificando RLS, privilégios, integridade de sessões e isolamento entre utilizadores.
- O workflow GitHub Actions repete testes e compilação em cada push e pull request.

Os testes de DOM não substituem uma revisão visual num navegador. A autenticação por email e a comunicação entre dispositivos requerem validação no projeto Supabase configurado. O chat atualiza mensagens a cada 15 segundos; não usa WebSockets. O relatório é CSV, não PDF. A validação da cadeia não certifica os equipamentos adicionados pela comunidade.

## Organização

- `src/App.tsx`: percursos, componentes e formulários.
- `src/styles.css`: sistema visual e adaptação a ecrãs pequenos.
- `src/domain.ts`: tipos, validações, sessões e relatório.
- `src/data.ts`: autenticação e persistência remota.
- `src/seed.ts`: dados fictícios exclusivamente para demonstração.
- `supabase/migrations/001_initial.sql`: esquema, funções, privilégios e RLS.
- `tests/`: testes de interface e base de dados.

Referências de configuração: [Vite na Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) e [gestão de utilizadores](https://supabase.com/docs/guides/auth/managing-user-data).
