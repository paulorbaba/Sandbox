# HANDOFF — Sadia ON · Lek Trek LIVE (protótipo)

Documento de transferência para a equipe que vai reconstruir o projeto em infraestrutura própria.
Produção atual: https://lek-trek-live-production.up.railway.app/

**Convenções deste documento**
- Valores, nomes e textos foram copiados do código no commit `4a22ad4` (branch `main`).
- Quando algo não pôde ser confirmado, está escrito **NÃO SEI**.
- Nenhum segredo, token ou senha aparece aqui. O projeto não usa segredos.
- Caminhos de arquivo são relativos à raiz do repositório.

**Quem fez:** o código foi escrito pelo Claude (assistente de IA, via Claude Code) a partir de pedidos do responsável pelo projeto na agência, em 10/11/2026. Os materiais de referência (pranchas, renders, roteiro, guia) foram fornecidos pela agência.

---

## Sumário

1. Visão e objetivo
2. Arquitetura
3. Servidor, em detalhe
4. Celular
5. Palco
6. Áudio
7. Identidade visual e assets
8. Decisões tomadas e por quê
9. O que é encenação
10. Pendências e riscos
11. Prompts e histórico
12. O que este handoff NÃO cobre

---

## 1. Visão e objetivo

**O que é.** Uma experiência musical coletiva no espaço da Sadia no Lollapalooza Brasil 2027. O personagem Lek Trek "discoteca" num LED oval. O público escolhe o ritmo, reage pelo próprio celular e a energia coletiva leva o set até o drop ("MODO ON ATIVADO"). No fim, cada pessoa recebe um clipe e um card.

- Frase-conceito (do roteiro): **"O Lek Trek comanda o som. A galera mantém o set ON."**
- Assinatura de campanha (do roteiro): "Ative seu modo ON."

**Para quem.** Público do festival, em sessões curtas. O roteiro trabalha com a hipótese de até 30 pessoas por sessão e ciclo de 10 minutos, ambos marcados lá como "a validar".

**Objetivo do protótipo.** Demonstrar ao cliente a mecânica central funcionando de verdade: a pessoa reage no celular, a reação aparece no LED do Lek Trek e a energia coletiva evolui no palco. O resto da jornada é navegável, com simulações identificadas.

**Briefing original da Sadia.** **NÃO SEI** — não foi passado na conversa nem está no repositório. O documento mais próximo é `roteiro da ativação.md` (versão 3, 10/11/2026), que diz textualmente: "referências ao briefing e ao deck foram herdadas do roteiro anterior, sem nova conferência desses materiais".

**Materiais de referência no repositório** (preservados, não alterados):

| Arquivo | Conteúdo |
|---|---|
| `roteiro da ativação.md` | Ideia, roteiro completo, regras propostas de energia, especificação do protótipo, riscos |
| `guia do protótipo.md` | Mapa de navegação C01–C18, regras do protótipo, números do dashboard |
| `pranchas/01…08_*.png` | Pranchas visuais "finais" das telas, palco e dashboard (1536–1774 px de largura) |
| `renders/Sadia_Lolla_2027_*.png` | 6 renders 1920×1080 do espaço (fachada 9A/9B/9C, térreo 2/3/4) |

---

## 2. Arquitetura

### 2.1 Stack (versões instaladas no lockfile)

| Camada | Tecnologia |
|---|---|
| Front-end | React 19.3.1, TypeScript 7.0.2, Vite 8.3.7, React Router 7, `qrcode` (QR gerado no cliente) |
| Servidor | Node.js 22.23.4 (`.nvmrc`; `engines` exige ≥20), Express 5.3.0 |
| Tempo real | Socket.IO 4.8.4, no mesmo domínio e porta do HTTP |
| Build | Vite (cliente) + esbuild (servidor TS empacotado em `dist/server.js`) |
| Testes | Vitest (20 testes da lógica de sessão em `tests/session.test.ts`) |
| Fontes | `@fontsource/poppins` e `@fontsource/barlow-condensed` (servidas localmente) |

Não há banco de dados, autenticação de usuários, filas nem serviços pagos.

### 2.2 Estrutura de pastas

```
server/
  index.ts       Express: /health, REST, arquivos estáticos, fallback do SPA, Vite em modo dev
  realtime.ts    Eventos Socket.IO, laço de 100 ms, transmissão de estado e reações
  session.ts     Classe Session (lógica pura, recebe `now`) e SessionStore (memória)
shared/
  config.ts      Reações, ritmos, perfis, regra de energia, tempos, público simulado, fases
  types.ts       SessionState, ControlCommand, Ack, ReactionBatchItem
src/
  main.tsx       Rotas (lazy) e fontes
  lib/           realtime.ts (hooks Socket.IO), util.ts, camera.ts, clip.ts, audio.ts
  components/    Brand.tsx (logo e caminhos das imagens), QrCode, PhoneFrame, stage/ (palco)
  participant/   ParticipantApp (máquina de telas), onboarding, live, Recorder, delivery, ui, CSS
  pages/         Home, ParticipantPage, StagePage, ControlPage, DemoPage, AdminPage, NotFound
  admin/data.ts  Gerador determinístico dos dados simulados do dashboard
  styles/global.css  Tokens de cor e tipografia, botões, logo
tests/           session.test.ts
public/img/      Imagens de execução (WebP) e favicon
index.html, vite.config.ts, tsconfig.json, package.json, package-lock.json, .env.example, .nvmrc
```

### 2.3 Como front e servidor conversam

- Um único processo Node serve a interface, a API REST e o Socket.IO na mesma porta.
- O cliente chama `io()` sem URL, ou seja, conecta no mesmo domínio da página. Não há URL de servidor fixa no código.
- Os links (participação, palco, controle) são montados com `window.location.origin`.
- Em desenvolvimento (`npm run dev`), o Express sobe o Vite em modo middleware na mesma porta (flag `--dev`).
- Em produção, o Express serve `dist/client`, com cache imutável de 30 dias em `/assets` e de 1 h no resto. Qualquer GET/HEAD sem extensão de arquivo e fora de `/socket.io` devolve o `index.html` (acesso direto às rotas sem 404).

### 2.4 Scripts (`package.json`)

| Script | Comando |
|---|---|
| `dev` | `tsx watch --clear-screen=false server/index.ts --dev` |
| `build` | `vite build && esbuild server/index.ts --bundle --platform=node --format=esm --packages=external --target=node20 --outfile=dist/server.js` |
| `start` | `node dist/server.js` |
| `test` | `vitest run` |
| `typecheck` | `tsc --noEmit -p tsconfig.json` |

**Atenção:** `esbuild` roda com `--packages=external`. Isso significa que `express` e `socket.io` precisam estar instalados em produção (estão em `dependencies`). O resto está em `devDependencies` porque só é usado no build.

### 2.5 Deploy no Railway (como está hoje)

| Item | Valor |
|---|---|
| Projeto / serviço / ambiente | `sadia-lek-trek-live` / `lek-trek-live` / `production` |
| Fonte | GitHub `paulorbaba/Sandbox`, branch `main`, deploy automático a cada push |
| Builder | Railpack v0.43.0 (detectou Node; instalou node 22.23.4 via `.nvmrc`) |
| Build | `npm run build` |
| Start | `npm start` |
| Porta | `PORT` injetada pelo Railway; o processo registrou `0.0.0.0:8080` |
| Health check | `/health`, timeout 120 s |
| Reinício | política de reinício em falha, até 5 tentativas (configurada como `ON_FAILURE`) |
| Réplicas / região | 1 réplica em `sfo` |
| Domínio | `lek-trek-live-production.up.railway.app` (domínio Railway, sem domínio próprio) |
| Variáveis configuradas | nenhuma além das injetadas pelo Railway |
| Plano Railway | **NÃO SEI** |

**Variáveis de ambiente lidas pelo código** (todas opcionais; nomes apenas):
- `PORT` — padrão 3000
- `SESSION_NUMBER_START` — padrão 1
- `MAX_SESSIONS` — padrão 200

**Ocorrência no primeiro deploy.** O primeiro build publicou a branch padrão do GitHub (`claude/upbeat-franklin-frell2`, com a página antiga). Corrigi apontando a fonte do serviço para `main`. A branch padrão do repositório no GitHub continua sendo a outra.

**Restrição importante.** O estado vive na memória do processo. Por isso é obrigatório rodar com **uma instância**. Qualquer deploy ou reinício apaga todas as sessões abertas.

---

## 3. Servidor, em detalhe

Arquivos: `server/session.ts`, `server/realtime.ts`, `server/index.ts`, `shared/config.ts`, `shared/types.ts`.

### 3.1 Fases

```
PHASES = ['lobby', 'reveal', 'set', 'mission', 'buildup', 'drop', 'ended']
```

| Fase | Rótulo (`PHASE_LABEL`) |
|---|---|
| `lobby` | Recepção |
| `reveal` | Revelação do ritmo |
| `set` | Pista ON |
| `mission` | Missão do drop |
| `buildup` | Build-up |
| `drop` | Drop · Modo ON |
| `ended` | Encerramento |

`LIVE_PHASES = ['set', 'mission', 'buildup', 'drop']`. São as fases em que reações e palmas são aceitas.

### 3.2 Objeto `state` (`SessionState`), campo a campo

É o mesmo objeto para palco, controle e celulares. Não contém dados pessoais.

