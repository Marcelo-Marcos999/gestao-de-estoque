# Domínio — registros de quebra

Anotações do que o sistema precisa fazer, em construção. Serve para a
especificação de cada tela não precisar repetir o contexto.

## O que o sistema gere

A função principal é **validade**, mas o alcance é **quebra de estoque**: tudo
que sai do estoque sem ser vendido — vencido, danificado, e o que mais vier.

Vencido e danificado são a mesma coisa com causa diferente: os dois têm
produto, quantidade, data da ocorrência, quem registrou e o que aconteceu com o
item depois. Por isso o motivo é um **campo do registro**, não um tipo separado
de registro. Modelar "validade" como única forma de perda obrigaria a remendar
cada motivo novo.

## O cadastro de produtos é consultado, não duplicado

Todo registro de quebra aponta para um produto do cadastro. Só o administrador
o alimenta (ver CLAUDE.md, "Perfis de acesso") — e o motivo é mais forte do que
padronização visual: sem esse controle, "TINTA ACR FOSCA 18L", "tinta acrilica
fosca 18 litros" e "TA FOSCA 18L" viram três produtos, e o relatório passa a
mentir, porque a mesma perda aparece dividida em três.

**O operador não tem a tela do cadastro no menu.** Para ele aquilo seria um beco
sem saída: encontra o produto e não há nada a fazer ali. A busca de produto vive
**dentro do registro de quebra**, no momento em que ele precisa dela — lê o
código, o sistema mostra o produto, ele confirma e segue.

A tela continua existindo para o administrador, que é quem trabalha nela:
importar, corrigir, resolver pendências.

### Produto que ainda não existe no cadastro

O operador está no corredor com o produto na mão. Se ele não estiver no
cadastro, **o registro não pode ser bloqueado** — a perda aconteceu de qualquer
jeito, e mandar a pessoa procurar o administrador antes de registrar garante
que o registro não vai existir.

Então o registro é salvo com o produto marcado como **pendente de cadastro**, e
o operador preenche o resto do formulário normalmente.

O que fica pendente depende do que ele tinha em mãos:

| O operador tinha | Fica pendente |
|---|---|
| Código de barras (leu pela câmera) | SKU e descrição |
| SKU (leu da etiqueta de gôndola) | Código de barras |

Resolver a pendência é trabalho do administrador, no cadastro de produtos.

## Etiqueta escolhida × etiqueta calculada

Duas coisas diferentes aparecem como "tag" na tela, e vale não confundi-las:

| Tipo | Exemplos | Quem define |
|---|---|---|
| **Escolhida** (motivo, origem) | vencido, danificado, veio do CD | o usuário, no registro |
| **Calculada** (situação) | próximo do vencimento, chance de vender antes | a conta de dias, sozinha |

"Vencido" aparece nos dois papéis, e tudo bem: como *motivo* é a razão de eu
estar apontando a perda; como *situação* é o que a data diz hoje. A diferença
que importa é que a situação **muda sozinha com o passar dos dias** e não pode
ser editada — editá-la seria mentir para o próprio sistema.

## Como um registro é classificado

Dois eixos separados, não uma lista única de etiquetas:

| Campo | O que responde | Exemplos |
|---|---|---|
| **Motivo** (obrigatório) | por que virou perda | vencido, danificado, avaria |
| **Origem** (opcional) | de onde veio o problema | chegou assim do CD, aconteceu na loja, fornecedor |

Um item pode ser *danificado* **e** ter chegado *assim do CD*: são coisas
diferentes. Numa lista só, as opções cresceriam por combinação ("danificado",
"danificado do CD", "vencido do CD"…) e os relatórios não separariam mais.

Separar importa por dinheiro: "quanto perdemos por avaria" é uma pergunta,
"quanto disso veio do CD" é outra — e a segunda é a que dá base para cobrar o
centro de distribuição.

## O que identifica um registro

**Produto + validade + motivo.**

A validade é o que distingue de verdade: duas unidades do mesmo produto com
validades diferentes são coisas diferentes — uma ainda se vende, a outra não.
A origem é atributo do registro, não parte da identidade.

## Registro repetido do mesmo item

