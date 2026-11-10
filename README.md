# Sadia ON · Lek Trek LIVE — protótipo funcional

> **O Lek Trek comanda o som. A galera mantém o set ON.**

Protótipo da ativação Sadia ON no Lollapalooza Brasil 2027. O apresentador abre um **palco virtual** na TV ou no projetor, as pessoas entram pelo **próprio celular** via QR code e cada reação (❤️ 🔥 👏 ⚡) aparece **no LED oval do Lek Trek** enquanto a **energia coletiva** transforma o BG e leva a sessão até o drop.

- Front-end: React + TypeScript + Vite
- Servidor: Node.js + Express (serve a interface e a API)
- Tempo real: Socket.IO no **mesmo domínio** (sem URL fixa no código)
- Um único serviço, sessões **em memória**, sem banco de dados

---

## Áreas

| Rota | Para quem | O que faz |
| --- | --- | --- |
| `/` | Apresentador | Central: criar sessão (gera link de participação, QR, link do palco e acesso ao controle), explorar o protótipo, abrir o dashboard |
| `/participar/:sessionId` | Público | Jornada mobile completa (C01–C18). No celular ocupa a tela toda; no desktop aparece num enquadramento de celular |
| `/palco/:sessionId` | TV / projetor | Palco virtual 16:9 sincronizado, para tela cheia. Sem controles técnicos (só “Tela cheia” e “Ativar som”, que somem sozinhos) |
| `/controle/:sessionId` | Apresentador | Painel de comando com prévia do palco. Exige a credencial da sessão |
| `/demo` | Apresentação individual | Celular simulado + palco na mesma página, explorador de telas C01–C18 e cenários, sem outros aparelhos |
| `/admin` | Equipe | Dashboard desktop com **dados simulados**, separado dos indicadores reais da sala demonstrativa |
| `/health` | Infra | `{"status":"ok"}` para checagem do Railway |

Os links são sempre montados a partir do domínio atual (`window.location.origin`).

---

## Rodando localmente

Requer Node.js 20+ (testado com Node 22).

```bash
npm install
```

```bash
npm run dev
```

Abre em `http://localhost:3000` (Express + Vite em modo middleware, com recarga automática). Para celulares na mesma rede, use o IP da máquina — note que **a câmera só funciona em HTTPS** (ou `localhost`); sem HTTPS o fluxo segue normalmente pelo modo demonstração.

Versão de produção:

```bash
npm run build
```

```bash
npm start
```

Testes da lógica coletiva (Vitest):

```bash
npm test
```

| Script | Faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (porta `PORT` ou 3000) |
| `npm run build` | Gera `dist/client` (Vite) e `dist/server.js` (esbuild) |
| `npm start` | Serve interface, API e Socket.IO a partir de `dist/` |
| `npm test` | Testes da sessão: energia, limite de frequência, reconexão, isolamento, credencial, drop |
| `npm run typecheck` | Verificação de tipos |

### Variáveis de ambiente (opcionais)

Ver `.env.example`. Nenhum segredo é necessário.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP (o Railway define automaticamente) |
| `SESSION_NUMBER_START` | `1` | Número exibido na primeira sessão (“Sessão N”) |
| `MAX_SESSIONS` | `200` | Limite de sessões simultâneas em memória |

---

## Deploy no Railway (não realizado nesta etapa)

1. Crie um projeto no Railway a partir deste repositório (um único serviço).
2. Build: `npm run build` · Start: `npm start` (o Railway detecta pelos scripts do `package.json`; Node ≥ 20 em `engines`).
3. Gere um domínio público (Settings → Networking). WebSocket funciona no mesmo domínio, sem configuração extra.
4. Health check: caminho `/health`.
5. **Mantenha 1 réplica.** As sessões vivem na memória do processo: com mais de uma instância, palco, celulares e controle poderiam cair em processos diferentes.

Operação em memória — o que isso significa:
- Reiniciar ou fazer novo deploy **apaga todas as sessões**. Links antigos passam a mostrar “Essa sessão não está mais no ar”.
- Sessões ociosas são removidas após 6 h; sessões encerradas, após 1 h sem conexões.
- Escalar horizontalmente exigiria um adaptador compartilhado (ex.: Redis), fora do escopo desta fase.