| Campo | Tipo | Significado |
|---|---|---|
| `id` | string | ID da sessão (6 caracteres, maiúsculas) |
| `number` | number | Número sequencial exibido ("Sessão N") |
| `phase` | Phase | Fase atual |
| `phaseStartedAt` | number (ms epoch, servidor) | Quando a fase atual começou |
| `serverNow` | number | Relógio do servidor no envio; o cliente usa para calcular contagens regressivas |
| `votingOpen` | boolean | `true` só na recepção; fecha ao entrar em qualquer outra fase |
| `votes` | Record<RhythmId, number> | Contagem de votos (de todos os participantes conhecidos com voto) |
| `winner` | RhythmId \| null | `setlist[0]` após fechar a votação |
| `setlist` | RhythmId[] | Até 3 ritmos, na ordem do set |
| `block` | number | Índice do ritmo atual dentro de `setlist` |
| `counts.connected` | number | Participantes com pelo menos 1 socket conectado |
| `counts.ready` | number | Conectados com `status === 'ready'` |
| `counts.known` | number | Participantes já registrados na sessão (conectados ou não) |
| `counts.stages` | number | Sockets de palco abertos (o controle não conta) |
| `energy` | number | Energia da pista, arredondada a 1 casa decimal |
| `dropCharge` | number | Carga da missão do drop (0–100), 1 casa decimal |
| `dropReady` | boolean | Carga atingiu 100 |
| `assisted` | boolean | A assistência do Lek Trek foi ativada nesta missão |
| `missionEndsAt` | number \| null | Fim da janela da missão |
| `buildupEndsAt` | number \| null | Fim da contagem do build-up |
| `totalReactions` | number | Reações contabilizadas na rodada (reais + simuladas) |
| `qrVisible` | boolean | QR aparece no palco |
| `view` | `'main'` \| `'fachada'` | Visão do palco |
| `autoDrop` | boolean | Modo automático do drop |
| `autoAssist` | boolean | Assistência automática |
| `crowd` | `'off'` \| `'low'` \| `'high'` | Público simulado |
| `scenario.uploadFailure` | boolean | Cenário demonstrativo de falha de envio |
| `lastClapAt` | number \| null | Último "Palmas da sala" (o palco pulsa) |
| `runId` | number | Incrementa a cada volta à recepção; os celulares limpam o registro da rodada anterior |

**Valores iniciais de uma sessão nova:**
- fase `lobby`, `votingOpen: true`, `energy: 35`, `dropCharge: 0`
- `qrVisible: true`, `view: 'main'`, `autoDrop: false`, `autoAssist: true`
- `crowd: 'off'`, `uploadFailure: false`, `runId: 1`

**Participante, no servidor** (não vai para o `state`): `pid`, `sockets: Set<socketId>`, `status: 'onboarding' | 'ready'`, `vote: RhythmId | null`, `lastReactionAt`, `joinedAt`.

### 3.3 Identificadores e autorização

- **`sessionId`:** 6 caracteres do alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. Cada caractere sai de `randomBytes(6)` como `byte % 31`, então há um leve viés de módulo. A busca não diferencia maiúsculas: `get()` aplica `toUpperCase()`. IDs duplicados são regerados.
- **`controlKey`:** `randomBytes(18).toString('base64url')`, 24 caracteres, criada com a sessão.
  - A verificação compara o tamanho e depois usa `timingSafeEqual`.
  - O socket só vira controle após `control:auth` com chave correta; daí em diante `control:cmd` só vale para aquela sessão (`socket.data.controlFor`).
- **`pid` do participante:** gerado no celular (`crypto.randomUUID()` sem hífens) e guardado em localStorage por sessão. O servidor só aceita `/^[A-Za-z0-9_-]{8,64}$/`. Reentrar com o mesmo `pid` não cria participante novo.
- **Limite:** `MAX_PARTICIPANTS = 500` por sessão (erro `session_full`).
- **Número da sessão:** contador em memória que começa em `SESSION_NUMBER_START` e volta ao início quando o servidor reinicia.

### 3.4 Eventos Socket.IO

**Configuração do servidor:** `serveClient: false`, `pingInterval: 10000`, `pingTimeout: 8000`, `maxHttpBufferSize: 16000`.

**Configuração do cliente:** `autoConnect: false`, `reconnectionDelay: 600`, `reconnectionDelayMax: 3000`. Os acks têm timeout de 5000 ms no cliente; estourou, vira `{ ok: false, error: 'timeout' }`.

**Formato de resposta (ack):** `{ ok: true, data? }` ou `{ ok: false, error: string }`.

**Salas:** `s:<id>` (todos), `w:<id>` (palco + controle), `p:<id>` (participantes).

#### Cliente → servidor

| Evento | Payload | Ack de sucesso | Erros | Efeito |
|---|---|---|---|---|
| `stage:join` | `{ sessionId }` | `{ ok: true, data: SessionState }` | `not_found` | Entra em `s:` e `w:`; soma em `counts.stages` |
| `control:auth` | `{ sessionId, key }` | `{ ok: true, data: SessionState }` | `not_found`, `unauthorized` | Entra em `s:` e `w:`; habilita `control:cmd` |
| `control:cmd` | `ControlCommand` (3.5) | `{ ok: true }` | `unauthorized` (sem auth), `invalid` (sem `type` string), ou a mensagem do comando | Executa o comando; transmite o estado na hora (`force`) |
| `participant:join` | `{ sessionId, pid }` | `{ ok: true, data: { state, participant: { status, vote, isNew } } }` | `not_found`, `invalid_pid`, `session_full` | Registra ou reconecta; entra em `s:` e `p:`. Se o socket já representava outro participante, desvincula o anterior |
| `participant:ready` | `{}` | `{ ok: true }` | `not_joined` | `status = 'ready'` (idempotente) |
| `participant:vote` | `{ rhythm }` | `{ ok: true }` | `not_joined`, `voting_closed` (votação fechada **ou** ritmo inválido) | Grava/troca o voto |
| `participant:react` | `{ r }` | sem ack | — | Ver 3.6. Tipos: `heart`, `fire`, `clap`, `bolt` |
| `disconnect` | — | — | — | Desvincula o socket; o participante continua em `known` |

**Limite por conexão:** 25 eventos/s, aplicado só em `participant:react`; o excesso é descartado.

#### Servidor → cliente

| Evento | Sala | Payload | Quando |
|---|---|---|---|
| `state` | `s:<id>` | `SessionState` | Quando a sessão muda, no máximo a cada 150 ms (verificado a cada 100 ms); na hora após `control:cmd` e `participant:join` |
| `reactions` | `w:<id>` | `[{ r, n, sim? }]` | A cada 100 ms, se houver reações. `sim: true` marca reações simuladas. **Celulares não recebem** |
| `force-reconnect` | `p:<id>` | `{ ms: 2500 }` | Comando `forceReconnect`; o celular desconecta e reconecta após `min(ms, 10000)` ms |

**Reconexão no cliente:**
- A cada `connect`, o celular reenvia `participant:join` com o mesmo `pid`.
- Se ainda estiver na votação aberta e o servidor não tiver o voto pendente, reenvia o voto.
- Se o participante já estava em espera (`markReady`), reenvia `participant:ready`.
- Reações nunca entram em fila: são emitidas com `socket.volatile` e só se `socket.connected`. Toques feitos offline são perdidos de propósito.
- Se o servidor fechar o socket (`io server disconnect`), o cliente tenta de novo após 1500 ms.

### 3.5 Comandos `control:cmd`

| `type` | Payload | O que faz | Erro (texto exato) |
|---|---|---|---|
| `start` | — | Só em `lobby`: entra em `reveal` e esconde o QR | `A pista já foi iniciada.` |
| `next` | — | Avança para a próxima fase de `PHASES` (esconde o QR se for para `reveal`) | `Sessão já encerrada.` |
| `goto` | `phase` | Vai direto para qualquer fase, com os efeitos de entrada (3.8) | `Etapa inválida.` |
| `nextBlock` | — | `block = (block + 1) % setlist.length` | `Setlist ainda não definida.` |
| `drop` | — | Em `set`, `mission` ou `reveal` → `buildup`; em `buildup` → `drop` | `O drop só pode ser acionado durante a pista.` |
| `end` | — | → `ended` | — |
| `restart` | — | → `lobby`, com reset (3.8) | — |
| `clap` | — | Só em LIVE_PHASES. Em `set`: energia +10. Em `mission`: carga +10, **sem multiplicador**. Em `buildup` e `drop`: só pulso visual. Grava `lastClapAt` e zera o relógio de inatividade | `Palmas valem só com a pista aberta.` |
| `setEnergy` | `value` | Em `mission`: carga = clamp(0, 100) e checa "pronta". Fora da missão: energia = clamp(20, 100). Zera o relógio de inatividade | `Valor inválido.` |
| `resetEnergy` | — | energia 35; carga 0; desliga pronta e assistência | — |
| `assist` | — | Só em `mission`: liga a assistência na hora | `Assistência só existe na missão do drop.` |
| `crowd` | `level: 'off' \| 'low' \| 'high'` | Liga o público simulado | `Nível inválido.` |
| `simulateBurst` | `count` | Só em LIVE_PHASES: gera `clamp(floor(count), 0, 200)` reações simuladas de tipos aleatórios | `Abra a pista para simular reações.` |
| `qr` | `visible` | Mostra ou esconde o QR no palco | — |
| `view` | `view: 'main' \| 'fachada'` | Troca a visão do palco | `Visão inválida.` |
| `autoDrop` | `value` | Liga/desliga o modo automático | — |
| `autoAssist` | `value` | Liga/desliga a assistência automática | — |
| `scenario` | `uploadFailure` | Liga/desliga a falha simulada de envio | — |
| `forceReconnect` | — | Emite `force-reconnect` para os celulares | — |

Um `type` desconhecido retorna `Comando desconhecido.`

### 3.6 Fórmula da energia (exata)

Constantes em `shared/config.ts` → `ENERGY`:

```
start 35 · floor 20 · max 100 · basePoints 3 · minPoints 0.35
decayDelayMs 3000 · decayPerSecond 1 · clapBonus 10 · highBand 75 · lowBand 45
mission: durationMs 45000 · assistAtMs 30000 · assistBelow 70 · multiplier 1.2
REACTION_RATE_LIMIT_MS 350
```

**Participantes ativos e pontos por reação:**

```
ativos = max(1, (participantes com status 'ready' E conectados) + SIMULATED_CROWD[crowd].size)
pontos = max(minPoints, basePoints / sqrt(ativos))     // = max(0.35, 3 / √ativos)
```

Exemplos: 1 ativo → 3 pontos; 4 → 1,5; 25 → 0,6. O piso de 0,35 pontos é atingido a partir de ~74 ativos.

**Quando uma reação é aceita** (`react`):
1. O tipo precisa ser válido.
2. O participante precisa ser conhecido na sessão.
3. A fase precisa estar em LIVE_PHASES.
4. Precisam ter passado ≥ 350 ms desde a última reação aceita **desse participante**.

