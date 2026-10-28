# Inteligência Financeira

Plataforma estática (HTML/CSS/JS, sem build) com três módulos:

| Página | O que faz |
|---|---|
| `index.html` | Página inicial com acesso aos três módulos |
| `investimentos.html` | Simulador e comparador de LCA, RDC e Operação Compromissada |
| `planejamento.html` | Planejamento financeiro: patrimônio necessário, cenários, objetivos de vida e PDF |
| `aquisicao.html` | Estratégia de Aquisição: consórcio × financiamento × capital próprio, com a renda do capital pagando a parcela |
| `sucessao.html` | Planejamento Sucessório: inventário × previdência × whole life × doação com usufruto × holding × offshore, nos 27 estados, com bens em mais de um estado |

## Estrutura

Cada página tem três partes, cada uma no seu lugar:

| Onde | O que fica ali |
|---|---|
| `<página>.html` | Só a marcação (campos, seções, textos fixos). Sem estilos em linha. |
| `paginas/<página>.css` | Estilos próprios da página. |
| `paginas/<página>.js` | Lógica da página: lê os campos, chama o motor e desenha os resultados. |

Compartilhado entre as páginas:

- `assets/base.css` — paleta da marca (tema claro e escuro) e regras globais.
- `assets/componentes.css` — etapas, painéis, campos, indicadores, gráfico e avisos (Planejamento e Aquisição).
- `assets/tema.js` — tema claro (padrão) / escuro, lembrado entre as páginas, e o botão de troca.
- `assets/formato.js` — moeda, porcentagem, prazos e máscara de valores.
- `assets/grafico.js` — gráfico de linhas em canvas com tooltip.
- `assets/bcb.js` — consultas ao Banco Central: Meta Selic (SGS 432), IPCA 12 meses (SGS 13522) e Boletim Focus.

Motores de cálculo (funções puras, sem tela, testadas):

- `engine/planejamento.js` — planejamento financeiro.
- `engine/aquisicao.js` — estratégia de aquisição (financiamento no padrão Sicoob, consórcio, IR no resgate).
- `engine/sucessao.js` — planejamento sucessório (custo do inventário, previdência e whole life dimensionados para pagá-lo, doação, holding, aluguel PF × holding, recomendação).
- `dados/tabuas-br-ems.js` — tábuas de mortalidade BR-EMSmt da SUSEP (v.2021 e v.2026, por sexo), para o preço do whole life por idade.
- `dados/itcmd-uf.js` — tabelas de ITCMD dos 27 estados (vigente, adequação à LC 227/2026 e estresse de 16%), base da nua-propriedade por estado e honorários de referência.
- `engine/propostas.js` — leitura das simulações do Sicoob em PDF.

Ordem de carregamento em cada página: `assets/tema.js` → `assets/base.css` → (`assets/componentes.css`) → `paginas/<página>.css` → … → `assets/*.js` → `engine/*.js` → `paginas/<página>.js`.

## Como mexer com segurança

1. **Antes e depois de qualquer mudança, rode os testes:** `npm test` (ou `node --test tests/*.test.js`, Node 18+). Eles também rodam sozinhos no GitHub a cada envio.
2. **Regra de cálculo** (taxa, imposto, parcela) muda no motor (`engine/`), nunca na página. Acrescente um teste em `tests/` com um exemplo conferido (proposta real, planilha ou conta independente).
3. **Campo novo:** crie o elemento com um `id` no HTML → leia o campo em `paginas/<página>.js` (seção "Entradas") → valide → passe ao motor → teste. O teste de estrutura avisa se algum `id` usado no JavaScript não existir no HTML.
4. **Cor ou espaçamento:** use os tokens de `assets/base.css` (`--ink`, `--line`, `--red`…). Não escreva cores fixas nem `style="..."` no HTML.
5. **Textos ao usuário** ficam na página (`paginas/<página>.js`). Sempre indicar que é simulação e não recomendação.
6. **Dados pessoais:** o app não coleta, não guarda e não envia dados pessoais. Não acrescente nome, CPF, data de nascimento ou contato, nem em arquivos de teste.

O que os testes cobrem: cálculos dos motores (conferidos com a planilha e com as propostas do Sicoob), leitura dos PDFs, e a estrutura das páginas (arquivos referenciados existem, `id`s usados existem e não se repetem, sintaxe de todos os scripts, ausência de estilos em linha).