O servidor escuta em `0.0.0.0:$PORT`, serve os assets do build e devolve o `index.html` para qualquer rota da interface (acesso direto e atualização sem 404).

---

## Como funciona a sessão

### Etapas (controladas pelo servidor)

`Recepção → Revelação do ritmo → Pista ON → Missão do drop → Build-up → Drop · Modo ON → Encerramento`

- O servidor é a **única fonte de verdade** de etapa, energia, carga do drop e votos. Palco, controle e celulares recebem exatamente o mesmo estado.
- A revelação mostra o ritmo mais votado e abre a pista sozinha após 6 s. Empates usam uma ordem rotativa entre sessões.
- Quem conclui o fluxo inicial depois que a pista abriu **entra no estado atual**, sem reiniciar a dinâmica dos demais.
- Quem abre o link depois do encerramento vê “A Sessão N já terminou” e um caminho para a demonstração.

### Regra de energia (simulação, não medição)

Configurável em `shared/config.ts` (`ENERGY`). Os valores são hipóteses de protótipo baseadas no roteiro:

- **Pista ON:** começa em 35%. Cada reação aceita soma `max(0,35 ; 3 ÷ √participantes ativos)` pontos — com mais gente, cada toque vale menos e a sala enche no mesmo ritmo. Sem reações por 3 s, cai 1 ponto/s até o piso de 20% (nunca “apaga”). “Palmas da sala” (botão do apresentador) soma 10.
- **Missão do drop:** novo anel de 0 a 100% (sem apagar a energia já conquistada, que segue exibida como “Pista ON”). Não cai. Janela de 45 s; aos 30 s, abaixo de 70%, a **assistência do Lek Trek** completa a carga até o fim da janela — sempre sinalizada no palco e nos celulares (“Lek Trek puxando a batida”), nunca apresentada como participação medida.
- **Carga 100%:** palco e controle sinalizam “Pista pronta pro drop”. Por padrão **o apresentador aciona o drop**; o **modo automático** opcional segue sozinho para build-up (contagem 3·2·1), drop e encerramento.
- **Limite por participante:** 1 reação contabilizada a cada 350 ms (servidor). O celular sempre confirma o toque na hora; o envio é limitado a 1 a cada 300 ms. Excesso de eventos por conexão é descartado.
- **Excesso visual:** o LED mostra no máximo 16 emojis simultâneos, nas laterais do oval (preservando rosto, mãos e cabine). O que passar disso é agrupado num contador “🔥 +N”.

Isso **não** é leitura de som ou movimento da pista; palmas e público simulado representam a sala na demonstração.

### Pesquisa → perfil (hipótese configurável)

Associação 1:1 em `shared/config.ts` (`MOTIVATIONS`):

| “O que te coloca no modo ON?” | Perfil |
| --- | --- |
| A batida | ON na pista |
| O refrão | ON no coro |
| A descoberta | ON na descoberta |
| A galera | ON com a galera |

O voto no ritmo é independente do perfil. Ritmos: nomes de trabalho do roteiro v2 (SnackN’Bass, Rappanados, CrunchStep, FunkyN’Chicken), sem associação a SKU.

### Privacidade e segurança

- Nome, WhatsApp e consentimentos **não saem do aparelho** (nem são salvos). O servidor recebe apenas um identificador aleatório por sessão, o voto e as reações.
- Aceite de participação separado de comunicações opcionais (marketing desmarcado).
- Vídeos ficam no aparelho; download local. Nada é enviado ao servidor.
- Cada sessão gera uma **credencial de controle** aleatória (comparação em tempo constante no servidor). O link público do participante não controla nada; a credencial vai no fragmento `#key=` (não trafega em logs), é guardada no navegador do apresentador e removida da barra de endereço.
- Identificador de participante por sessão: reconectar ou recarregar não duplica contagem. Sessões diferentes não compartilham estado.

---

## O que é real e o que é simulado