Retornos internos: `accepted`, `rate_limited`, `inactive`, `unknown`, `invalid`. Só `accepted` conta.

O celular também limita o envio a 1 a cada 300 ms (`SEND_INTERVAL_MS`), mas mostra o efeito local em todo toque.

**Efeito de cada reação aceita** (inclusive as simuladas):

| Fase | Efeito |
|---|---|
| `set` | `energy = clamp(energy + pontos, 20, 100)` |
| `mission` | `dropCharge = clamp(dropCharge + pontos × 1.2, 0, 100)` e `energy = clamp(energy + pontos × 0.5, 20, 100)` |
| `buildup` e `drop` | Só contam em `totalReactions` e aparecem no LED |

Toda reação aceita zera o relógio de inatividade (`lastReactionAt = now`).

**Decaimento** (só em `set`):

```
se now − lastReactionAt > 3000 ms e energy > 20:
    energy = max(20, energy − 1 × dt/1000)
```

O `dt` vem do laço de 100 ms e é limitado a 0–2000 ms.

**Bônus de palmas:** +10 na energia (`set`) ou +10 na carga (`mission`). Ver `clap` em 3.5.

**Carga do drop:**
- Ao entrar em `mission`: `dropCharge = 0` e `missionEndsAt = now + 45000`.
- Quando `dropCharge ≥ 100`: `dropReady = true` e `dropReadyAt = now`.
- A carga não cai.

**Assistência automática** (avaliada a cada tick, em `mission`). Liga quando todas as condições abaixo são verdadeiras:
- a assistência ainda não está ativa;
- `autoAssist` está ligado;
- `dropReady` é falso;
- já passaram ≥ 30000 ms desde o início da missão;
- `dropCharge < 70`.

Ao ligar: `assistActive = true` e `assisted = true`.

**Com a assistência ativa e a pista ainda não pronta:**

```
restante = max(1, missionEndsAt − now)
passo = (100 − dropCharge) × dt / restante      // enche de forma linear até o fim da janela
se now ≥ missionEndsAt: soma 100 (fecha em 100)
```

Faixas de energia usadas na interface: abaixo de 45 = baixa, de 45 a 74 = média, 75 ou mais = alta.

### 3.7 Setlist e empate

1. **Contagem:** um voto por participante conhecido, conectado ou não. O voto só é aceito com `votingOpen`.
2. **Rotação:** `rot = number % 4`; `rotation = RHYTHM_IDS.slice(rot) + RHYTHM_IDS.slice(0, rot)`, com `RHYTHM_IDS = ['snacknbass', 'rappanados', 'crunchstep', 'funkynchicken']`.
3. **Ordem:** por votos (decrescente); empate resolvido pela posição na `rotation`.
4. **Resultado:** `setlist` = os 3 primeiros; `winner = setlist[0]`. Sem nenhum voto, a ordem é a própria rotação.
5. **Quando calcula:** ao entrar em `reveal`, `set`, `mission`, `buildup`, `drop` ou `ended`, se a votação ainda estava aberta ou a setlist vazia (`closeVoting`).
6. **Bloco atual por fase:**
   - `set`: `block = 0`
   - `mission`: `block = min(1, len − 1)`
   - `buildup`: `block = max(0, len − 1)`
   - `nextBlock` faz o ciclo manual entre os 3.

### 3.8 Temporizadores e efeitos de entrada

Laço global em `realtime.ts`: a cada 100 ms, `tick(now, dt)` em todas as sessões, seguido de transmissão de reações e estado.

**Temporizadores:**

| Regra | Valor |
|---|---|
| `reveal` → `set` automático | `REVEAL_MS = 6000` |
| `buildup` → `drop` automático | `BUILDUP_MS = 4000` (palco e celular mostram 3 · 2 · 1 · ON!) |
| autoDrop: missão pronta → `buildup` | 2000 ms após `dropReadyAt` |
| autoDrop: `drop` → `ended` | `AUTO_END_AFTER_DROP_MS = 18000` |
| Assistência automática | 3.6 |

Sem autoDrop, o drop é sempre manual. **Atenção:** se a janela da missão acabar sem assistência e sem carga 100, nada acontece: a sessão fica em `mission` mostrando "Faltam 00:00" até o apresentador agir.

**Efeitos ao entrar em cada fase:**

| Fase | Efeitos |
|---|---|
| `lobby` | Reabre a votação; zera `winner`, `setlist`, `block`; energia 35; zera carga, prontidão, assistência, `missionEndsAt`, `buildupEndsAt`, `dropAt`, `totalReactions`; `qrVisible = true`; `runId++`. **Mantém** participantes, votos, `crowd`, `autoDrop`, `autoAssist`, `view`, `scenario` |
| `reveal` | Fecha a votação |
| `set` | Fecha a votação; `block = 0`; zera o relógio de inatividade |
| `mission` | Ver 3.6 e 3.7 |
| `buildup` | `buildupEndsAt = now + 4000` |
| `drop` | `dropAt = now`; energia 100; carga 100 |
| `ended` | Desliga a assistência; `qrVisible = false` |

### 3.9 Público simulado (`SIMULATED_CROWD`)

| Nível | `size` (entra no denominador da fórmula) | Reações/s geradas |
|---|---|---|
| `off` | 0 | 0 |
| `low` | 8 | 2.5 |
| `high` | 25 | 11 |

- As reações são geradas por acumulador fracionário a cada tick, com tipo uniforme entre os 4.
- Só acontece em LIVE_PHASES.
- Vão para o palco marcadas com `sim: true`; o palco desenha igual às reais.

### 3.10 REST

| Rota | Resposta |
|---|---|
| `GET /health` | `200 { status: 'ok', uptime, sessions }` |
| `POST /api/sessions` | `201 { id, number, controlKey }`. `429 { error }` se o mesmo IP criou 40 sessões em 10 min. `503 { error }` se atingir `MAX_SESSIONS` mesmo após limpeza agressiva |
| `GET /api/sessions/:id` | `200 { exists: true, id, number, phase }` ou `404 { exists: false }` |
| `GET /api/stats` | `200 { sessionsInMemory, sessionsLive, sessionsCreated, participantsConnected, reactionsSinceBoot, uptimeSeconds }` |
| `/api/*` (outras) | `404 { error: 'not_found' }` |

Detalhes:
- Corpo JSON limitado a 8 kB; `trust proxy` = 1 (o IP real vem do proxy do Railway).
- `sessionsLive` conta sessões fora de `lobby` e `ended`.
- `reactionsSinceBoot` soma as reações aceitas dos celulares mais o `count` bruto de `simulateBurst`. **Não** inclui as reações do público simulado contínuo — inconsistência conhecida.

### 3.11 Limpeza de memória

| Modo | Quando roda | O que remove |
|---|---|---|
| Normal | A cada 60 s | Sessões sem nenhum socket, ociosas há mais de 6 h, ou encerradas e ociosas há mais de 1 h |
| Agressivo | Só ao criar sessão com o limite atingido | Ociosas há mais de 20 min, ou encerradas e ociosas há mais de 5 min — mesmo com sockets |

"Ociosa" mede `lastActivity`, que é atualizado pelas mutações (`touch`). O decaimento de energia não atualiza `lastActivity`.

---

## 4. Celular

Código em `src/participant/`. A tela exibida é decidida em `ParticipantApp.tsx` a partir de dois estados: a **jornada local** (localStorage) e o **estado da sessão** (servidor).

### 4.1 Jornada local (`Journey`)

| Campo | Valores |
|---|---|
| `step` | `welcome` \| `cadastro` \| `motivacao` \| `ritmo` \| `resultado` \| `camera` \| `semcamera` \| `session` |
| `motivation` | id da resposta |
| `vote` | id do ritmo |
| `voteState` | `confirmed` \| `closed` \| `pending` |
| `recordMode` | `real` \| `simulated` \| `none` \| null |
| `camFailure` | `denied` \| `unavailable` \| `insecure` \| null |
| `runId` | rodada vista pelo celular |
| `captured` | `real` \| `simulated` \| null |
| `concluded` | boolean |
| `delivery` | `none` \| `processing` \| `ready` \| `failed` \| `collective` |
| `attempts` | número de tentativas de processamento |
| `collectiveOnly` | boolean |

### 4.2 Ordem de resolução da tela (a primeira regra verdadeira vence)

1. Servidor respondeu `not_found` → **sessão inexistente/expirada** ("Essa sessão não está mais no ar.").
2. Ainda sem estado → "Conectando à sessão…".
3. Fase `ended` **e** jornada inicial não concluída (`step !== 'session'`) e sem registro em curso → **sessão encerrada** ("A Sessão N já terminou."), com links para `/demo` e `/`.
4. `step` de onboarding → a tela do passo (C01–C06, C16).
5. Gravador aberto e `recordMode` real ou simulado → **C10/C11/C12**. Mantém-se aberto mesmo se o set avançar ou a sessão encerrar.
6. Fase `ended` → C13; depois C14, C15 ou C18, conforme `concluded` e `delivery`.
7. Fase `lobby` ou `reveal` → **C07** (na revelação: "A galera escolheu: X").
8. Demais fases → **live**: C08 em `set`/`drop`; C09 em `mission`/`buildup`.

**Sobreposição C17** ("Reconectando…"): aparece quando o socket cai com `step === 'session'`. Durante o onboarding, aparece só uma faixa "Sem conexão — tentando de novo…".

**Nova rodada** (`runId` mudou): limpa `captured`, `concluded`, `delivery`, `attempts`, `collectiveOnly`, o vídeo e o clipe em memória, e fecha o gravador.

O celular chama `participant:ready` sempre que `step === 'session'` e o socket está conectado.

### 4.3 Transições C01–C18