## Convenções de cálculo

- **Investimentos:** rendimento em dias úteis, base 252, com feriados nacionais; IR e IOF por dias corridos. LCA com prazo mínimo de 6 meses (Res. CMN 5.215/2025). CDI constante ou projetado por ano (Boletim Focus, API do BCB, editável). Comparativo com poupança (0,5% a.m. + TR), CDB e Tesouro Selic (custódia B3 0,20% a.a. acima de R$ 10 mil).
- **Sucessão:** base anual; custo esperado do inventário de 18% do que vai a inventário (média observada em MT e MS, premissa do usuário), usado na comparação dos caminhos e pago só por previdência (líquida de IR) e/ou whole life (capital IPCA + 2,5%, planilha Sicoob); recomenda, entre os caminhos que cobrem a meta desde o 1º ano, o que mais entrega à família na expectativa de vida (IBGE 2024), com empate abaixo de 3% favorecendo o mais simples.
  - Meta = 18% + despesas da família durante o inventário (meses padrão: 3 em cartório, 24 judicial, 36 com conflito).
  - Partilha pelo regime de bens (meação, cônjuge herdeiro pelo art. 1.829 do Código Civil, mínimo de 1/4 do art. 1.832); ITCMD por quinhão; legítima e parte disponível.
  - Whole life por idade e sexo: a parcela da proposta Sicoob (homem, 48 anos) é escalada por um fator atuarial pela tábua de seguros da SUSEP, BR-EMSmt v.2026 (ou v.2021), em `dados/tabuas-br-ems.js`, com juros técnicos implícitos na proposta.
  - Testa todas as combinações de estrutura (nada, doação com usufruto, holding gradual, holding total) com liquidez (nada, previdência, whole life, previdência + whole life), e offshore quando houver bens no exterior.
  - Quem paga cada custo, nesta ordem: sobra mensal → rendimentos das aplicações → principal → à parte. O dinheiro de fora cresce pela rentabilidade e é descontado do valor à família.
  - Sempre há uma solução: (1) protege e cabe no orçamento; (2) protege com pagamento à parte até o limite da renda (padrão 30%); (3) protege pedindo o menor valor de fora; (4) maior cobertura.
  - Painel da solução: componentes, valor à família, por que, como pagar, passo a passo e alternativas. `tests/sucessao-robustez.test.js` roda casos aleatórios (sem erro, números válidos, sempre uma solução).
  - Sucessão do casal: com meação, o 2º inventário (do cônjuge, sobre a meação) entra no valor que chega à família; doação e holding evitam os dois para os bens transferidos.
  - Doações feitas hoje pagam ITCMD pela lei vigente; os regimes de reforma e estresse valem só para a herança e as doações futuras.
  - Simulação pode ser salva e reaberta em arquivo `.json` (só os campos da tela, sem dados pessoais).
  - Patrimônio por tipo (imóvel urbano, terreno, fazenda, veículo), cada um com estado, quantidade e valor. ITCMD dos imóveis no estado onde ficam; móveis, cotas, veículos e exterior no domicílio (CF, art. 155, § 1º). Veículos depreciam e ficam fora da holding e da doação.
  - Tabelas de ITCMD: `dados/itcmd-uf.js`, com `revisadoEm` por estado. No início de cada trimestre o GitHub abre uma issue de revisão (`.github/workflows/revisao-dados.yml`, que roda `scripts/verificar-dados.js`); a página alerta quando a revisão passa de 6 meses.
- **Aquisição:** base mensal; o capital rende e paga a parcela; patrimônio líquido = capital + bem − saldo devedor; bem valoriza pelo IPCA. Financiamento no padrão da proposta Sicoob (TR projetada, juros nominais ÷ 12, MIP por idade, DFI, TAC). Consórcio no padrão da simulação de lance Sicoob (nº de parcelas, lance em % ou parcelas abatendo antes da parcela da assembleia, seguro proporcional à parcela). IR de produtos tributados cobrado no resgate, sobre o ganho. Simulações do Sicoob em PDF podem preencher os campos (opcional).
- **Planejamento:** base de 360 dias (12 meses de 30), capitalização mensal com taxa equivalente; valores antes de IR. Outras rendas (INSS, aluguel, previdência) são descontadas da renda desejada antes de calcular o patrimônio necessário.

Simulador educativo: nenhum dado é coletado ou enviado; todo o processamento acontece no navegador.
