# Leitor Vocal PDF

Aplicação web local e gratuita para estudos com leitura de arquivos PDF em voz alta (Português do Brasil), grifo sincronizado em tempo real, visualização híbrida e controle de estudo.

---

## 🚀 Como Iniciar a Aplicação

Abra o terminal na pasta do projeto e execute:

```bash
npm run dev
```

Em seguida, acesse no Google Chrome:
👉 **http://localhost:5173/**

---

## 🎯 Principais Recursos

1. **Leitura em Voz Alta (pt-BR)**:
   - 100% gratuita, ilimitada e local através da Web Speech API do navegador.
   - Detecção automática de vozes em Português do Brasil com indicação visual:
     - 👩 Feminina (ex: *Google português do Brasil*, *Microsoft Francisca*)
     - 👨 Masculina (ex: *Microsoft Antonio*, *Daniel*)
   - Seletor de velocidade: `0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`.

2. **Visualização Híbrida**:
   - **Modo Leitura (E-Reader):** Tipografia ergonômica de livro com parágrafos limpos, temas visualmente confortáveis (Escuro, Sépia e Claro) e ajuste de tamanho de fonte (`A-` e `A+`).
   - **PDF Original:** Renderização idêntica ao documento original com camada de marca-texto realista sobreposta.

3. **Grifo Sincronizado Estável**:
   - Destaque tipo marca-texto em tempo real na frase/palavra sendo lida.
   - Rolagem inteligente sem tremores de tela (só desliza quando o texto atinge a borda da janela).

4. **Interatividade e Continuidade**:
   - **Clique para ouvir:** Clique em qualquer frase ou parágrafo para começar a leitura imediatamente a partir daquele ponto.
   - **Navegação de áudio:** Botões de retroceder e avançar frase a frase ou mudar de página.
   - **Histórico salvo no navegador:** Salva a última página, parágrafo e preferências de estudo automaticamente.
   - **Abrir PDFs:** Arraste e solte qualquer arquivo PDF na tela ou use o botão **"Abrir PDF"**.

---

## ⌨️ Atalhos de Teclado

| Tecla | Ação |
|---|---|
| <kbd>Espaço</kbd> | Iniciar / Pausar leitura |
| <kbd>→</kbd> | Próxima frase / parágrafo |
| <kbd>←</kbd> | Frase / parágrafo anterior |
| <kbd>↑</kbd> | Aumentar velocidade (+0.25x) |
| <kbd>↓</kbd> | Diminuir velocidade (-0.25x) |