| Tela | Ação → destino |
|---|---|
| C01 Boas-vindas | Começar → C02 |
| C02 Cadastro | Continuar → C03. Validação: nome com ≥2 caracteres após `trim`; WhatsApp com 10 ou 11 dígitos (máscara `(11) 98765-4321`); aceite dos termos obrigatório; marketing opcional e desmarcado. Erros aparecem no blur ou no envio, e o foco vai ao primeiro campo inválido. "Preencher com dados fictícios" preenche nome, telefone e aceite. **Nada é enviado nem salvo** |
| C03 Pesquisa (1 de 2) | Uma resposta → Continuar → C04 |
| C04 Ritmo (2 de 2) | O play (prévia de 8 s) é separado da seleção. Confirmar voto → C05 e `participant:vote`. Se a votação já fechou: `voteState = 'closed'` |
| C05 Resultado | Perfil + voto + sessão; "Salvar meu card" (PNG); Continuar → C06 |
| C06 Câmera opcional | "Ativar câmera" pede permissão → prévia "não está gravando" → Continuar: `recordMode = 'real'`, câmera liberada, vai para a sessão. "Seguir sem câmera" → `none`. "Modo demonstração" → `simulated`. Negada/indisponível/sem HTTPS → C16 |
| C16 Sem câmera | "Entrar na live" → `none`; "Tentar ativar câmera" → C06 |
| C07 Espera | Mostra conexão e prontos; muda quando o apresentador inicia |
| C08/C09 Live | Emojis enviam reações. "Gravar meu rolê" (só se `recordMode` real ou simulado) → C10. No drop, faixa "MODO ON ATIVADO" por 3,5 s |
| C10 Registro do DJ | "Iniciar gravação" (real) ou "Iniciar simulação". **REC só durante captura real**; o modo simulado mostra "Simulação · mm:ss" |
| C11 Troca de câmera | Após 4 s gravando: "Virar câmera" → C12 (câmera frontal) ou "Continuar com o DJ" |
| C12 Selfie | "Encerrar gravação" (para sozinho em 30 s) → prévia + download local → "Voltar para a pista" |
| C13 Conclusão | Ver meu registro → C14 |
| C14 Processamento | Monta o clipe no aparelho (4.5) → C15 (pessoal), C15 coletivo, ou C18 |
| C15 Clipe pronto | Baixar clipe; "Baixar gravação original" (se houve gravação real); "Salvar meu card"; "Ouvir Lek Tracks" (explica que o destino está a definir); "Tentar enviar meu vídeo" na versão coletiva quando houve captura |
| C18 Falha no vídeo | "Ver registro da sessão" → processa a versão coletiva; "Tentar enviar meu vídeo" → reprocessa a pessoal |

**Regra da falha simulada:** acontece só quando `scenario.uploadFailure` está ligado, a versão é pessoal e é a primeira tentativa (`attempts === 0`). A nova tentativa sempre funciona.

**Versão pessoal ou coletiva:** é **coletiva** quando não houve captura ou quando a pessoa escolheu o registro coletivo.

**Câmera.** `getUserMedia({ video: { facingMode: { ideal }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })`. A câmera é liberada (`track.stop()`) ao sair de C06 e ao fechar o gravador. Para o modo real é preciso HTTPS (`isSecureContext`).

### 4.4 Armazenamento local

| Chave | Onde | Conteúdo |
|---|---|---|
| `ltl:p:<ID>` | localStorage | `pid` do participante na sessão `<ID>` |
| `ltl:demo:<ID>` | localStorage | `pid` usado pelo `/demo` |
| `ltl:j:p:<ID>` / `ltl:j:demo:<ID>` | localStorage | Jornada (4.1), em JSON |
| `ltl:ctl:<ID>` | localStorage | Chave de controle salva no navegador do apresentador |
| `ltl:reduced-motion` | localStorage | `'1'` / `'0'` (preferência manual de movimento reduzido) |
| `ltl:demo-session` | sessionStorage | `{ id, controlKey }` da sessão criada pelo `/demo` |

A chave de controle chega pela URL em `#key=…`, é salva e depois removida da barra de endereço (`history.replaceState`).

Nome, WhatsApp, consentimentos, vídeos e clipes **não** são persistidos. Vídeo e clipe ficam só em memória (Blob) e se perdem ao recarregar. Na volta, C15 oferece "Gerar clipe neste aparelho".

### 4.5 Gravação (modo real) — `src/lib/camera.ts`, `CanvasRecorder`

- A câmera é desenhada num canvas de **720×1280** com corte tipo "cover", espelhado na câmera frontal.
- Marca d'água "Sadia ON · Lek Trek LIVE": `700 30px Poppins`, branca a 85%, posição (28, altura − 34).
- Grava `canvas.captureStream(30)` com MediaRecorder a 3 Mbps, em blocos de 500 ms.
- Por gravar o canvas, trocar de câmera não interrompe o arquivo.
- **Sem áudio.**
- Formato escolhido na ordem: `video/mp4;codecs=avc1`, `video/webm;codecs=vp9`, `video/webm;codecs=vp8`, `video/webm`, `video/mp4` (o primeiro suportado). Extensão `.mp4` ou `.webm`.
- Limites: `MAX_MS = 30000`; o convite para virar a câmera aparece em `FLIP_AFTER_MS = 4000`.

### 4.6 Clipe — `src/lib/clip.ts`, `composeClip`

Clipe vertical **540×960**, **7000 ms**, gravado em tempo real de um canvas.
- Quadros por `setTimeout` a ~30 fps; `captureStream(30)`; MediaRecorder a 2,5 Mbps, blocos de 250 ms; mesma ordem de formatos de 4.5.
- Espera `document.fonts.ready` antes de começar.

**Roteiro quadro a quadro:**

| Tempo | Imagem | Texto e overlay |
|---|---|---|
| 0–1500 ms | Fundo amarelo `#ffd200`; o Lek Trek (`lek_up`) sobe nos primeiros 500 ms | Logo; "Meu modo ON no Lolla" (pessoal) ou "O ON da nossa galera" (coletivo); perfil em caixa alta, itálico 900 |
| 1500–3000 ms | `photo_pista` com Ken Burns + gradiente escuro na base | "SESSÃO N · A GALERA ESCOLHEU" em amarelo; nome do ritmo |
| 3000–5200 ms | Vídeo real da pessoa, se houver (começa a tocar aos 3000 ms); senão POV→selfie (modo simulado); senão POV | "MEU PONTO DE VISTA", "POV · DEMONSTRAÇÃO" ou "A PISTA RESPONDE JUNTO"; emojis ❤️🔥👏⚡ subindo nas laterais |
| 5200–6200 ms | `photo_drop` + amarelo crescendo até 85% de opacidade | "MODO ON" / "ATIVADO" (vermelho) |
| 6200–7000 ms | Amarelo | Logo; "ATIVE SEU MODO ON"; "Clipe de demonstração · protótipo" |

Sem suporte a MediaRecorder ou `captureStream`, mostra uma barra de progresso simulada e C15 exibe uma "Prévia simulada" (crossfade CSS de duas imagens) com aviso. **Não há** clipe falso para download.

### 4.7 Card — `renderCard`

PNG **1080×1350**:
- Fundo amarelo com curva vermelha na base.
- Logo; "Meu modo ON:"; perfil em itálico 900, 104 px; Lek Trek (`lek_point`, 720×600).
- "Ritmo de abertura: X" (ou "Escolha da galera").
- "Lek Trek LIVE · Sessão N · K reações da galera" — K é o `totalReactions` da sessão, **inclui reações simuladas**.
- "ATIVE SEU MODO ON" em branco.

---

## 5. Palco

Código em `src/components/stage/`. O palco é desenhado num quadro fixo de **1920×1080** (unidades de design) e escalado para caber no contêiner, mantendo 16:9.

### 5.1 Variantes

**LED + BG** (`view: 'main'`), elementos e posição no quadro:

| Elemento | Posição (x, y, largura × altura) |
|---|---|
| Sala de fundo | SVG: 34 nervuras neon no teto e 30 no chão, saindo de elipses; elipse dourada do teto em (1180, 250) |
| BG curvo 16:9 | (700, 140), 1160×652. Recorte côncavo `M0,0 Q580,55.42 1160,0 L1160,652 Q580,596.58 0,652 Z` (gerado em `CurvedBG.tsx` como `BG_H*0.085` e `BG_H*0.915`). Conteúdo em canvas 1160×652 + texto HTML |
| LED oval | (175, 80), 670×920, moldura metálica (`conic-gradient`) com 25 px; tela interna 620×870 |
| Lek Trek no LED | Recorte `lek_led.webp` com 392 px de largura, topo a 205 px da tela interna |
| Cabine no LED | Painel em CSS sob o recorte, com 16 barras de equalizador e faixa de LED vermelha |
| Fala do Lek Trek | (780, 52), largura máxima 760 |
| HUD de energia | (880, 836), 860×178. Anel + barra; na missão, anel vermelho "Libere o drop", chip "Pista ON · X%" e tempo restante |
| Recepção com QR | (880, 820), 960×230, só em `lobby` com `qrVisible`. Fora da recepção, com `qrVisible`, aparece um QR pequeno no canto |

**Fachada 9:16** (`view: 'fachada'`): painel de 552×980 centralizado.
- Amarelo em `lobby`, `reveal` e `ended`: "A PISTA TÁ ON", Lek Trek apontando, "Vem com a sua galera.", QR.
- Amarelo no `drop`: "MODO ON ATIVADO".
- Escuro nas outras fases: "A ENERGIA DA GALERA", anel com % (carga na missão), "Sessão em andamento." ou "Liberando o drop!", e emojis que pulsam a cada lote.

**Recorte do LED por modo (BG):**

| Modo | Fases | Conteúdo |
|---|---|---|
| `yellow` | `lobby`, `drop`, `ended` | Fundo amarelo, ondas tonais, recorte vermelho; no drop, raios girando |
| `rays` | `mission`, `buildup` | 44 raios vermelhos + ondas |
| `waves` | `reveal`, `set` | 7 ondas em 3 passadas de brilho |

Textos do BG por fase: "LEK TREK LIVE"; "A galera escolheu" + ritmo + descrição; "PISTA ON" + "Ritmo i de 3 · nome"; "JUNTOS PRO DROP"; contagem 3/2/1/ON!; "MODO ON ATIVADO"; "ESSE ON FOI DE VOCÊS" + "Ative seu modo ON".