Ao iniciar um registro, se já existe outro com **o mesmo produto, a mesma
validade e o mesmo motivo**, o usuário é avisado — não impedido. O aviso existe
para ele decidir: somar ao registro existente ou criar outro.

A chave importa mais do que parece. Avisando só por produto, o aviso dispararia
o tempo todo — e aviso que aparece sempre vira aviso que ninguém lê. Em poucas
semanas o operador dispensaria por hábito, inclusive quando fosse duplicidade
real.

Repetição continua legítima e esperada, e não só por motivo diferente: o mesmo
produto, com o mesmo motivo, pode voltar a acontecer. A loja recebe mercadoria
vencida e anexa o e-mail daquela divergência; semanas depois o mesmo material
chega vencido de novo, com outro e-mail. São **duas ocorrências**, cada uma com
seu documento — juntar as duas num registro só perderia a prova de cada uma.

Por isso o aviso é informativo: ele mostra o que já existe para a pessoa
**entender** se aquilo é a mesma ocorrência ou outra.

## Anexos

Um registro guarda:

- **Foto** do produto e da etiqueta do lote, como no app anterior.
- **Documento da ocorrência** — o e-mail da divergência com o CD, por exemplo.
  É a prova que sustenta a cobrança, e é por ocorrência, não por produto.

**Nenhum é obrigatório.** A interface sugere e deixa claro que o registro fica
incompleto sem eles, mas permite salvar. Registro incompleto é melhor que
registro que não acontece porque o celular ficou sem bateria no corredor — e o
que falta pode ser anexado depois.

## De onde vêm saldo e saídas

Três fontes, para os mesmos dois números:

| Dado | Como chega |
|---|---|
| **Estoque** (saldo) | importação da planilha na tela de Estoque, ou digitado |
| **Saídas** | mesma importação, ou de um segundo arquivo, ou digitado |
| **Valor de custo e de venda** | mesma importação, ou digitados |

A importação vive na **tela de Estoque**, aberta aos dois perfis: saldo, saídas
e valores não são a bancada do administrador, que é o cadastro de produtos. Ela
casa a planilha com o cadastro pelo **SKU**, e cada coluna é opcional — uma
importação pode trazer só saldo e saídas, e o que não veio fica como estava em
vez de zerar. O usuário trata o arquivo antes se precisar.

Os quatro campos continuam editáveis à mão, ali e no diálogo de lote das
Validades: o número importado é ponto de partida, não verdade intocável.

### Quanto vale o estoque

Cada produto mostra **total de custo** e **total de venda** — saldo × valor de
custo e saldo × valor de venda. É conta pura, nunca guardada: guardar o
resultado deixaria a tela mentindo assim que alguém corrigisse o saldo ou o
valor unitário sem lembrar de recalcular, o mesmo raciocínio da situação de
validade (calculada, nunca digitada).

A tela de Estoque também soma os dois totais de tudo que está na lista **com
os filtros aplicados** — um resumo no topo, não a base inteira — para responder
"quanto vale meu estoque hoje" sem precisar somar linha por linha. A exportação
leva as duas colunas junto.

### SKU que a importação não reconhece

Não bloqueia. O produto entra no cadastro como **pendente**, com os números da
planilha e sem descrição nem código de barras — mesma decisão do registro de
quebra, e pelo mesmo motivo: recusar a linha perderia o dado, porque a
importação costuma ser a única fonte desses números.

Resolver a pendência é do administrador, no cadastro de produtos, que mostra o
selo "pendente" e tem o filtro "só pendentes" para a fila não ficar invisível.

Saldo zerado é o que diz que o item **saiu do estoque** — é assim que a tela de
quebra sabe o que ainda está lá e o que não está.

## Previsão: quanto tempo até zerar

O cálculo que sustenta as situações da tela de validades:

```
média de saída por dia = saídas ÷ período
dias para zerar        = estoque ÷ média de saída por dia
```

O **período** é configurado pelo usuário — é a janela de dias que o relatório
de saídas cobre. Sem saídas no período não há divisão possível, e o produto
fica **sem estimativa** em vez de receber um número inventado.

