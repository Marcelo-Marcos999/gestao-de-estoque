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
| **Origem** (obrigatória) | de onde veio o problema | chegou assim do CD, aconteceu na loja, fornecedor |

Um item pode ser *danificado* **e** ter chegado *assim do CD*: são coisas
diferentes. Numa lista só, as opções cresceriam por combinação ("danificado",
"danificado do CD", "vencido do CD"…) e os relatórios não separariam mais.

Os dois são obrigatórios. A origem já foi opcional, e o resultado era previsível:
quem tem pressa deixa em branco, e a pergunta "quanto disso veio do CD" passa a
ser respondida com uma fração dos registros — pior que não responder, porque o
número parece completo. O banco já exigia (`quebras.origem_id` não aceita nulo);
agora a tela exige também, em vez de descobrir isso no erro ao salvar.

Separar importa por dinheiro: "quanto perdemos por avaria" é uma pergunta,
"quanto disso veio do CD" é outra — e a segunda é a que dá base para cobrar o
centro de distribuição.

## O que identifica um registro

**Produto + validade + motivo.**

A validade é o que distingue de verdade: duas unidades do mesmo produto com
validades diferentes são coisas diferentes — uma ainda se vende, a outra não.
A origem é atributo (obrigatório) do registro, não parte da identidade.

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

**Onde o arquivo mora e como se comporta.**
- Os arquivos ficam no **R2 da Cloudflare**, enviados pelo back-end; o banco guarda
  só nome, tipo e tamanho. Quem enxerga o registro enxerga os anexos (a RLS decide:
  o operador, só os da própria loja).
- **Foto é reduzida antes de subir** (1600 px no lado maior): uma foto de celular
  passa de 4 MB, e quem envia está no 4G da loja. PDF sobe como está. Limite de
  10 MB por arquivo; só foto (JPG, PNG, WebP, HEIC) e PDF.
- **Um espaço por tipo:** enviar de novo troca o anterior.
- **O arquivo sobe depois do registro** (o anexo pertence a ele). Se o envio falha
  num registro **novo**, o registro é desfeito e o formulário volta como estava —
  deixá-lo salvo pela metade faria quem tenta de novo criar um segundo igual. Na
  **edição**, o registro já mudou: o formulário fica aberto e avisa qual anexo não
  subiu.
- **Excluir o registro mantém os arquivos no bucket** durante o "desfazer", que
  devolve a linha do anexo. Os arquivos de registros excluídos de vez ficam
  órfãos no bucket (custam centavos); uma limpeza periódica é uma melhoria futura.
- **Sem armazenamento configurado**, o formulário avisa que os anexos não estão
  ativos e não oferece os campos: aceitar uma foto que não seria guardada deixaria
  quem a tirou no corredor achando que ela foi.

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
casa a planilha com o cadastro pelo **SKU ou pelo código de barras** — um dos dois
basta, como na importação de Validades — e as demais colunas são opcionais: uma
importação pode trazer só saldo e saídas, e o que não veio fica como estava em
vez de zerar. O usuário trata o arquivo antes se precisar.

**Atualizar só as saídas** (ou só qualquer outro número) é o uso normal: só as
colunas mapeadas são gravadas, as demais ficam como estão. Em "Colunas" há ainda a
opção **Criar produto pendente para SKU fora do cadastro** (marcada por padrão);
desmarcada, a importação só atualiza o que já existe — o que se quer ao reimportar
um relatório do ERP que traz linhas de total ("TOTAL GERAL:") e produtos que
ninguém cadastrou.

**Linha com número que o banco não aceita** (saída, saldo, custo ou venda
**negativos** — comuns em relatório com devolução maior que a venda — ou acima do
limite da coluna) **fica de fora**, com o motivo na revisão; as demais entram. Antes,
uma só linha assim derrubava o lote inteiro de 500, e a tela dizia apenas "tente de
novo". Quando o servidor recusa algo, a tela agora mostra o motivo dele.