### 5.2 Intensidade

Valor de 0 a 1 (`intensityOf`):

| Fase | Intensidade |
|---|---|
| `lobby` | 0.22 |
| `reveal` | 0.45 |
| `set` | 0.3 + energia/100 × 0.55 |
| `mission` | 0.5 + carga/100 × 0.4 |
| `buildup` | 0.95 |
| `drop` | 1 |
| `ended` | 0.3 |

O que a intensidade controla (via variável CSS `--intensity` e o canvas):
- brilho das nervuras: `0.35 + 0.65 × I`;
- brilho vermelho em volta da moldura;
- vinheta do LED;
- altura do equalizador;
- brilho da faixa da cabine e opacidade da onda amarela;
- amplitude do "bounce";
- velocidade das ondas do canvas: `0.6 + I × 1.4`;
- amplitude das ondas: `0.35 + I × 0.75 + pulso × 0.35`.

O **pulso** sobe `0.12 × n` a cada lote de n reações (máximo 1.4) e decai com o fator `0.18^dt`.

`--beat = 60 / bpm` do ritmo atual (118 bpm sem ritmo) cadencia nervuras, bounce, equalizador e pratos.

### 5.3 Animações

O personagem **não é deformado**: o recorte não permite animar braços. O movimento vem de:
- drift de ±6 px em 11 s;
- bounce de escala ~1–1,014 no tempo;
- luzes cônicas girando sobre os pratos;
- equalizador e faixa de LED da cabine;
- onda amarela deslizando;
- varredura do LED a cada 7 s;
- textura de pixels sutil;
- ondas e raios no BG.

Outros efeitos:
- **Palmas:** pulso amarelo de 0,9 s na tela inteira.
- **Drop:** um brilho único de 0,9 s (sem estroboscópio) + 14 emojis em rajada no LED.

**Reações no LED:**
- Raias nas laterais internas do oval, seguindo a curva da elipse (recuo de 64–90 px da borda), preservando rosto, mãos e cabine.
- Emojis de 54–78 px sobem de y≈590–620 até y≈120–180 em 2,6–3,5 s.
- Máximo de **16 simultâneos**; o excedente vira um contador "emoji +N", que acumula por 1,5 s.

**Movimento reduzido** (sistema ou preferência manual): as animações contínuas param, os emojis aparecem e somem sem trajeto, e as ondas ficam lentas.

**Falas do Lek Trek** (`lekLine`):

| Fase | Fala |
|---|---|
| `lobby` | "A galera mantém o set ON. Escaneia e chega junto!" |
| `reveal` | "Sessão N, vocês deram o play. Quem abre essa live é… [ritmo]!" |
| `set`, energia < 45 | "Cadê essa pista? Reage aí que eu sigo vocês!" |
| `set`, energia < 75 | "É isso! Quero ver essa pista ON!" |
| `set`, energia ≥ 75 | "Essa pista tá ON! Segura esse ON!" |
| `mission`, pronta | "Drop liberado! Celular pronto?" |
| `mission`, assistida | "Eu puxo a batida. Vocês vêm comigo!" |
| `mission`, outros casos | "Essa pista tá ON. Mas o último drop é de vocês. Bora liberar?" |
| `buildup` | "Celular pronto? Galera junto? Três, dois, um…" |
| `drop` | "MODO ON ATIVADO!" |
| `ended` | "Esse ON foi de vocês. Agora leva essa live pro seu rolê!" |

**Página `/palco`:** só os botões "Tela cheia" e "Ativar som" ficam visíveis; somem após 2,5 s sem movimento do mouse ou toque.

---

## 6. Áudio

Código em `src/lib/audio.ts`. Não havia áudio na pasta de referências. Todo som é **sintetizado no navegador** (Web Audio) e só começa após um toque.

**Cadeia de som:** saída mestre → compressor (limiar −14, razão 4) → alto-falantes. Ruído branco gerado num buffer de 1 s.

**Instrumentos:**

| Instrumento | Como é feito |
|---|---|
| Bumbo | Oscilador senoidal 150→42 Hz em 0,14 s, decaimento 0,38 s |
| Caixa | Ruído em passa-faixa de 1800 Hz (0,18 s) + triângulo de 210 Hz |
| Chimbal | Ruído em passa-alta de 7500 Hz; 0,04 s fechado, 0,16 s aberto |
| Baixo | Dente-de-serra num passa-baixa ressonante (Q 6), corte `180 + intensidade × 600` Hz caindo a 90 Hz |

**Agendamento:** 16 passos (semicolcheias), com 120 ms de antecedência, verificado a cada 25 ms.

**Padrões** (`x` = 1, `o` = 0,6; o baixo em semitons a partir da fundamental):

| Estilo | Ritmo / BPM / fundamental | Bumbo | Caixa | Chimbal | Baixo |
|---|---|---|---|---|---|
| `funk` | FunkyN’Chicken / 130 / 43,65 Hz | `x..x..x.x..x..x.` | `....x.......x..o` | `x.x.x.x.x.x.x.x.` | `0,-,-,0,-,-,3,-,0,-,-,0,-,-,5,-` |
| `rap` | Rappanados / 92 / 49 Hz, swing 0,14 | `x......x..x.....` | `....x.......x...` | `x.x.x.x.x.x.x.xo` | `0,-,-,-,-,-,-,-2,-,-,0,-,-,-,-,-` |
| `step` | CrunchStep / 128 / 55 Hz | `x...x...x...x...` | `....x.......x...` | `..x...x...x...x.` | `-,-,0,-,-,-,0,-,-,-,0,-,-,-,3,-` |
| `bass` | SnackN’Bass / 140 / 41,2 Hz | `x.........x.....` | `........x.......` | `x.x.x.x.x.x.x.x.` | `0,-,0,-,-,-,0,0,-,-,7,-,-,5,-,-` |

**Comportamento por fase (trilha do palco, volume 0,6):**

| Fase | Comportamento |
|---|---|
| `lobby`, `reveal`, `ended` ("calmo") | Só bumbo a 0,55 e chimbal nos tempos fortes |
| Caixa | Entra com intensidade > 0,32 |
| Baixo | Entra com intensidade > 0,45 |
| `mission` com intensidade < 0,7 | Break: bumbo só a cada 8 passos, sem baixo |
| `buildup` | Rufar de caixa crescente + bumbo a cada 4 passos |
| `drop` ("big") | Caixa +0,2 e baixo a 0,5, independente da intensidade. **Não existe** um som específico de "impacto do drop" |

**Prévia de voto (C04):** 8 s por ritmo, volume 0,5, intensidade 0,85, uma prévia por vez.

**Na versão final** (recomendação do roteiro, não implementada): três blocos musicais, transições e drop com trilha original ou licenciada, com camadas que respondem à energia; voz do Lek Trek; sincronia com luz (show control). Fornecedor e licenças: **NÃO SEI**.

---

## 7. Identidade visual e assets

### 7.1 Origem das imagens

| Arquivo em `public/img/` | Origem | Processo |
|---|---|---|
| `lek_led.webp` (636×646) | Recorte de `pranchas/07_Reacoes_no_LED.png` (região do LED) | Segmentação por luminância (fundo preto), maior componente conectado (os emojis da prancha foram descartados), preenchimento de buracos, borda suavizada, ampliação 2× (Lanczos) + nitidez |
| `lek_up.webp` (672×600) | Recorte de `pranchas/01_Cadastro_e_Pesquisa.png` (tela C01) | Remoção do fundo amarelo por preenchimento a partir das bordas, alfa suavizado, ampliação 2× |
| `lek_point.webp` (648×540) | Recorte de `pranchas/06_Fachada_e_BG.png` (fachada amarela) | Idem |
| `photo_pista`, `photo_pov`, `photo_selfie`, `photo_drop` (~1532×690–704) | Quatro quadros de `pranchas/08_Atmosfera_e_Registro.png` | Ampliação 2× + nitidez leve |
| `render_fachada.webp` (1600×900) | `renders/Sadia_Lolla_2027_9A.png` | Redução |
| `favicon.svg` | Feito em código | — |

**Sobre a origem das pranchas e dos renders:**
- Foram fornecidas pela agência (commits de 10/11/2026 do usuário `paulorbaba`).
- O pedido original menciona "Corrija pequenos erros das imagens geradas", e o guia chama os renders de "simulações conceituais do espaço". Por isso parecem imagens geradas ou compostas digitalmente.
- **Ferramenta, prompts, autoria e direitos de uso: NÃO SEI.**
- Personagem Lek Trek: quem detém os direitos e se existe o KV original em 3D: **NÃO SEI**.

**Arquivos originais em alta resolução:** só os do repositório (`pranchas/`, 1536–1774 px; `renders/`, 1920×1080). Não há KV, recorte oficial do Lek Trek, packshots, logo vetorial nem fontes oficiais.

**Renders do térreo (`Terreo_2/3/4`) não foram usados no palco.** Eles mostram elementos descartados:
- Lek Trek holográfico azul;
- totens de celular;
- conteúdo "Crock Rock".

### 7.2 Logo "Sadia ON"

**Recriado em código, não é arte oficial** (`Logo` em `src/components/Brand.tsx`):
- "Sadia" em Barlow Condensed 700, vermelho `#e30613`;
- "ON" com o símbolo de power desenhado em SVG no lugar do "O", em Poppins 900, preto ou branco.

O clipe e o card desenham o mesmo logo em canvas. **Deve ser substituído pelo arquivo oficial.**

### 7.3 Fontes

| Fonte | Uso | Licença |
|---|---|---|
| Poppins 400, 500, 600, 700, 800, 900, 800 itálico, 900 itálico (subset latin, `@fontsource/poppins`) | Interface e chamadas de marca | SIL Open Font License 1.1 |
| Barlow Condensed 700 (`@fontsource/barlow-condensed`) | "Sadia" do logo provisório | SIL Open Font License 1.1 |

Ambas são substitutas. As fontes oficiais da campanha: **NÃO SEI**.

### 7.4 Paleta (`src/styles/global.css`)

