# Leitor de PDF com Leitura em Voz Alta (pt-BR) e Grifo Sincronizado

## Goal
Construir uma aplicação web local de estudos para leitura de PDFs com voz sintetizada em português do Brasil (gratuita e ilimitada via Web Speech API), visualização híbrida (PDF Original + Modo Leitura Confortável), grifo dinâmico em tempo real, controle de velocidade e vozes (feminina/masculina), e histórico de progresso de leitura salvo no navegador.

## Tasks
- [x] Task 1: Estruturar o projeto web moderno (HTML5, CSS3, Vanilla JS modular, PDF.js) → Verify: Servidor de desenvolvimento inicializa sem erros e carrega a interface.
- [x] Task 2: Desenvolver o motor de carregamento de PDF com PDF.js com suporte ao PDF de exemplo (`pdf_base/`) e upload de novos arquivos via drag-and-drop → Verify: PDF de exemplo carrega e extrai páginas com sucesso.
- [x] Task 3: Implementar a interface híbrida de visualização:
  - Visualizador do PDF Original com renderização em Canvas e camada de texto selecionável
  - Modo Leitura ("Reader Mode") ergonômico com temas Claro, Sépia e Escuro, tamanho de fonte ajustável
  - Painel lateral com navegação de páginas e status de leitura → Verify: Alternância suave entre os modos e navegação entre páginas.
- [x] Task 4: Implementar o motor de síntese de voz (TTS Web Speech API):
  - Detecção e categorização de vozes em Português do Brasil (Feminina / Masculina)
  - Sincronização de fala e grifo em tempo real via evento `onboundary` (destaque visual tipo karaokê/leitura guiada)
  - Controles de reprodução: Play, Pause, Parar, Próximo/Anterior parágrafo, seletor de velocidade (0.5x a 2.5x)
  - Leitura por clique direto em qualquer parágrafo ou frase do documento → Verify: Áudio sintetizado em pt-BR toca e grifa o texto sincronizadamente.
- [x] Task 5: Implementar histórico e persistência de progresso (LocalStorage):
  - Memorização da última página e parágrafo lidos
  - Memorização de preferências (voz escolhida, velocidade, tema visual)
  - Indicador visual das páginas já concluídas/lidas → Verify: Recarregar a página restaura o progresso e as configurações anteriores.
- [x] Task 6: Testar e validar a experiência de uso com o arquivo `Caderno de curso - Fotografia Institucional.pdf` no navegador → Verify: Execução fluida sem travamentos, áudio claro e grifo preciso.

## Done When
- [x] O usuário consegue abrir o PDF de exemplo ou arrastar qualquer outro PDF.
- [x] O texto é lido em voz alta com sintetizador em pt-BR (opção de voz feminina/masculina) de forma 100% gratuita.
- [x] O texto é grifado em tempo real acompanhando a fala.
- [x] É possível alternar entre Modo Original e Modo Leitura (Reader Mode com temas claro/sépia/escuro).
- [x] O usuário pode clicar em qualquer frase/parágrafo para ouvir a partir dali.
- [x] A velocidade pode ser ajustada e o progresso é salvo automaticamente.