| Funcionalidade | Status |
| --- | --- |
| Sessões, QR, links, palco, controle e celulares sincronizados em tempo real | **Real** (Socket.IO) |
| Reações do celular aparecendo no LED do Lek Trek | **Real** |
| Energia coletiva, missão, assistência, drop, encerramento | **Real** (regra simulada, cálculo no servidor) |
| Votos no ritmo e setlist da sessão | **Real** |
| Contagem de conectados/prontos, reconexão sem duplicar | **Real** |
| Câmera traseira/frontal, gravação, prévia e download | **Real** no navegador (sem upload) |
| Montagem do clipe vertical (~7 s) | **Real, local**: composto no aparelho com renders, dados da sessão e a gravação da pessoa, quando houver. É um clipe de demonstração, não a edição final |
| Card “Meu modo ON” (PNG) | **Real**, gerado no aparelho |
| Trilha do palco e prévias dos ritmos | **Sintetizadas no navegador** (Web Audio), originais; só tocam após um toque. Não há áudio na pasta de referências |
| Cadastro, termos e política | **Demonstrativos** |
| Registro em modo demonstração (sem câmera) | **Simulado** com renders, rotulado “Simulação”; nunca exibe REC |
| Palmas da sala, público simulado, rajadas | **Simulados** pelo apresentador |
| Falha no envio do vídeo | **Cenário demonstrativo** ligado no controle (não há upload real) |
| Destino “Ouvir Lek Tracks” | **A definir** (abre explicação) |
| Dashboard `/admin` | **Dados simulados** e determinísticos; indicadores reais da sala aparecem em bloco separado |

---

## Decisões de direção visual

- **Lek Trek fiel ao KV.** O repositório não traz o KV, logos ou fontes em arquivo separado; o personagem foi **recortado das pranchas atuais** (versões em fundo amarelo e no LED preto), sem alterar os originais. Nada de corpo translúcido, azul holográfico ou contorno neon.
- **Palco virtual em camadas**, construído em código: sala com nervuras neon (SVG), **BG curvo 16:9** em canvas (ondas, raios e mensagens curtas da prancha 06) e **LED oval** com moldura metálica, Lek Trek e cabine. A **fachada 9:16** fica numa visualização alternativa (controle → “Fachada 9:16”).
- **Movimento sem deformar o personagem:** o recorte não permite animar braços de forma convincente, então o Lek Trek fica íntegro e o loop vem de câmera sutil (drift + bounce no tempo do ritmo), luzes girando sobre os pratos, equalizador e faixa de LED da cabine, onda amarela, varredura do LED, nervuras pulsando e ondas do BG que respondem à energia e a cada lote de reações.
- **Renders do térreo não usados no palco**: mostram a versão holográfica azul, totens de celular e conteúdo “Crock Rock”, que foram descartados. O render externo (9A) aparece só na central, como referência do espaço.
- **Logo:** wordmark provisório em código (Sadia em Barlow Condensed + “ON” com o símbolo de power). Substituir pelo arquivo oficial na produção.
- **Tipografia:** Poppins (900 itálico nos momentos de marca; 400–800 em formulários e controles), servida localmente via `@fontsource` — sem dependência externa.
- “Vamos juntos pro drop” é **texto de apoio**; os emojis são os únicos botões de reação.

### Assets de execução (`public/img`)

Gerados a partir de `pranchas/` e `renders/` (originais preservados), em WebP otimizado:

| Arquivo | Origem | Uso |
| --- | --- | --- |
| `lek_led.webp` | Prancha 07 (LED), recorte sem emojis | LED oval do palco |
| `lek_up.webp`, `lek_point.webp` | Pranchas 01 e 06 (fundo amarelo), recortes com transparência | Boas-vindas, resultado, conclusão, fachada, card |
| `photo_pista/pov/selfie/drop.webp` | Prancha 08 | Fundo da live, modo demonstração, clipe |
| `render_fachada.webp` | Render 9A | Central `/` |

---

## Roteiro de apresentação (≈ 5 minutos)

**Antes:** computador ligado à TV, celular com câmera em mãos.