| Token | Hex | Uso |
|---|---|---|
| `--yellow` | `#ffd200` | Campo principal |
| `--yellow-deep` | `#f5b800` | Tom de apoio |
| `--red` | `#e30613` | CTAs, "Sadia" |
| `--red-deep` | `#b0000c` | Sombra dos botões |
| `--red-glow` | `#ff3b30` | Anel da missão |
| `--ink` | `#111111` | Texto |
| `--ink-2` | `#2b2b2b` | Texto secundário |
| `--muted` | `#5d5a55` | Texto apagado |
| `--cream` | `#fbf8f1` | Fundo das telas claras |
| `--line` | `#e6e0d4` | Bordas |
| `--white` | `#ffffff` | — |
| `--dark` | `#120405` | Fundos escuros |
| `--ok` | `#19a34a` | Confirmação |

O amarelo foi aproximado da amostra das pranchas (RGB 254, 210, 6). Os demais foram escolhidos visualmente. **Cores oficiais da marca (Pantone/hex): NÃO SEI.**

---

## 8. Decisões tomadas e por quê

1. **Prioridade das referências** (definida no pedido): prompt > pranchas > guia > roteiro > assets.
2. **Pesquisa com 2 passos, não 3.** As pranchas (prioridade maior) mostram "1 de 2" (motivação) e "2 de 2" (ritmo). O roteiro propunha 3 perguntas. Ficou o formato das pranchas.
3. **Perfil = resposta da motivação, associação 1:1** (hipótese configurável em `MOTIVATIONS`):

   | Resposta | Perfil |
   |---|---|
   | A batida | ON na pista |
   | O refrão | ON no coro |
   | A descoberta | ON na descoberta |
   | A galera | ON com a galera |

   Frases de cada perfil em `PROFILES`.
4. **Ritmos:** nomes de trabalho do roteiro v2 (SnackN’Bass, Rappanados, CrunchStep, FunkyN’Chicken). Descrições, BPM e estilo sonoro foram inventados para o protótipo. Não há associação a SKU nem embalagens.
5. **Reações:** ❤️ 🔥 👏 ⚡, todas com o mesmo peso. O roteiro sugeria um "snack do bloco" como quarta reação; foi substituído por ⚡ porque não havia arte aprovada.
6. **Regra de energia:** derivada do roteiro (§19), com ajustes:
   - pontos escalados por 1/√ativos, para funcionar com 1 ou 30 pessoas;
   - mesmos 3 s de inatividade e 1 ponto/s de queda, com piso de 20 ("nunca silêncio");
   - missão com novo anel sem apagar a energia, 45 s, assistência aos 30 s abaixo de 70, sinalizada.
7. **Drop manual por padrão**, com modo automático opcional (pedido explícito).
8. **"Vamos juntos pro drop"** é texto de apoio, não botão (guia).
9. **REC nunca aparece sem captura real**; o modo simulado é rotulado "Simulação".
10. **O clipe é montado no aparelho**, para que "Baixar clipe" entregue um vídeo real e não uma imagem estática ou arquivo vazio. O upload ficou fora do escopo.
11. **Palco construído em código**, sem usar os renders internos, que têm elementos descartados.
12. **Personagem sem animação corporal**: o recorte não permite movimento convincente.
13. **Reações só vão para palco e controle**, não para outros celulares, para economizar banda.
14. **Fala do Lek Trek** em balão: falas adaptadas do roteiro (§9–13 e §18).
15. **Credencial na URL de controle via `#key=`** (fragmento não é enviado ao servidor nem aparece em logs de acesso) e removida da barra após salvar.
16. **Dashboard com geração por registro individual**, para que totais e gráficos sempre batam entre si e com os filtros.
17. **Descartados:**
    - holograma azul, totens, "Crock Rock";
    - a página cenográfica antiga do repositório (`server.js` + `public/index.html`, de outro protótipo);
    - terceira pergunta do quiz;
    - "snack" como reação;
    - pontuação pessoal no card (o roteiro pede para não exibir).

---

## 9. O que é encenação

| Item | Hoje | Como deveria funcionar de verdade |
|---|---|---|
| Cadastro, termos, política | Formulário só no aparelho; textos demonstrativos | Cadastro real com base legal LGPD, consentimentos separados e registrados, termos aprovados pelo jurídico |
| Palmas da sala | Botão do apresentador: +10 | Captação de áudio com filtragem, em janelas de chamada e resposta (o roteiro alerta para não confundir volume com participação) |
| Público simulado e rajadas | Gerados no servidor | Inexistente: só reações reais |
| Assistência do Lek Trek | Regra automática sinalizada | Igual, sincronizada com a trilha e o show control |
| Upload do vídeo | Não existe; o vídeo fica no aparelho | Upload resumível para armazenamento com prazo de retenção definido |
| Processamento do clipe | Montagem local de 7 s em tempo real | Edição no servidor (fila + FFmpeg ou serviço de vídeo), com trilha licenciada e planos da câmera fixa do estande |
| Falha no envio (C18) | Cenário ligado pelo apresentador; falha na primeira tentativa | Falha real de upload/processamento, com nova tentativa e fallback para a versão coletiva |
| Registro coletivo | Montagem local com fotos das pranchas | Clipe da câmera fixa do estande, por sessão |
| Entrega | Download no navegador | Página da sessão ou canal da Sadia (WhatsApp/BOT), só após validação (roteiro §13 e §21) |
| "Ouvir Lek Tracks" | Explica que o destino está a definir | Link da playlist oficial |
| Trilha | Sintetizada | Música original ou licenciada |
| POV e selfie no modo demonstração | Fotos das pranchas | — |
| Dashboard `/admin` | Dados fictícios determinísticos (abaixo) | Eventos reais, com base, período e deduplicação definidos (guia) |
| Indicadores da sala demonstrativa | Reais (`/api/stats`), mas zeram no reinício | Persistidos |

**Dados simulados do dashboard** (`src/admin/data.ts`, PRNG mulberry32 com semente `2027*100+dia`):

| Dia | Sessões (início, a cada 25 min) | Cadastros | Com POV / Coletivo / Em processamento / Falha | Motivação % | Votos % |
|---|---|---|---|---|---|
| 1 | 14 (12:00) | 480 | 260 / 130 / 20 / 10 | 40 / 25 / 15 / 20 | 22 / 18 / 24 / 36 |
| 2 | 16 (12:00) | 530 | 300 / 140 / 18 / 10 | 38 / 27 / 14 / 21 | 25 / 16 / 22 / 37 |
| 3 | 12 (13:00) | 395 | 228 / 104 / 12 / 8 | 41 / 22 / 17 / 20 | 20 / 19 / 27 / 34 |

- Participantes = soma das quatro situações de entrega.
- Entregues = Com POV + Coletivo.
- Totais dos três dias: 1.405 cadastros, 1.240 participantes, 42 sessões, 1.162 entregues.
- Os números do Dia 1 reproduzem o guia do protótipo. Dias 2 e 3 foram inventados.

---

## 10. Pendências e riscos

**Jurídico e LGPD**
- Termos, política, base legal, autorização de imagem separada da permissão de câmera, retenção dos vídeos: em aberto, conteúdo **NÃO SEI**.
- O protótipo não coleta dados, mas a versão real vai coletar.

**Entrega do clipe**
- Falta definir: upload, processamento, prazo, canal (página ou WhatsApp), expiração, identificação da pessoa sem login, vínculo com o brinde NFC.
- O roteiro trata tudo isso como "a validar".

**Persistência**
- Tudo em memória: reinício ou deploy apagam as sessões; o número da sessão volta ao início.
- Não há histórico nem métricas persistidas.

**Escala**
- Não foi testado com centenas de celulares. Foram testados até 2 celulares simultâneos + palco + controle (e 3–4 sockets nos testes de protocolo).
- Uma instância Node; o estado completo é transmitido a todos a cada ≥150 ms.
- Para escalar: adaptador Redis do Socket.IO + estado compartilhado (ou afinidade por sessão), e transmissão de diferenças.
- Capacidade real: **NÃO SEI**.
- A rede do evento (Wi-Fi dedicado, latência) também não foi validada.

**Dispositivos**
- Câmera, gravação e montagem do clipe só foram testadas no Chromium com câmera virtual.
- iOS Safari e Android Chrome físicos: **não testados**.
- Safari antigo pode não ter MediaRecorder em canvas; há prévia simulada como alternativa.
- Abas em segundo plano reduzem os timers e podem estragar a montagem de 7 s.

**Trilha**
- Sem música licenciada; sem saída de som verificada (o ambiente de teste não tinha alto-falante).

**Marca**
- Logo, fontes e cores oficiais pendentes.
- Recortes do Lek Trek em baixa resolução, derivados das pranchas.
- Direitos de uso das imagens: **NÃO SEI**.

**Repositório**
- A branch padrão do GitHub não é `main`.

**Bugs e limitações conhecidos**
1. Missão sem assistência que termina abaixo de 100 fica parada em "Faltam 00:00" até ação manual.
2. `reactionsSinceBoot` (`/api/stats`) não conta o público simulado contínuo e soma o `count` bruto (não limitado) de `simulateBurst`.
3. O total de reações no card inclui reações simuladas.
4. Votos de participantes desconectados (ou que nunca ficaram prontos) contam na setlist.
5. Um celular novo que abre o link de sessão já encerrada entra em `counts.known`.
6. `setEnergy` fora de `set` e `mission` altera `energy` mesmo sem efeito visível relevante.
7. Leve viés de módulo na geração do `sessionId`.
8. Gravação real sem áudio.
9. Vídeo e clipe se perdem ao recarregar a página (na volta, é possível regerar o clipe, mas o POV real não volta).
10. O limite de criação de sessões (40 por IP em 10 min) é em memória e por IP; atrás de NAT do evento, todo mundo compartilha o mesmo IP. Só a central cria sessões, então o impacto é baixo.
11. Sem autenticação no `/admin` (dados simulados) nem na criação de sessões.

---

## 11. Prompts e histórico

**Não incluídos:**
- As instruções de sistema da ferramenta (Claude Code) — são configuração genérica do assistente, com dados da conta, e não definem o produto.
- As preferências pessoais de tom de resposta do usuário — não afetam o código.