Conferido contra os números do app anterior: `estoque × período ÷ saídas`
reproduz as linhas (estoque 1, saídas 2, período 390 → 195 dias; estoque 1,
saídas 50 → 7 dias).

### As quatro situações saem daí

| Situação | Quando |
|---|---|
| **Venceu** | a data de validade já passou |
| **Possibilidade de vencimento** | dias para zerar **maior** que os dias até vencer — não vai vender a tempo |
| **Chance de vender antes de vencer** | dias para zerar **menor ou igual** aos dias até vencer |
| **Sem estimativa** | não há saídas no período, ou falta a data de validade |

Situação é **calculada, nunca digitada**. Guardar o resultado deixaria a tela
mentindo no dia seguinte, quando o produto já teria mudado de faixa sem
ninguém mexer nele.

## Um saldo só, para as duas telas

Não existe "estoque de quebra" separado do estoque da loja. Saldo e saídas são
**do produto**, e as duas telas leem os mesmos números.

Consequência: quando a importação traz o saldo daquele produto zerado, o item
apontado como vencido ou danificado também deixa de estar no estoque — mesmo
estando em outra tela. Não é preciso dar baixa nos dois lugares, e não há como
as telas discordarem entre si.

A tela de validades muda a **situação** do produto; ela não mexe no saldo.

### Quando o saldo zera

A quantidade do registro **zera junto**, e o usuário **exclui o registro**. A
tela mostra o que existe agora; item que saiu não fica ocupando espaço.

O sistema **não guarda histórico de perdas**. Foi decisão consciente: o controle
do que aconteceu vem das etiquetas do registro enquanto ele existe, e o que
interessa é o presente do estoque, não o acumulado do mês.

Consequência prática, para não ser descoberta depois: relatório do tipo "quanto
perdemos por avaria em março" não é possível sem mudar esse desenho. Se um dia
for preciso, basta parar de excluir e passar a arquivar.

A exclusão é destrutiva e imediata, então a interface oferece **desfazer** logo
depois — melhor que perguntar "tem certeza?" antes de toda exclusão, que vira
clique automático em uma semana.

## A tela de quebra

Para onde os itens são baixados depois de apontados. Ali o usuário administra
o que ainda está no estoque e o que já não está — e essa separação sai do saldo
do produto, não de um controle paralelo.

A lista aceita itens repetidos do mesmo produto, por causa dos motivos e das
validades diferentes.

Da largura de tablet para cima a lista é uma **tabela**, na mesma grade da tela
de validades: as duas mostram registros de produto, e encontrar uma coluna no
mesmo lugar nas duas vale mais que cada tela ter o desenho ideal para si. Abaixo
de 720px nenhuma tabela cabe e a lista vira cartão — o mesmo corte da tela de
validades.

No cartão do celular o registro inteiro abre a edição, e os botões de editar e
excluir não aparecem nele. Não é economia de enfeite: um motivo comprido já ocupa a largura
toda dos chips, e os botões numa linha própria custavam 52px por registro — de
199px de cartão para 144px, quase um registro a mais por tela. A exclusão
continua acessível pela seleção, que serve melhor quando é mais de um. Da
largura de tablet para cima, onde há espaço, os botões voltam.

Cada registro pode ser **editado** — o apontamento é feito no corredor, com o
material na mão, e errar a quantidade ou o motivo ali é normal. Como não há
histórico de perdas por decisão (ver acima), a correção é o próprio registro: o
que está gravado é o que vale.

A exclusão também acontece **em grupo**: marcando os registros e excluindo de
uma vez. É o caso da conferência que zera vários itens no mesmo dia, em que
excluir um a um seria trabalho repetido sem decisão nova a cada clique. O
desfazer vale para o grupo inteiro, e trocar de filtro limpa a seleção — marcar
numa aba e excluir em outra apagaria o que a pessoa não está vendo.

A separação vira três abas — **no estoque**, **zerados** e **todos** — e a tela
abre em "no estoque". Um registro que zerou já não é trabalho pendente: deixá-lo
à vista faria a lista crescer com o que não exige decisão de ninguém. Continua a
um toque de distância, porque é ali que o usuário confere o que pode excluir.

### Registrar quebra cria o lote

