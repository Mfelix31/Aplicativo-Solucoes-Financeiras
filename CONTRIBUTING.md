# Como contribuir

Padrão de código e de trabalho do projeto. Vale para qualquer pessoa (ou assistente) que mexer no repositório. A estrutura está em [docs/ARQUITETURA.md](docs/ARQUITETURA.md); as regras financeiras, em [docs/CALCULOS.md](docs/CALCULOS.md).

## Fluxo de trabalho no Git

O `main` é o site no ar: tudo que entra nele é publicado pelo GitHub Pages.

1. **Crie uma branch a partir do `main` atualizado**, com nome curto e em minúsculas: `<tipo>/<assunto>`.
   - Tipos: `modulo/` (funcionalidade nova), `ajuste/` (melhoria ou correção), `docs/` (só documentação), `dados/` (tabelas e referências).
   - Exemplos: `ajuste/ajuda-sucessao`, `modulo/simulacao-e-se`, `dados/itcmd-2027`.
2. **Faça commits pequenos**, um assunto por commit, no formato `Área: o que mudou`, em português, no presente e sem ponto final.
   - Áreas: `Simulador`, `Planejamento`, `Aquisição`, `Sucessão`, `Início`, `Plataforma` (o que é comum a todas as páginas), `Dados`, `Docs`, `Testes`.
   - Exemplos: `Aquisição: reajuste do consórcio a cada 12 parcelas` · `Plataforma: botão de ajuda em todas as páginas`.
   - Se precisar explicar o porquê, deixe uma linha em branco e escreva no corpo.
3. **Rode `npm test`** antes de enviar. O GitHub roda de novo a cada envio; um X vermelho no commit significa teste quebrado.
4. **Leve ao `main` só depois da aprovação do responsável pelo projeto**, por pull request ou merge direto, com o `main` atualizado e os testes passando.
5. **Apague a branch depois do merge** (no GitHub: **Branches** → ícone de lixeira). Branches antigas abertas confundem e acumulam versões diferentes do mesmo código. Para pull requests, a opção *Settings → General → Automatically delete head branches* apaga a branch sozinha depois do merge.

Os commits "Ibovespa: fechamento de AAAA-MM-DD" são feitos pela automação diária e vão direto ao `main`.

## Padrão de código

### Geral

- **Sem dependências e sem build.** Não acrescente frameworks, bundlers ou bibliotecas sem uma necessidade concreta, discutida antes.
- **Português** em nomes de arquivos, funções, variáveis, comentários e textos. Termos técnicos consagrados podem ficar como estão (`id`, `canvas`, `api`).
- **Cada arquivo começa com um comentário** dizendo o que ele faz e onde é usado.
- Indentação de **2 espaços**, UTF-8, quebra de linha LF (o `.editorconfig` cuida disso nos editores).

### HTML (`<página>.html`)

- Só marcação e textos fixos. Nada de `<style>` nem `style="..."` com valores fixos: margens, cores e tamanhos vão para o CSS. A única exceção são variáveis CSS por item (`style="--accent: var(--gold);"`), que o script troca.
- Todo campo tem `id` único e um `<label for="...">`.
- Scripts no fim do `<body>`, na ordem descrita em [docs/ARQUITETURA.md](docs/ARQUITETURA.md#ordem-de-carregamento).

### CSS

- Cores **sempre pelos tokens** de `assets/base.css` (`--ink`, `--panel`, `--line`, `--red`…), para funcionar nos temas claro e escuro. Cor fixa só quando o fundo é sempre o mesmo (a faixa verde-escura da marca, por exemplo).
- Fonte Arial em todo o app. Textos com contraste mínimo de 4,5:1.
- O que é comum vai para `assets/`; o que é de uma página, para `paginas/<página>.css`.

### JavaScript

- `const` por padrão, `let` quando o valor muda; não use `var`.
- Ponto e vírgula no fim das instruções e aspas simples.
- **Regra de cálculo nunca na página:** taxa, imposto, parcela e afins ficam em `engine/`, em funções puras, com teste.
- Textos mostrados ao usuário ficam em `paginas/<página>.js`; textos de ajuda, em `paginas/<página>-ajuda.js`.
- Ao montar HTML com valores, escape o que vier de campo ou de arquivo (`Formato.esc`).
- Consultas externas tratam falha: mostram o valor de referência identificado ou um traço, nunca um número inventado.

### Testes

- Todo cálculo novo ou alterado ganha teste em `tests/<módulo>.test.js` com um **exemplo conferido de forma independente** (planilha, proposta real ou conta à parte), citando a origem no nome ou no comentário do teste.
- Inclua casos-limite: sem aporte, taxa zero, prazo curto, patrimônio insuficiente, inflação maior que a rentabilidade.
- Arquivos de exemplo (`tests/fixtures/`) sem dados pessoais.

## Checklist para mexer com segurança

- [ ] Branch criada a partir do `main` atualizado.
- [ ] `npm test` passando antes e depois da mudança.
- [ ] Campo novo: `id` no HTML → leitura em `paginas/<página>.js` → validação → motor → teste → texto de ajuda em `paginas/<página>-ajuda.js`.
- [ ] Regra de cálculo alterada no motor, com teste e com a convenção atualizada em [docs/CALCULOS.md](docs/CALCULOS.md).
- [ ] Testado nos temas claro e escuro e na largura de celular.
- [ ] Textos indicam que é simulação e não recomendação.
- [ ] Nenhum dado pessoal (nome, CPF, data de nascimento, contato) no código, nos testes ou nos exemplos.
- [ ] Documentação atualizada quando a estrutura ou uma regra mudou.

## O que os testes cobrem

| Arquivo | Confere |
|---|---|
| `paginas.test.js` | Arquivos referenciados existem; `id`s usados no JavaScript existem e não se repetem; sintaxe dos scripts; nenhum estilo fixo em linha; valores de referência iguais aos padrões dos simuladores. |
| `ajuda.test.js` | Cada texto de ajuda aponta para um campo, etapa ou título que existe; ordem de carregamento da ajuda; textos escapados. |
| `investimentos.test.js` | Motor do Simulador: feriados e dias úteis (ANBIMA), IR e IOF nas mudanças de faixa, LCA, RDC, Compromissada, aportes, poupança, CDB, Tesouro Selic e casos-limite, conferidos em Python com data fixa. |
| `planejamento.test.js` | Motor do Planejamento, conferido com a planilha do usuário e com os cenários de Planejamento do Stress Test MT (testes 4, 6 e 10). |
| `aquisicao.test.js`, `propostas.test.js` | Motor da Aquisição e leitura dos PDFs, conferidos com as propostas do Sicoob. |
| `sucessao.test.js`, `sucessao-robustez.test.js` | Motor do Sucessório (ITCMD por estado, partilha, whole life, recomendação) e casos aleatórios (sem erro, sempre uma solução). |
| `ibovespa.test.js` | Leitura e validação dos dados da B3. |