**Documentos de projeto** que guiaram o trabalho estão no repositório, na íntegra: `guia do protótipo.md` e `roteiro da ativação.md`.

### 11.1 Pedido principal (íntegra)

> Atue como um desenvolvedor front-end sênior, especialista em UI design, UX e experiências interativas de marca.
> Construa um protótipo funcional da ativação Sadia ON / Lek Trek LIVE, para apresentar o projeto e demonstrar sua dinâmica com pessoas participando pelo celular.
> O resultado deve ter qualidade visual para apresentação ao cliente, navegação completa e uma interação central funcionando de verdade: a pessoa reage pelo celular e vê sua reação aparecer no LED do Lek Trek, junto à evolução da energia coletiva no palco.
> Execute até termos uma aplicação funcionando e testada. Não se limite a propor arquitetura ou descrever o que faria.
> 1. Repositório e materiais
> O repositório conectado se chama Sandbox. Os arquivos de referência já foram enviados ao GitHub.
> Primeiro, confirme que está no repositório correto e examine sua estrutura. Procure a pasta `/referencias`; se os materiais estiverem organizados de outra maneira, localize-os antes de implementar.
> Os materiais incluem:
>
> * Pranchas atualizadas das interfaces e do ambiente.
> * Guia de navegação e detalhamento do protótipo.
> * Roteiro geral da ativação.
> * Assets originais da marca e referências visuais.
>
> Use esta ordem de prioridade:
>
> 1. Este prompt.
> 2. Pranchas mais recentes, que representam a versão visual atual.
> 3. Guia do protótipo, para comportamentos e transições.
> 4. Roteiro geral, para contexto e mecânica.
> 5. Assets originais, para execução visual.
>
> Não reintroduza elementos descartados presentes em versões antigas. As pranchas são referências de design; reconstrua as interfaces com componentes reais, sem usar a imagem inteira de cada tela como interface clicável.
> Faça um inventário breve dos materiais, identifique os assets utilizáveis e mapeie a jornada. Em seguida, apresente um plano curto e comece a executar. Resolva escolhas reversíveis com bom senso; pergunte apenas quando uma contradição realmente impedir o trabalho.
> 2. Autorização para trabalhar
> Você está autorizado a:
>
> * Substituir o conteúdo antigo da aplicação necessário para construir este projeto.
> * Remover arquivos antigos incompatíveis com esta implementação.
> * Fazer commits.
> * Enviar as alterações diretamente para a branch `main`.
>
> Preserve os materiais de referência enviados, incluindo a pasta `/referencias`, onde existir. A autorização para substituir a aplicação não inclui apagar esses materiais.
> Preserve o histórico Git e use commits normais, sem force push. Não descarte alterações não commitadas sem verificar sua origem.
> Não inclua credenciais, arquivos `.env`, dependências instaladas ou arquivos gerados desnecessários. Copie para os assets da aplicação apenas os materiais utilizados e otimize suas versões de execução sem alterar os originais.
> Se houver impedimento de acesso ou push, informe exatamente o que ficou pendente. Não afirme que enviou alterações sem confirmar.
> O deploy será realizado posteriormente no Railway. Prepare a aplicação, mas não faça o deploy agora.
> 3. Experiência que queremos demonstrar
> O apresentador abre um palco virtual no computador ou na TV. Os participantes escaneiam um QR code, acessam pelo próprio celular, percorrem o fluxo inicial e entram na mesma sessão.
> Durante a dinâmica:
>
> * O Lek Trek aparece em uma composição animada, simulando um DJ tocando.
> * As pessoas enviam emojis pelo celular.
> * As reações surgem no próprio LED do Lek Trek.
> * A energia coletiva aumenta.
> * O BG e os efeitos visuais respondem.
> * O apresentador conduz a chegada ao drop e o encerramento.
>
> Essa é a funcionalidade prioritária. O restante da jornada deve estar navegável, com simulações claras onde não houver implementação real.
> 4. Arquitetura
> Use:
>
> * React + TypeScript + Vite no front-end.
> * Node.js + Express para servir a aplicação em produção.
> * Socket.IO para sincronizar celulares, palco e controle.
> * Um único serviço no Railway, com interface e servidor no mesmo domínio.
>
> Não adicione banco de dados, autenticação completa de usuários, serviços pagos ou infraestrutura de produção nesta fase.
> Mantenha sessões temporárias em memória. Documente que elas são perdidas quando o servidor reinicia e que o deploy inicial pressupõe uma única instância.
> Separe componentes visuais, lógica da sessão e comunicação em tempo real de forma organizada, sem criar abstrações desnecessárias.
> 5. Áreas e acesso
> Disponibilize:
>
> * `/` — central da demonstração, com opções para criar sessão, explorar o protótipo e acessar o dashboard.
> * `/participar/:sessionId` — jornada mobile do participante.
> * `/palco/:sessionId` — ambiente visual sincronizado, adequado a tela cheia.
> * `/controle/:sessionId` — comandos do apresentador.
> * `/demo` — demonstração individual, com celular simulado e palco na mesma página.
> * `/admin` — dashboard desktop com dados fictícios.
>
> Ao criar uma sessão, gere:
>
> * Link de participação.
> * QR code funcional.
> * Link do palco.
> * Acesso ao controle do apresentador.
>
> Construa os links a partir do domínio atual, sem localhost fixo.
> O QR pode aparecer em uma área de recepção do palco e ser recolhido durante a dinâmica. Permita abrir o palco em outra janela e manter os controles na janela do apresentador.
> Em celulares, a interface do participante deve ocupar a tela disponível. Em desktop, pode aparecer em um enquadramento de celular.
> 6. Fluxo individual e momento coletivo
> As etapas iniciais são individuais:
>
> * Boas-vindas.
> * Cadastro demonstrativo.
> * Pesquisa.
> * Voto no ritmo.
> * Devolutiva.
> * Preparação e câmera opcional.
>
> Depois, o participante chega a uma sala de espera.
> O apresentador inicia o momento coletivo. Os participantes prontos entram na pista. Quem concluir o fluxo depois entra no estado atual da sessão, sem reiniciar a dinâmica dos demais.
> Sincronize:
>
> * Participantes conectados e prontos.
> * Votos necessários à demonstração.
> * Reações.
> * Energia coletiva.
> * Etapa do set.
> * Drop e encerramento.
>
> Mantenha cadastro, permissões de câmera, captura e prévia de vídeo separados por participante. Não transmita dados pessoais nem vídeos para o palco.
> Para quem entrar após o encerramento, mostre uma mensagem coerente e um caminho para uma nova demonstração.
> 7. Direção visual
> Use as pranchas atualizadas como referência principal de composição, hierarquia, identidade e copy.
> Preserve:
>
> * Paleta amarela, vermelha, preta e branca.
> * Tipografia expressiva nos momentos de marca.
> * Tipografia legível nos formulários, instruções e controles.
> * Respiro, hierarquia clara e uma ação principal por etapa.
> * Emojis reconhecíveis: ❤️ 🔥 👏 ⚡.
> * Lek Trek com aparência, materiais e cores do KV.
>
> Use logos, fontes, personagens e imagens originais quando disponíveis. Não substitua assets adequados por recriações genéricas.
> Reconstrua a interface com componentes reais e texto selecionável. Corrija pequenos erros das imagens geradas, incluindo distorções, alinhamentos, contraste e inconsistências de copy.
> O Lek Trek não pode ter corpo translúcido, tratamento futurista, contorno neon ou aparência azul holográfica. A referência à holografia diz respeito à instalação física; a aparência do personagem deve permanecer fiel ao KV.
> Não inclua os totens de celular presentes em alguns renders. Os participantes usam os próprios aparelhos.
> 8. Palco virtual e animação do Lek Trek
> Não há vídeo nem animação pronta do Lek Trek discotecando. Trabalhe com os renders estáticos e assets fornecidos.
> Inspecione os arquivos e escolha a abordagem com melhor resultado:
>
> * Composição a partir de assets separados, quando disponíveis.
> * Recorte do personagem e da cabine, se possível sem comprometer a qualidade.
> * Render estático como base, complementado por camadas animadas.
>
> Crie um loop por meio de recursos leves de front-end, como:
>
> * Movimento sutil de câmera e parallax.
> * Oscilação discreta da composição.
> * Discos girando, quando estiverem em uma camada utilizável.
> * Equalizadores e indicadores da cabine.
> * Luzes e pulsos sincronizados.
> * Ondas e movimento do BG.
> * Transições de intensidade entre espera, pista e drop.
>
> Não deforme a anatomia do personagem nem simule movimentos complexos de braços com recortes inadequados. Se o asset não permitir animação corporal convincente, mantenha o personagem estático e concentre o movimento no ambiente, na cabine e nos efeitos.
> O loop precisa parecer intencional e bem acabado, sem tremores, emendas visíveis ou movimentos exagerados. Não dependa de uma API externa de geração de vídeo.
> Diferencie visualmente:
>
> * LED oval do Lek Trek: personagem e cabine.
> * BG interno: conteúdo horizontal 16:9, apresentado como painel curvo.
> * Fachada: conteúdo vertical 9:16, acessível em visualização alternativa.
>
> Na visão principal do palco, priorize Lek Trek e BG. Não comprima todas as superfícies simultaneamente.
> Se usar um render completo como cenário, evite manter um personagem antigo visível por trás de outra versão sobreposta.
> 9. Reações e energia coletiva
> Ao tocar em um emoji:
>
> 1. O celular confirma o toque imediatamente.
> 2. A reação é enviada à sessão.
> 3. O emoji aparece nas laterais do LED do Lek Trek.
> 4. A energia coletiva recebe a contribuição.
> 5. O BG responde de maneira proporcional.
>
> Preserve rosto, mãos e cabine. Os emojis devem surgir, se deslocar e desaparecer com fluidez.
> Limite a quantidade de emojis simultâneos para evitar poluição visual. Implemente um limite de frequência por participante para que toques excessivos não sobrecarreguem a demonstração.
> O servidor deve controlar energia e etapa coletiva. Todos os dispositivos recebem o mesmo estado.
> Use uma regra simples, configurável e documentada para transformar reações em energia. Não apresente esse cálculo como medição real de movimento ou som da pista.
> Por padrão, o apresentador controla o drop. Ao atingir a energia necessária, sinalize que a pista está pronta. Disponibilize um modo automático opcional.
> Se não houver áudio adequado na pasta, mantenha a demonstração visual funcional. Não dependa de música externa ou serviços de streaming. Qualquer áudio deve começar após uma ação explícita.
> 10. Jornada mobile
> Implemente as telas das pranchas e os comportamentos necessários:
>
> * Cadastro com validação e mensagens próximas aos campos.
> * Aceite de participação separado de comunicações opcionais.
> * Marketing desmarcado inicialmente.
> * Pesquisa com seleção e confirmação.
> * Prévia musical separada da ação de votar, quando houver áudio.
> * Resultado ou perfil.
> * Preparação.
> * Espera pela sessão.
> * Reações ao vivo.
> * Registro do DJ.
> * Troca opcional para selfie.
> * Encerramento.
> * Processamento e entrega do registro.
>
> O cadastro é demonstrativo: permita preenchimento fictício ou rápido. Não envie nome, contato ou consentimentos ao servidor se não forem necessários ao protótipo.
> Se a associação entre respostas e perfis não estiver definida, proponha uma regra simples e configurável, documentada como hipótese.
> Diferencie instruções de controles. “Vamos juntos pro drop” funciona como mensagem de apoio; os emojis são os botões de reação.
> 11. Câmera e registro
> Ofereça dois caminhos.
> Modo demonstrativo
> Use os renders para representar o POV do DJ e a selfie. A jornada completa deve funcionar sem câmera, permissões ou serviços externos.
> Modo câmera real
> Quando suportado pelo navegador:
>
> * Solicitar acesso após ação explícita.
> * Permitir iniciar e encerrar gravação.
> * Alternar entre câmera traseira e frontal, quando disponível.
> * Oferecer prévia e download local.
>
> Conceder acesso à câmera não deve iniciar a gravação automaticamente.
> A troca para selfie é opcional. Quem não habilitar a câmera continua participando das reações.
> Libere a câmera ao sair da etapa. Não envie gravações para o servidor nesta fase.
> Se não houver montagem automática do clipe personalizado, represente a entrega como simulação. Não disponibilize imagem estática ou arquivo vazio como vídeo finalizado.
> A captura permanece sob controle do participante mesmo quando o set coletivo avança.
> 12. Estados alternativos
> Implemente:
>
> * Câmera negada ou indisponível.
> * Participação sem câmera.
> * Reconexão.
> * Sessão inexistente ou expirada.
> * Sessão encerrada.
> * Clipe em processamento.
> * Clipe pronto.
> * Falha simulada no envio ou processamento.
> * Nova tentativa.
> * Registro coletivo como alternativa.
>
> Como não haverá upload real de vídeo, identifique a falha de envio como cenário demonstrativo no controle do apresentador.
> Ao reconectar, recupere o estado atual da sessão. Não reenvie reações antigas acumuladas nem reinicie a jornada indevidamente.
> Use identificadores de participantes por sessão para evitar contagem duplicada em reconexões. Sessões diferentes não podem interferir entre si.
> 13. Controle do apresentador
> Crie um painel simples com:
>
> * Participantes conectados e prontos.
> * Iniciar a pista.
> * Avançar etapas.
> * Ajustar ou reiniciar energia.
> * Simular reações de participantes adicionais.
> * Acionar o drop.
> * Encerrar e reiniciar a sessão.
> * Demonstrar estados alternativos.
> * Abrir o palco e copiar links.
> * Exibir ou recolher o QR code.
>
> Proteja os comandos com uma credencial de controle por sessão validada no servidor. O link público do participante não deve permitir controlar a apresentação.
> O palco não deve mostrar controles técnicos, mensagens de debug ou configurações.
> Mantenha `/demo` como alternativa individual: celular simulado e palco na mesma página, com a mesma lógica visual, sem depender de outros aparelhos.
> 14. Dashboard administrativo
> Crie uma visão desktop separada, identificada como “Dados simulados”, seguindo a prancha.
> Inclua:
>
> * Cadastros.
> * Participantes.
> * Sessões concluídas.
> * Clipes entregues.
> * Respostas da pesquisa.
> * Votos por ritmo.
> * Status de entrega de conteúdo.
>
> Use números consistentes entre gráficos e totais. Filtros devem produzir respostas coerentes.
> Separe os dados fictícios de análise dos indicadores reais da sala demonstrativa. Não misture resultados inventados com reações recebidas durante a apresentação.
> Não é necessário desenvolver autenticação administrativa completa nesta fase.
> 15. Preparação para Railway
> Inclua:
>
> * `npm run dev` para desenvolvimento.
> * `npm run build` para gerar a versão de produção.
> * `npm start` para servir a aplicação e a comunicação em tempo real.
> * Servidor ouvindo em `0.0.0.0`, na porta de `process.env.PORT`.
> * Endpoint `/health`.
> * Tratamento de rotas para acesso direto e atualização sem erro 404.
> * Assets funcionando em produção.
> * `.env.example` sem segredos.
> * Arquivo de lock das dependências.
>
> Front-end e Socket.IO devem usar o mesmo domínio, sem URL de servidor fixa no código.
> Documente a operação com uma única instância e sessões em memória. Não adicione Redis, banco de dados ou múltiplos serviços.
> 16. Ordem de execução
> Trabalhe em etapas verificáveis, mantendo o escopo completo:
> Etapa 1 — Provar a interação central
> Criar sessão, abrir palco, conectar participantes por QR, enviar reações e sincronizar energia e drop.
> Etapa 2 — Completar a jornada
> Implementar cadastro, pesquisa, preparação, câmera opcional, encerramento, registro e dashboard.
> Etapa 3 — Refinar a apresentação
> Lapidar identidade visual, composição e animação do palco, responsividade, estados alternativos e roteiro de demonstração.
> Não encerre o trabalho após a primeira etapa. Use essas etapas para verificar o funcionamento antes de avançar.
> 17. Validação
> Priorize:
>
> * Boa apresentação em celular e desktop.
> * Controles confortáveis para toque.
> * Foco visível, rótulos acessíveis e navegação por teclado.
> * Contraste e opção de reduzir movimento.
> * Animações fluidas e uso moderado de recursos.
> * Ausência de botões sem comportamento.
>
> Execute o build e teste a versão de produção.
> Valide:
>
> 1. Jornada completa.
> 2. Participante e palco em contextos de navegador distintos.
> 3. Múltiplos participantes na mesma sessão.
> 4. Reações e energia sincronizadas.
> 5. Reconexão sem duplicação.
> 6. Isolamento entre sessões.
> 7. Restrição dos comandos do apresentador.
> 8. Acesso direto às rotas.
> 9. Câmera opcional e alternativa demonstrativa.
> 10. Ausência de cortes, sobreposições e erros de console.
>
> Use testes automatizados onde ajudarem a verificar a lógica coletiva. Inspecione visualmente as páginas renderizadas e compare com as pranchas.
> Se o ambiente não permitir verificar alguma funcionalidade, registre essa limitação e forneça um procedimento de teste. Não declare como testado o que não foi executado.
> 18. Entrega
> Entregue:
>
> * Aplicação completa e funcionando.
> * Commit e push na `main`, quando permitido pelo ambiente.
> * README com instalação, execução e configuração no Railway.
> * Endereços das áreas.
> * Lista objetiva do que é real e do que é simulado.
> * Decisões e limitações relevantes.
> * Roteiro de apresentação de poucos minutos.
>
> O roteiro deve permitir:
>
> 1. Abrir o palco no computador.
> 2. Criar a sessão e mostrar o QR.
> 3. Entrar pelo celular.
> 4. Percorrer o fluxo inicial.
> 5. Iniciar a pista.
> 6. Enviar reações e vê-las no Lek Trek.
> 7. Acionar o drop.
> 8. Encerrar e mostrar o registro.
>
> O critério de sucesso é demonstrar a proposta com clareza e impacto: o cliente participa pelo celular e percebe a resposta da pista em tempo real, dentro de uma experiência visual fiel ao projeto.