Apontar a perda de um lote é dizer que aquele lote existe na loja. Por isso
registrar uma quebra **com validade** cria o lote correspondente no
acompanhamento, se ele ainda não existir — e editar a validade de um registro
cria o lote novo também.

Sem isso o produto apontado como vencido não aparecia na tela de validades, e
era justamente lá que se ia conferir o saldo dele. As duas telas passam a
concordar sobre o que está sendo acompanhado.

Sem data não há lote: um lote é produto **mais** validade, e sem ela não há o
que acompanhar.

### Editar o lote na tela de validades

Cada lote pode ser corrigido. A **validade** é do lote. **Saldo e saídas** são
do produto — o mesmo número que a tela de quebra usa para saber se o item ainda
está no estoque — e mudam para todos os lotes daquele produto; o diálogo diz
isso em vez de deixar a pessoa descobrir depois.

Eles são editáveis à mão porque nem sempre o relatório bate com a prateleira, e
porque quem encontra a caixa no corredor é quem vê a diferença — mandá-lo até a
tela de Estoque para corrigir faria o número continuar errado. Zerar o saldo por
ali é o caminho para conferir o que a quebra faz quando
o item sai do estoque: a quantidade do registro zera junto e ele passa para a
aba "zerados".

Limpar a data é uma edição válida: o lote cai em "sem estimativa" e sai da
previsão. O diálogo diz isso antes de salvar, em vez de deixar o item sumir da
faixa em que estava sem explicação.

**Os dois perfis editam.** Não é cadastro de produto, que é a bancada do
administrador: a validade é o dado operacional que o app existe para
acompanhar, e quem encontra a caixa no corredor é quem sabe a data. O que
continua sob o administrador é a base de produtos.

Excluir o lote também é possível, com desfazer e sem confirmação antes — mesma
regra da quebra. O produto continua no cadastro; o que sai é o acompanhamento
daquela data.

### Ler o código de barras

Toda busca de produto — validades, cadastro, quebra e o registro por dentro —
aceita o código lido pela câmera, não só o digitado. No corredor a etiqueta
está na mão e o teclado do celular não.

O botão **não existe onde o aparelho não lê**. A leitura usa o `BarcodeDetector`
do próprio navegador, que o Safari não implementa: no iPhone o botão some e a
digitação continua sendo o caminho. Oferecer uma ação que falha no clique é
pior que não oferecer (ver CLAUDE.md).

A troca foi consciente: uma biblioteca de decodificação funcionaria em todo
aparelho, mas custaria centenas de kilobytes de WebAssembly que a maioria
nunca usaria. Se o iPhone precisar ler, é o módulo `shared/lib/barcode.ts` que
muda — as telas conversam com ele, não com a API do navegador.

Dentro do registro de quebra, o código lido **escolhe o produto sozinho**
quando casa com um só: quem apontou a câmera para a etiqueta já disse qual
produto é, e confirmar o único resultado seria pedir a mesma resposta duas
vezes. Com mais de um casamento, ou nenhum, a lista aparece.

### Anexos

Três espaços por registro: **foto do produto**, **foto da etiqueta** e
**documento**. Cada um aceita um arquivo — escolher de novo troca o que estava
lá, em vez de empilhar duas fotos que ninguém saberia distinguir depois.

Na lista eles aparecem como **um ícone por tipo**, e não como um contador:
"3 anexos" não diz se o que falta é a foto da etiqueta ou o e-mail da
divergência, que é justamente a pergunta de quem confere. Clicar abre o
arquivo; imagem aparece na hora, documento se apresenta e oferece o download —
um PDF embutido num diálogo pequeno é pior que o leitor do próprio aparelho.

Nenhum é obrigatório, nem no motivo mais grave (ver acima).

### Ver mais registros de uma vez

No **celular quem rola é a página inteira**: o cabeçalho sai da tela junto com o
resto e devolve a altura para a lista. As listas continuam virtualizadas, agora
ancoradas nessa rolagem — sem isso o cadastro desenharia 26 mil linhas de uma
vez. Uma lista rolando dentro de si numa tela que não rola era o pior dos dois
mundos: o cabeçalho comia metade da altura e a lista ficava espremida no resto.