Como a linha acha o produto: primeiro pelo SKU; se o SKU não está no cadastro (ou
a linha não tem), pelo código de barras. O mesmo produto citado duas vezes — uma
por SKU, outra por código de barras — conta como **repetido**. Uma linha só com
código de barras que o cadastro não conhece fica **de fora**: criar um produto
pendente exige um SKU (próximo parágrafo).

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

### Custo nas telas de Validades e Quebra

O custo é do estoque, e as outras duas telas **herdam** o número em vez de ter
o seu: Validades mostra o **custo unitário** e o **total de custo** (saldo ×
custo) de cada lote, e Quebra mostra o custo unitário e o **total de custo da
perda** (quantidade × custo) de cada registro. É o que responde "quanto
dinheiro está parado neste lote vencido" e "quanto essa perda custou".

Nada é copiado para o lote nem para o registro: o custo é lido do estoque na
hora de montar a tela, igual saldo e saídas. Corrigir o custo em Estoque
corrige o total das outras duas. Pela mesma razão, o total **não é somado**
entre linhas de Validades: o saldo é do produto, e dois lotes do mesmo produto
repetiriam o mesmo saldo — somar contaria o mesmo dinheiro duas vezes. Em
Quebra cada registro tem a própria quantidade, então ali a soma seria honesta
(ainda não existe resumo).

Produto pendente de cadastro, em Quebra, não tem estoque nem custo: a coluna
mostra "—" e o filtro por faixa o deixa de fora quando ativo, em vez de tratá-lo
como custo zero.

Os dois valores entram no filtro por faixa e na exportação das duas telas.

### SKU que a importação não reconhece

Não bloqueia. O produto entra no cadastro como **pendente**, com os números da
planilha, sem descrição e com o código de barras que a linha trouxe (se trouxe, e
se ele ainda não for de outro produto) — mesma decisão do registro de quebra, e pelo mesmo motivo: recusar a linha perderia o dado, porque a
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
de saídas cobre. **Cada login edita o seu** e ele fica gravado no banco, no
próprio login (padrão 390 dias, até 3650), então vale em qualquer aparelho e não
interfere no de outra pessoa. Quem exporta o relatório é quem sabe o intervalo;
por isso não é uma configuração única da empresa. Sem saídas no período não há divisão possível, e o produto
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
  para abrir, confirmar para gravar. Se o servidor não guardar, a tela avisa em
  vez de deixar o valor antigo voltar sem explicação.
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

### Vários lotes vencidos de uma vez, sem abrir formulário nenhum

Selecionar vários lotes e marcar "Gerar quebra" na barra de seleção manda
todos para a quebra de um só toque — sem abrir um formulário por item, e sem
perguntar o motivo.

Isso só é seguro porque a pergunta já tem resposta óbvia: todo lote na faixa
**"venceu"** tem "vencido no estoque" como motivo, e esse motivo **é** o
próprio fato de estar ali — perguntar de novo seria perguntar o que a tela já
sabe. Por isso o botão só aparece quando **toda a seleção** está na faixa
"venceu"; um só lote fora dela (que ainda vende, ou sem estimativa) esconde o
botão inteiro, porque aí o motivo deixa de ser óbvio e alguém precisa decidir.

A **origem**, ao contrário do motivo, não se deduz — o lote pode ter chegado
vencido do CD ou vencido na prateleira — e é obrigatória. O envio em massa
pergunta uma vez, num diálogo curto, e a origem escolhida vale para todos os
registros criados naquele envio.

A quantidade de cada registro segue a mesma regra do caminho de um lote só —
o saldo do produto — e os lotes somem da lista de vencidos pelo mesmo caminho
do botão de excluir, com o mesmo desfazer. Diferença proposital: como não há
revisão antes de salvar (a própria ideia é pular o formulário), o desfazer
aqui traz o lote de volta para revisão manual, mas não desfaz o registro de
quebra já criado — que continua existindo em Quebra, e pode ser corrigido ou
excluído por lá (a mesma seleção múltipla desta seção existe lá também).

## Excluir sem abrir o registro, em toda tela que tem registro

Toda tela com registro tem uma caixa de marcação por linha, "selecionar
todos" e um botão de excluir que aparece só quando algo está marcado — a
mesma barra de seleção em Cadastro, Validades, Quebra e Estoque (quando
aplicável — ver abaixo). Continua existindo também um ícone de lixeira em
cada linha, para excluir um registro só sem marcar nada.