1. **Abrir o palco.** Em `/`, clique **Criar sessão ao vivo** → **Abrir palco** (arraste para a TV, “Tela cheia”). Fala: *“Esse é o espaço por dentro: o LED oval do Lek Trek e o BG curvo da pista.”*
2. **Mostrar o QR.** O palco está em Recepção, com o QR e os contadores. Na janela do computador, clique **Abrir controle**.
3. **Entrar pelo celular.** Escaneie o QR. Os contadores do palco e do controle sobem na hora.
4. **Fluxo inicial (≈ 40 s).** Começar → “Preencher com dados fictícios” → escolha o que te coloca no modo ON → ouça uma prévia e **vote no ritmo** → veja seu perfil → **Ativar câmera** (ou “Seguir sem câmera”) → “Tudo pronto”.
5. **Iniciar a pista.** No controle, **Iniciar a pista**: o palco revela o ritmo vencedor e abre a Pista ON.
6. **Reagir.** Toque nos emojis: cada um sobe nas laterais do LED do Lek Trek, a energia cresce no palco e no celular, o BG acelera. Use **Galera cheia** para simular a sala. Opcional: **Ativar som** no palco.
7. **Missão e drop.** **Iniciar missão do drop** → “Juntos pro drop”. No celular, **Gravar meu rolê** → Iniciar gravação → Virar câmera. Quando o palco sinalizar “Pista pronta pro drop!”, clique **Acionar o drop**: 3·2·1 → **MODO ON ATIVADO**.
8. **Encerrar e mostrar o registro.** **Encerrar e mostrar registro** → no celular, **Ver meu registro**: o clipe é montado no aparelho e fica pronto para baixar, junto com o card.

Sem outros aparelhos: use **`/demo`** (celular simulado + palco) e o explorador de telas C01–C18. Para mostrar exceções: ligue “Falha simulada no envio” (C18), “Simular queda de conexão” (C17) ou escolha “Câmera: simular negada” (C16).

---

## Validação executada

Rodada contra o **build de produção** (`npm run build && npm start`), com Chromium/Playwright em contextos de navegador separados:

- Jornada completa C01 → C15 em 2 celulares simultâneos, palco e controle em contextos distintos; energia idêntica nos três (ex.: 61% / 61% / 61%), sem erros de console.
- Reconexão com o mesmo identificador: 1 participante (sem duplicar); C17 aparece e some ao reconectar.
- Isolamento: reações na sessão A não alteram a sessão B; a chave da sessão B não controla a A; participante não executa comandos; `/controle` sem credencial é bloqueado.
- Limite de frequência: rajada de 10 toques instantâneos = 1 reação contabilizada.
- Acesso direto a todas as rotas (inclusive inexistentes) → 200 com a interface correta; `/health` ok.
- Câmera real com dispositivo virtual do Chromium: permissão não inicia gravação; REC só durante a captura; troca para frontal sem interromper; download local (MP4); clipe montado com a gravação; card PNG.
- Câmera negada → C16; participação sem câmera → registro coletivo.
- Participante tardio após o encerramento; sessão inexistente.
- Dashboard: Dia 1 = 480 / 420 / 14 / 390 e 260 + 130 + 20 + 10; percentuais 40/25/15/20 e 22/18/24/36; filtros por dia e sessão mantêm totais coerentes.
- Telas em 360×640, 390×664 (iPhone 13), 412 (Pixel 7) e desktop 1440/1920.
- 20 testes unitários da lógica coletiva (`npm test`).

**Não verificado neste ambiente** (fazer em aparelhos reais antes da apresentação):
- Câmera e gravação em iOS Safari e Android Chrome físicos (formato MP4/WebM varia por navegador; Safari antigo pode não montar o clipe — nesse caso aparece a prévia simulada com aviso).
- Saída de áudio do sintetizador (não há alto-falante no ambiente de teste; o código foi exercitado sem erros).
- Desempenho em TV/projetor de baixa potência e latência em rede de evento.

Procedimento sugerido: criar uma sessão no domínio HTTPS do Railway, abrir o palco numa TV, entrar com 3–5 celulares (iOS e Android), percorrer o roteiro acima e testar “Gravar meu rolê” com troca de câmera em cada aparelho.

---

## Estrutura

```
server/        Express + Socket.IO (index.ts, realtime.ts, session.ts — lógica pura e testável)
shared/        Configuração (energia, ritmos, perfis) e tipos compartilhados
src/
  components/  Marca, QR, moldura de celular, palco (stage/)
  participant/ Jornada mobile C01–C18, gravação, entrega
  pages/       Central, palco, controle, demo, admin
  lib/         Tempo real, câmera, clipe/card, áudio sintetizado, utilidades
  admin/       Gerador de dados simulados do dashboard
tests/         Testes da lógica coletiva
public/img/    Assets de execução otimizados
pranchas/ renders/ *.md   Materiais de referência (preservados)
```