No **computador** é o contrário: a lista rola dentro de si, com o cabeçalho das
colunas parado no topo, que é o que se espera de uma tabela. E aí, sim, as duas
alavancas abaixo fazem sentido — nenhuma delas é a tela cheia do navegador, que
o F11 já faz e que esconde a moldura errada.

A **barra lateral recolhe** à coluna dos ícones, devolvendo 192px de largura.
E um **botão de foco** esconde o cabeçalho da página e os cartões de situação:
a lista passa de 543 para 758px de altura, de cinco para doze lotes visíveis.
O botão **não existe no celular** — lá a rolagem da página já resolve, e
esconder à força o título e as ações tiraria referência de quem tem menos tela
para se localizar.

Duas regras que o modo foco não pode quebrar. As ações do cabeçalho **migram
para a barra de busca** em vez de sumirem — registrar é o que se vem fazer na
tela de quebra, e escondê-lo transformaria o modo num beco. E o filtro que os
cartões aplicam **continua visível** na faixa abaixo, com o botão de limpar,
porque uma lista filtrada que parece a lista inteira engana (ver CLAUDE.md).

### Exportar para planilha

Toda tela com registros exporta em `.xlsx` **com os filtros aplicados**, na
ordem da tela — quebra, cadastro de produtos e validades, esta levando junto
estoque, saídas e o período, sem os quais "sai em 195 dias" chega ao Excel como
um número sem procedência. Quem
filtrou por um motivo quer levar aquele recorte para a reunião, não a base
inteira; exportar tudo obrigaria a filtrar de novo no Excel, refazendo à mão o
que a tela já sabe.

O código de barras vai como texto: em número, o Excel come o zero à esquerda e
mostra `7,89658E+12` numa coluna estreita.

## O que é editável à mão

Regra geral, válida em todas as telas: **todo registro pode ser corrigido à
mão, exceto o que aquela tela apenas busca de outra base.**

O que a tela busca de outra parte é só leitura ali, e se corrige na tela dona
do dado:

| Dado | Só leitura em | Edita-se em |
|---|---|---|
| SKU, descrição, código de barras | Estoque, Validades, Quebra | Cadastro de produtos |
| Situação, "sai em X dias" | todas | em lugar nenhum — é calculado |

Saldo e saídas são a exceção que confirma a regra: aparecem na tela de Estoque
e no diálogo de lote das Validades, e são **editáveis nas duas**. Não é dado
buscado de outra base — é o mesmo registro do produto, e gravar de qualquer uma
das telas escreve na mesma fonte, sem risco de as duas discordarem. Mandar
quem está com o celular na mão na frente da prateleira até outra tela para
corrigir um saldo faria o número continuar errado.

Do lado oposto, o que **não** vinha de base nenhuma e mesmo assim não podia ser
corrigido era falha, não desenho — e foi resolvido:

- O **período do relatório de saídas** é editado na própria tela de Validades,
  onde o número aparece e onde está à vista a previsão que ele sustenta. Ele
  desloca todas as situações de uma vez, então a edição é explícita: um toque
  para abrir, confirmar para gravar.
- As listas de **motivo e origem** são renomeadas e excluídas pelo "Editar
  lista", dentro do registro de quebra. Renomear conserta os registros que já
  usam a etiqueta, porque eles apontam para o `id` e não para o texto —
  é assim que "danificada" digitado errado volta a ser "Danificado" sem virar
  um segundo motivo. Excluir só vale enquanto ninguém usa a etiqueta: em uso,
  a exclusão deixaria registros apontando para o nada, e a lista mostraria
  motivo em branco sem explicação. A tela diz quantos registros seguram cada
  uma, em vez de oferecer um botão desabilitado sem motivo.

## Gerar quebra de um lote vencido

Na tela de Validades, todo lote **vencido** ganha um botão de raio que abre o
registro de quebra já preenchido: produto, validade e motivo "Vencido"
prontos, restando confirmar.