Sem confirmação antes, como toda exclusão neste projeto (ver "Registrar
quebra" e CLAUDE.md): perguntar "tem certeza?" a cada exclusão de rotina
treina a pessoa a confirmar sem ler. O desfazer aparece embaixo por ~8
segundos e resolve o engano de verdade.

### Produto com estoque no Cadastro: a exceção que pergunta

Excluir um produto do cadastro leva embora o estoque dele (em todas as lojas da
conta) e os lotes de validade que dependem desse estoque. Por isso o servidor
**não exclui sozinho** o produto que tem estoque lançado — e isso não pode ser
silencioso: houve uma versão em que esses produtos simplesmente continuavam na
lista, sem nenhuma explicação, e a exclusão parecia não funcionar.

Agora, depois da exclusão, os produtos com estoque que ficaram para trás geram
uma pergunta: "Excluir também o estoque?", dizendo quantos são e o que sai junto.
**Manter** não toca em nada; **Excluir com o estoque** apaga produto, estoque e
lotes — e essa parte **não tem desfazer**, porque o estoque que sai junto não
volta. Os produtos sem estoque saem como antes, com desfazer. Os registros de
quebra ficam, só sem o vínculo com o produto.

Pelo formulário de edição do produto vale a mesma regra: o aviso de confirmação
diz que o estoque vai junto quando ele existe.

O que **nunca** pode acontecer é a falha calada: erro de rede, exclusão em
andamento e exclusão concluída aparecem na tela. Seleções grandes (milhares de
produtos) vão em lotes de 2000, com "Excluindo N produtos…" visível.

**Não é igual em toda tela**, de propósito:

- **Cadastro de produtos**: só o administrador vê a caixa de marcação e a
  lixeira — é a mesma regra de quem pode escrever no cadastro (ver "Perfis de
  acesso"). O operador continua sem a ação, não só sem o clique: mostrar um
  botão que dá erro ao tocar é pior que não mostrar nada.
- **Validades e Quebra**: os dois perfis excluem — acompanhar lote e
  registrar quebra já são trabalho operacional de qualquer um dos dois.
- **Estoque não ganhou exclusão nenhuma.** Uma linha de Estoque não é uma
  entidade própria — é o mesmo `Product` do cadastro (ver "De onde vêm saldo
  e saídas"). "Excluir" ali significaria excluir o produto inteiro, uma ação
  do administrador — mas Estoque também é lido pelo operador, e oferecer o
  botão lá vazaria para quem não pode usá-lo o que o Cadastro já bloqueia
  escondendo a tela inteira. Quem precisa excluir um produto vai ao Cadastro.

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

## Configurações e logins

A tela de Configurações tem quatro abas; as duas últimas são só do administrador
(a aba nem aparece para o operador, e o servidor recusa do mesmo jeito):

| Aba | Quem | O que faz |
|---|---|---|
| Minha conta | todos | troca a própria senha (pede a atual) |
| Aparência | todos | tema e cor de destaque, gravados no aparelho |
| Lojas e logins | admin | cria login, desativa/reativa, gera nova senha |
| Empresa | admin | renomeia a empresa; vê plano e limites (só leitura) |

**Por que o administrador cuida das senhas.** Enquanto o sistema não envia
e-mail, ninguém recupera a própria senha nem cria conta sozinho. O admin cria o
login e recebe uma **senha provisória** de 12 caracteres, mostrada **uma única
vez** (o banco guarda só o hash; o diálogo não fecha com Esc nem clicando fora,
para não se perder sem querer). O mesmo vale para "Nova senha". A pessoa troca em
*Minha conta* no primeiro acesso. A tela de login esconde "Criar conta" e "Esqueci
minha senha" quando o servidor não tem e-mail configurado, e manda falar com o
administrador.

Regras que evitam travar a conta:

- o admin **não desativa o próprio login** (a conta ficaria sem ninguém que a
  administre) e **não redefine a própria senha por ali** (para isso existe a troca
  com a senha atual);
- desativar derruba as sessões do login (o refresh deixa de valer; o acesso já
  emitido vale por até 15 minutos);
- o **limite de logins do plano** conta só os ativos, vale também ao reativar, e é
  conferido sob trava por conta: duas criações simultâneas não passam juntas do
  limite;
- o **perfil não muda depois de criado** (desativar e criar de novo): ver
  `docs/modelo-de-dados.md`, "Segurança".

O login criado pelo admin já nasce com o e-mail como confirmado: ele digitou o
endereço e entregou a senha, e esperar um link que não chega travaria o acesso.

## Importar planilha em Validades e em Quebra

Quem já tem os dados numa base antiga importa por planilha em vez de digitar de
novo. Estoque já tinha o assistente; Validades e Quebra ganharam o seu, com a
mesma sequência (arquivo → colunas → revisão → gravação) montada uma vez só em
`shared/import/`. O que muda de tela para tela é só a *configuração*: quais
colunas, como classificar as linhas e como gravar.

Em todas, **nada é gravado antes da revisão**, que mostra quantas linhas entram,
quantas são puladas e **por quê** (linha por linha, as com problema na frente).
Reaplicar o mesmo arquivo não duplica: o que já existe aparece como "já existe" e
fica de fora. Se a gravação falhar no meio, a revisão é refeita contra o que já
foi gravado, e só o que falta é reenviado.

**Validades** — colunas: SKU e/ou código de barras (um dos dois), e a validade
(obrigatória). Cada linha vira um lote. Produto que não está no cadastro **não é
criado**: uma validade sozinha não basta para inventar um produto (diferente do
Estoque, onde o SKU novo vem com saldo e custo). Linha sem data é recusada, porque
sem data não há lote. Saldo, saídas e custo continuam vindo do Estoque; produto
sem estoque nesta loja entra com saldo zerado.

**Quebra** — colunas: SKU / código de barras / descrição, validade, **quantidade
(obrigatória)**, motivo, origem e observação.

- Produto fora do cadastro vira registro de produto **pendente**, como no registro
  manual; só é recusada a linha que não diz de qual produto se trata.
- Motivo e origem são casados **pelo nome**, sem ligar para caixa e acento. Nome
  que a lista ainda não tem **é criado** (uma base antiga tem as próprias
  categorias), e a revisão avisa quais — porque um nome escrito diferente vira um
  item a mais.
- Motivo e origem são obrigatórios. Linha que veio sem eles usa o **padrão
  escolhido na revisão**; sem padrão, fica de fora. Isto importa porque a origem
  já foi opcional: uma base antiga provavelmente tem muita linha sem origem.
- Importar **não cria lotes** em Validades, diferente de registrar à mão: ali a
  quebra de um lote diz que ele existe na loja; aqui são perdas já ocorridas, e
  lotes vencidos antigos encheriam Validades de coisa que ninguém mais acompanha.
- A data do registro e quem registrou **não são importados** (ficam o momento da
  importação e quem importou).

## Quanto vale a perda: os cartões de total

Estoque, Validades e Quebra mostram, no topo, quanto dinheiro está em jogo no que
**está na tela, com os filtros aplicados** (mesmo desenho nas três; sem lista, o
cartão não aparece, e o modo foco o esconde junto do cabeçalho):

| Tela | Cartões | Como se calcula |
|---|---|---|
| **Estoque** | Total de custo · Total de venda | saldo × custo e saldo × venda de cada produto |
| **Quebra** | Total de custo da perda | quantidade do registro × custo da loja dele |
| **Validades** | Custo em estoque · Custo em risco de perda | ver abaixo |

**Quebra.** É o valor da perda de verdade: cada registro tem a sua quantidade, então
nada se conta duas vezes. Registro sem custo conhecido (produto pendente, que ainda
não tem estoque) **não vale zero**: fica fora da soma, e o cartão diz quantos ficaram
de fora, em vez de um total que parece completo e não é.

**Validades.** Um lote só guarda a data; saldo e custo são do **produto** na loja.
Somar linha a linha contaria o mesmo estoque uma vez por lote, então a soma é por
produto (e loja) distintos.
- *Custo em estoque*: o estoque, a custo, dos produtos mostrados.
- *Custo em risco de perda*: o estoque, a custo, dos produtos que têm algum lote
  **vencido** ou que **vence antes de vender**. Como o lote não tem quantidade própria,
  é um **teto** — o que se perde de fato é no máximo isso.

Como seguem os filtros, clicar em "Venceu" nos cartões de situação faz o primeiro
cartão mostrar o custo do que já venceu: a perda que já aconteceu.

## O administrador vê as lojas todas

O login **é** a loja (ver `docs/modelo-de-dados.md`), então "os registros de todos
os usuários" são os registros de todas as lojas da conta. O banco já definia isso
(RLS: o administrador enxerga a conta inteira, o operador só a própria loja); as
telas de **Estoque, Validades e Quebra** passam a mostrar isso:

- **Administrador com mais de uma loja:** aparece o filtro **Loja** ("Todas as
  lojas" ou uma só) e cada registro traz o nome da loja. O filtro é lembrado por
  tela, como todo filtro, e fica sempre à vista — uma lista de uma loja só que
  parece a da conta inteira seria o engano a evitar.
- **Operador, ou administrador com uma loja só:** nada muda; sem filtro, sem rótulo.
- **Os números são os da loja do registro.** O mesmo produto tem saldo e custo
  diferentes em cada loja; a coluna de custo de um lote, ou o teto da quantidade
  de uma quebra, vêm do estoque **daquela** loja, nunca do login de quem olha.
- **O administrador age por outra loja.** Corrigir o saldo de uma linha, gerar a
  quebra de um lote vencido ou desfazer uma exclusão acontece **na loja do
  registro**, não na do administrador (a quebra gerada fica com a loja do lote, e
  o administrador como autor). O operador não consegue: o servidor responde 403 e
  a RLS barra de qualquer forma.
- **"Excluir tudo" age sobre uma loja.** Em "Todas as lojas" o botão some; com uma
  loja escolhida, o diálogo diz o nome dela. Apagar o estoque da conta inteira
  por um clique seria a pior forma de errar a loja.
- **Importar** planilha continua gravando na loja de quem importa (o
  administrador); importar por outra loja fica para depois.

## Excluir estoque

Operador e administrador excluem estoque de duas formas, na tela de Estoque:

- **Alguns produtos:** marca as linhas (caixa à esquerda; "Selecionar todos" marca
  o que está na tela, com os filtros aplicados) e usa "Excluir" na barra de
  seleção. A confirmação mostra quantos produtos e quantos lotes saem.
- **Tudo:** botão "Excluir tudo", para reimportar uma base do zero. É a ação mais
  destrutiva do sistema, então a confirmação também exige digitar `EXCLUIR`.

Nenhuma das duas tem **desfazer** — diferente da exclusão de registros nas outras
telas —, porque apagar uma posição leva os lotes de validade junto, e restaurá-los
exigiria guardar tudo o que saiu. Em compensação, o diálogo diz o tamanho do que
vai sair antes de confirmar.

- Saem saldo, saídas, custo e venda, e os **lotes de validade** junto (um lote só
  existe como filho de uma posição de estoque).
- **Ficam** os produtos no Cadastro e os registros de quebra.
- **Operador e administrador** veem a coluna de marcação e os botões, cada um
  sobre **a sua loja**: o estoque é dado operacional da loja (o operador já o
  corrige à mão e o importa), e quem o lançou errado precisa poder refazer sem
  esperar o administrador. O operador não alcança outra loja — o servidor
  responde 403 e a RLS barra de qualquer forma. O administrador, com várias
  lojas, escolhe uma no filtro (ver "O administrador vê as lojas todas").

**A tela de Estoque lista só quem tem estoque.** O cadastro tem todos os produtos,
muitos sem estoque nenhum; listá-los aqui, com zeros, enchia a tela de "registros"
que ninguém lançou e fazia "Excluir tudo" parecer não ter feito nada. Um produto
só do cadastro entra no Estoque quando alguém lança o estoque dele (importação ou
"Adicionar produto").

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