### 11.2 Mensagens seguintes do usuário (íntegra)

1. "Faz o deploy no railway agora"
2. "Tá tudo funcionando! Para ajustar detalhes de programação e trocar artes por layouts feitos pelo meu time de design, qual o melhor jeito?"
3. "Acho que muita coisa vai ser por referência, te mando a arte em vetor e você desdobra?"
4. O pedido deste handoff (arquivo enviado pelo usuário).

### 11.3 Linha do tempo

| Data | Evento |
|---|---|
| 10/11/2026 | Agência sobe pranchas, roteiro, guia e renders |
| 10/11/2026 | Protótipo implementado e testado; commit `4a22ad4` na `main` |
| 10/11/2026 | Deploy no Railway |
| 11/11/2026 | Este documento |

Nenhuma arte vetorial do time de design tinha chegado até a criação deste documento.

---

## 12. O que este handoff NÃO cobre

- Briefing original da Sadia e o deck comercial.
- Arquivos oficiais da marca: logo, fontes, KV, Pantones, Lek Trek 3D, packshots e a associação ritmo ↔ SKU.
- Autoria, ferramenta, prompts e direitos de uso das pranchas e renders.
- Textos jurídicos finais (termos, política, autorização de imagem) e o desenho LGPD.
- Especificação técnica do LED oval, do BG curvo e da fachada reais: mapa de pixels, resolução nativa, fornecedor.
- Show control, integração com luz e som, captação de palmas.
- Trilha musical real e licenças.
- Arquitetura de produção: persistência, escala horizontal, upload e processamento de vídeo, entrega por WhatsApp/BOT, NFC do brinde.
- Testes em aparelhos físicos (iOS/Android), em TV/projetor e em rede de evento; testes de carga.
- Acessibilidade auditada formalmente: o que foi feito são boas práticas (rótulos, foco visível, movimento reduzido, contraste), sem auditoria WCAG.
- Plano e custos da conta Railway.
- Os detalhes visuais tela a tela (CSS). A fonte de verdade é o código em `src/`.
