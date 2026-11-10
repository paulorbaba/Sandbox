# Sadia ON — Lek Trek LIVE

Pacote visual final para apresentação e referência de protótipo navegável.
As pranchas são imagens estáticas; os componentes e textos deverão ser reconstruídos como elementos editáveis no protótipo. Renders são simulações conceituais do espaço.

## Organização

01 — Cadastro e pesquisa: boas-vindas, cadastro, motivação e voto no ritmo.
02 — Resultado e preparação: perfil, câmera opcional, espera e entrada na pista.
03 — Interação e gravação: reações, registro do DJ, troca de câmera e selfie.
04 — Encerramento e exceções: conclusão, processamento, entrega e recuperação.
05 — Dashboard administrativo desktop: dados exclusivamente simulados.
06 — Conteúdos da fachada 9:16 e do BG curvo 16:9.
07 — Feedback das reações no LED oval do Lek Trek.
08 — Atmosfera, POV, selfie e drop.

## Mapa de navegação

IDs abaixo correspondem às telas da esquerda para a direita; na prancha 04, ler primeiro a linha superior.

| ID | Tela | Ação e destino |
|---|---|---|
| C01 | Boas-vindas | Começar → C02 |
| C02 | Cadastro | Continuar → C03; campos inválidos recebem mensagem junto ao campo |
| C03 | Motivação | Selecionar uma resposta e continuar → C04 |
| C04 | Ritmo | Ouvir prévia sem alterar voto; selecionar uma opção e confirmar → C05 |
| C05 | Resultado | Continuar → C06 |
| C06 | Câmera opcional | Ativar câmera → permissão do navegador → C07; seguir sem câmera → C07; negativa → C16 |
| C07 | Espera | Chamada da sessão → C08 |
| C08 | Live | Tocar emoji envia reação; início da dinâmica → C09 |
| C09 | Energia coletiva | Reações aumentam o indicador da sessão; convite explícito para gravar → C10 |
| C10 | Registro do DJ | Início de gravação mediante ação do participante; após primeiro trecho → C11 |
| C11 | Troca de câmera | Virar câmera → C12; continuar com DJ mantém câmera traseira |
| C12 | Selfie | Fim da captura → envio; encerramento da sessão → C13 |
| C13 | Conclusão | Ver meu registro → C14 se processando ou C15 se pronto |
| C14 | Processamento | Quando pronto → C15; manter link de retorno para quem sair da página |
| C15 | Clipe pronto | Baixar clipe; ouvir Lek Tracks abre destino da playlist a definir |
| C16 | Sem câmera | Entrar na live → C07/C08 conforme sessão; tentar ativar câmera → permissão |
| C17 | Reconexão | Recuperar conexão e estado atual da sessão; evitar reenvio duplicado de reações |
| C18 | Falha no vídeo pessoal | Ver registro coletivo → versão coletiva de C15; tentar enviar novamente → C14 |

## Regras para o protótipo

- Cadastro: separar aceite de participação e comunicações opcionais. Marketing desmarcado inicialmente. Mostrar política de privacidade e mensagens de validação legíveis. Conteúdo final dos termos depende da operação.
- Pesquisa: uma resposta por pergunta. O perfil é uma devolutiva da motivação; a regra de associação das quatro respostas aos perfis precisa ser definida antes da implementação. O voto no ritmo é uma escolha separada.
- Câmera: nunca iniciar gravação automaticamente ao conceder acesso. Acrescentar o botão “Gravar meu rolê” e controle de encerramento na implementação. A troca para selfie é opcional. Quem não grava permanece na dinâmica de reações.
- Interface de live: “Vamos juntos pro drop” é uma orientação, não um segundo botão; renderizar como texto de apoio no protótipo. Os emojis são os controles de reação.
- Os percentuais nas pranchas representam momentos ilustrativos distintos. Na implementação, mobile, fachada, BG e LED oval devem refletir o mesmo estado da sessão.
- Feedback: confirmar o toque no próprio celular; fazer o emoji surgir nas laterais do LED oval, subir e desaparecer. Preservar rosto, mãos e mesa do DJ. Agrupar reações simultâneas para evitar excesso visual.
- LED oval: personagem opaco em 3D, com materiais e cores do KV; sem aparência holográfica azul ou neon. Emojis são parte do conteúdo da tela.
- BG curvo: conteúdo horizontal 16:9, com mensagens curtas e ondas de energia. LED de fachada: conteúdo vertical 9:16. Aplicação final depende do mapa de pixels dos fornecedores.
- Acesso à câmera e conexão: prever participação sem câmera, reconexão, processamento, nova tentativa de envio e registro coletivo como alternativa.
- Operação: a autorização de câmera não autoriza uso promocional de imagem. Detalhar autorização de imagem, destino e retenção dos vídeos no fluxo de produção.
- Acessibilidade: controles com rótulos, foco visível, contraste, áreas de toque confortáveis e opção de reduzir movimento. Não depender exclusivamente da cor para comunicar estado.

## Dashboard

Visão exclusiva da equipe administrativa, em desktop. Valores simulados: 480 cadastros, 420 participantes, 14 sessões concluídas e 390 clipes entregues. Entregues = 260 com POV + 130 coletivos. Outros 20 estão em processamento e 10 com falha de entrega.

Motivação e ritmo vêm da pesquisa de entrada. Participação, conclusão e entrega vêm dos eventos operacionais. Definir a base e período de cada indicador, deduplicação por participante e distinção entre clipe pronto, entregue e baixado antes de conectar dados reais.

## Uso na apresentação

Inserir os PNGs preservando a proporção, sem esticar. As pranchas têm proporções próprias para privilegiar legibilidade; usar ajuste à área do slide. QR é placeholder. Renders e interface ilustram a proposta e não substituem desenho executivo, arquivos finais de LED ou UI editável.