A quantidade sugerida é o **saldo do produto** — o único número que o sistema
tem. Pode estar errada: o mesmo produto pode ter mais de um lote com
validades diferentes, e o saldo é do produto, não do lote (ver "De onde vêm
saldo e saídas"). Por isso o formulário abre para revisão, e não grava
direto — a pessoa corrige a quantidade se aquele lote não for todo o saldo.

O motivo sugerido casa **pelo nome** ("Vencido"), não por um id fixo: a lista
de motivos é editável, e "Vencido" pode ter sido renomeado ou excluído. Sem
casamento, o formulário abre sem motivo escolhido, nunca com um id que não
aponta para etiqueta nenhuma.

Salvar a quebra **exclui o lote da lista de vencidos**, pelo mesmo caminho e
o mesmo desfazer do botão de excluir — não é um estado novo, é a mesma
exclusão de sempre. Se a quantidade sugerida estava errada e sobrou saldo do
lote, desfazer traz o lote de volta em vez de forçar um lançamento manual
para recuperar o acompanhamento perdido.

## Criar registro à mão, em toda tela que tem registro

Cada tela com registros tem sua própria porta de entrada manual, ao lado da
porta em massa quando ela existe. Importar é o caminho de todo dia; um item
solto não vale uma planilha só para ele.

| Tela | O que se cria à mão | Porta em massa |
|---|---|---|
| Cadastro de produtos | produto (só administrador) | importação da base |
| Quebra | registro de perda | — |
| **Validades** | **lote: produto + validade** | — |
| **Estoque** | **linha: SKU + saldo, saídas, custo e venda** | importação dos relatórios |

Duas regras que essas portas novas seguem:

- **No lote não existe produto pendente.** Um lote é produto **mais** validade;
  sem produto no cadastro ele nasceria órfão e sequer apareceria na lista que
  deveria alimentar. O seletor manda cadastrar antes — diferente da quebra,
  onde a perda aconteceu de qualquer jeito e bloquear garantiria que o registro
  não existisse. Lote repetido também não duplica: avisa que aquele produto já
  está em acompanhamento naquela data.
- **Adicionar ao estoque é a importação de uma linha só.** Passa pelo mesmo
  caminho da planilha, com a mesma regra de SKU desconhecido. Quando o SKU casa
  com um produto que já existe, o formulário abre com os números atuais dele:
  o botão passa a dizer "Atualizar produto", e salvar com os campos em branco
  zeraria saldo, saídas, custo e venda de quem já tinha valores.

## Ordenar coluna e filtrar por categoria, em toda tela que tem registro

Toda tabela com registros (Cadastro de produtos, Validades, Quebra, Estoque)
ordena por qualquer coluna: clicar no cabeçalho alterna crescente → decrescente
→ ordem original, sempre numa coluna por vez — ordenar por duas ao mesmo tempo
exigiria explicar a prioridade entre elas, e ninguém pediu isso.

A ordenação não substitui filtro nenhum que já existisse: ela reorganiza o que
já está na tela, o filtro decide o que entra. As duas convivem sem conflito
porque agem em etapas diferentes — primeiro filtra, depois ordena o resultado.

Filtro novo por categoria só entra onde a tela ainda não tinha um jeito de
restringir aquela coluna:

| Tela | Coluna categórica | Já coberta por | Filtro novo |
|---|---|---|---|
| Cadastro de produtos | — | busca cobre texto; pendente já é alternável | não |
| Validades | Situação | os quatro cartões (`SituationTiles`) já filtram | não |
| Estoque | Pendente | já é um alternador | não |
| **Quebra** | **Motivo, Origem** | nada — só existiam como coluna de leitura | **sim** |

Motivo e Origem em Quebra ganharam o mesmo menu (`FilterMenu`): uma lista de
caixas de marcação, várias marcadas somam (ou lógico) em vez de filtrar em
série — marcar "Vencido" e "Danificado" mostra as duas, não a interseção
impossível de um registro ter os dois motivos ao mesmo tempo. Motivo e Origem
são etiquetas editáveis (ver "O que é editável à mão"), então o filtro guarda
o **id** da etiqueta, não o texto — renomear "Vencido" não quebra um filtro já
salvo.

## Painel de filtro por período e por faixa numérica

O ícone de filtro do AppSheet reunia, num painel só, período (quando a coluna
tinha data), mínimo e máximo (para número) e uma lista de opções (para texto).
Aqui ele virou um botão "Filtro" à parte — ao lado de Motivo, Origem e dos
outros controles que já existiam — porque período e faixa numérica são uma
pergunta diferente de "qual destas opções": não têm lista fixa para marcar, e
juntar os dois formatos num controle só obrigaria a interface de um a servir o
outro mal.

| Tela | Período (data) | Faixa numérica |
|---|---|---|
| Cadastro de produtos | — | Saldo, Saídas, Custo, Venda |
| **Validades** | **Validade** | Saldo, Saídas |
| Quebra | — | Quantidade |
| Estoque | — | Saldo, Saídas, Custo, Venda, Total custo, Total venda |

Em Validades, período de validade não é redundante com os quatro cartões de
situação: os cartões respondem "quão urgente" (vencido, alerta, ok, sem data),
o período responde "vence entre estas duas datas específicas" — perguntas
diferentes que cruzam livremente (dá para marcar "vence antes de vender" **e**
restringir a um mês do calendário ao mesmo tempo).

Cada campo aceita mínimo, máximo, os dois ou nenhum — um filtro "a partir de
500" é tão válido quanto um intervalo fechado. Sem data cadastrada nunca casa
com um período: perguntar "vence entre X e Y" sobre uma data que a linha não
tem faria mais sentido sumir da lista do que aparecer como se coincidisse. Em
Estoque, os dois totais calculados (ver "De onde vêm saldo e saídas") entram
na faixa numérica como qualquer outra coluna — filtrar por eles não precisa
saber que são conta, não campo gravado.

## O que veio do AppSheet e não se repete aqui

O app anterior tinha tabelas que existiam para contornar limitações da
ferramenta, não porque o domínio pedia:

- **Filtro Personalizado**, que era uma tela inteira só para guardar o filtro
  escolhido. Aqui o filtro é lembrado sozinho em `localStorage` (ver CLAUDE.md,
  "Filtros e buscas são lembrados") — a tela não precisa existir.
- **TotalSituação** e **Período de dados**, que serviam para calcular
  totalizações que a ferramenta não fazia direto.

As tabelas de **cadastro manual** (motivos, situações) continuam fazendo
sentido: são dados que alguém mantém, não contorno de ferramenta.

## Riscos a desenhar junto

**Pendências acumulam.** Se o administrador não tiver uma fila visível com
contador, elas apodrecem e a base volta a ficar furada. "Produtos pendentes"
precisa ser um lugar com número na cara dele, não algo que ele lembre de
procurar.

**Dois operadores criam a mesma pendência.** Encontram o mesmo produto
desconhecido em dias diferentes. Casar por código de barras na criação evita
que o administrador resolva a mesma coisa duas vezes.

**Lista de motivos por operador fragmenta o relatório.** É o mesmo problema que
o cadastro de produtos sob o administrador resolve: se cada pessoa mantém a
própria lista, "danificado", "danificada" e "avaria" viram três motivos, e a
soma por motivo deixa de fechar. Editar a lista pode continuar sendo livre — o
que precisa ser único é a **lista**, não quem a edita.

## Ainda em aberto

Pontos que a especificação de cada tela precisa fechar:

- Quais são os estados de um item na tela de quebra ("ainda no estoque",
  "retirado", …) e o que faz cada um mudar.

Fechados durante a construção da tela de quebra:

- **Estados do item na tela de quebra**: são dois, e saem do saldo do produto —
  no estoque e zerado. Não há estado próprio da quebra a manter em paralelo.
- **Valores iniciais das listas**: motivos (Vencido, Danificado, Avaria de
  transporte, Divergência de quantidade, Furto ou perda) e origens (Centro de
  distribuição, Loja, Fornecedor), todos editáveis.
- **Dono das listas de motivo e origem**: a lista é **da loja**, uma só, e
  qualquer perfil a edita — criar, renomear e excluir (ver "O que é editável à
  mão"). O que precisa ser único é a lista, não quem a mantém: é a lista por
  operador que fragmentaria o relatório em "danificado", "danificada" e
  "avaria".
