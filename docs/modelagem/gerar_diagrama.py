"""
Gera docs/modelagem/diagrama-modelagem.pdf: o diagrama de modelagem de dados do
Gestão de Validades, em A4 paisagem.

Fonte da verdade: as migrações em backend/migrations/ (M0 = 1700000000000_schema.sql
até M9 = 1700000000009_plataforma_e_exclusao_de_conta.sql). Este script não lê o
banco: o modelo está escrito à mão aqui embaixo, conferido contra as migrações.
Mexeu no banco, atualize os dados deste arquivo e gere de novo.

Uso (a partir da raiz do repositório):
    python3 -m pip install --user reportlab
    python3 docs/modelagem/gerar_diagrama.py

Precisa da fonte Liberation Sans em /usr/share/fonts/truetype/liberation (no Debian e
no Ubuntu, pacote `fonts-liberation`); veja FONTES abaixo para apontar outra pasta.

Páginas:
    1. Visão geral: todas as tabelas, agrupadas por módulo, com as chaves estrangeiras.
    2 a 5. Um módulo por página, com todos os atributos.
    6 em diante. Relacionamentos, regras de integridade e pontos de atenção.
"""

import math
import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

PAGE_W, PAGE_H = landscape(A4)
MARGIN = 34
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diagrama-modelagem.pdf")

# ---------------------------------------------------------------------------
# Fontes
# ---------------------------------------------------------------------------

# Liberation Sans tem as mesmas medidas da Helvetica, mas, sendo TrueType, traz
# acentos, setas e "≥" — a Helvetica embutida do reportlab não tem as setas.
FONTES = "/usr/share/fonts/truetype/liberation"
pdfmetrics.registerFont(TTFont("Sans", os.path.join(FONTES, "LiberationSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Sans-Bold", os.path.join(FONTES, "LiberationSans-Bold.ttf")))
pdfmetrics.registerFont(TTFont("Sans-Italic", os.path.join(FONTES, "LiberationSans-Italic.ttf")))
pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bold", italic="Sans-Italic")

# ---------------------------------------------------------------------------
# Cores
# ---------------------------------------------------------------------------

TINTA = colors.HexColor("#1F2937")
TINTA_SUAVE = colors.HexColor("#6B7280")
BORDA = colors.HexColor("#D1D5DB")
LINHA = colors.HexColor("#1F2937")
LINHA_INFERIDA = colors.HexColor("#6B7280")
COR_PK = colors.HexColor("#1D4ED8")
COR_FK = colors.HexColor("#15803D")
COR_UNICO = colors.HexColor("#C2410C")

MODULOS = {
    "conta": ("Conta e acesso", colors.HexColor("#1E3A8A")),
    "estoque": ("Catálogo, estoque e auditoria", colors.HexColor("#047857")),
    "quebra": ("Quebras", colors.HexColor("#B91C1C")),
    "pedido": ("Pedidos", colors.HexColor("#6D28D9")),
    "plataforma": ("Plataforma (sem vínculo)", colors.HexColor("#4B5563")),
}

# Página de cada módulo, para as caixas "de outro módulo" dizerem onde olhar.
PAGINA_DO_MODULO = {"conta": 2, "plataforma": 2, "estoque": 3, "quebra": 4, "pedido": 5}


def clarear(cor, fator):
    """Mistura a cor com branco: 0 = a própria cor, 1 = branco."""
    return colors.Color(
        cor.red + (1 - cor.red) * fator,
        cor.green + (1 - cor.green) * fator,
        cor.blue + (1 - cor.blue) * fator,
    )


# ---------------------------------------------------------------------------
# O modelo (conferido contra backend/migrations)
# ---------------------------------------------------------------------------

# Cada atributo: (nome em português ou None, nome técnico, marcas).
# "único*" = único em combinação com outro campo; a combinação está na página de regras.
ID = ("Identificador", "id", "PK")
CRIADO = ("Criado em", "criado_em", "")
ATUALIZADO = ("Atualizado em", "atualizado_em", "")

ENTIDADES = {
    "contas": {
        "nome": "Conta (empresa)",
        "modulo": "conta",
        "atributos": [ID, ("Nome", "nome", ""), CRIADO],
    },
    "lojas": {
        "nome": "Loja / login",
        "modulo": "conta",
        "atributos": [
            ID,
            ("Conta", "conta_id", "FK"),
            ("Nome", "nome", ""),
            ("E-mail de login", "email", "único"),
            ("Hash da senha", "senha_hash", ""),
            ("Perfil: admin ou operador", "role", ""),
            ("Ativo", "ativo", ""),
            CRIADO,
            ATUALIZADO,
            ("E-mail confirmado em", "email_confirmado_em", ""),
            ("Senha alterada em", "senha_alterada_em", ""),
            ("Período de saídas (dias)", "periodo_saidas_dias", ""),
        ],
    },
    "configuracoes_conta": {
        "nome": "Configurações da conta",
        "modulo": "conta",
        "atributos": [
            ("Conta", "conta_id", "PK, FK"),
            ("Limite de logins", "limite_usuarios", ""),
            ("Limite de arquivos (MB)", "limite_armazenamento_mb", ""),
            ("Limite de registros", "limite_registros", ""),
            ("Plano", "plano", ""),
            ATUALIZADO,
        ],
    },
    "tokens_email": {
        "nome": "Token de e-mail",
        "modulo": "conta",
        "atributos": [
            ID,
            ("Loja", "loja_id", "FK"),
            ("Tipo", "tipo", ""),
            ("Hash do token", "token_hash", "único"),
            ("Expira em", "expira_em", ""),
            ("Usado em", "usado_em", ""),
            CRIADO,
        ],
    },
    "administradores_plataforma": {
        "nome": "Administrador da plataforma",
        "modulo": "plataforma",
        "atributos": [
            ID,
            ("Nome", "nome", ""),
            ("E-mail", "email", "único"),
            ("Hash da senha", "senha_hash", ""),
            ("Ativo", "ativo", ""),
            CRIADO,
        ],
    },
    "changelog": {
        "nome": "Novidades do sistema",
        "modulo": "plataforma",
        "atributos": [
            ID,
            ("Versão", "versao", ""),
            ("Título", "titulo", ""),
            ("Descrição", "descricao", ""),
            ("Só para admin", "restrito_admin", ""),
            ("Texto genérico", "texto_generico", ""),
            ("Publicado em", "publicado_em", ""),
        ],
    },
    "produtos": {
        "nome": "Produto",
        "modulo": "estoque",
        "atributos": [
            ID,
            ("Conta", "conta_id", "FK"),
            ("SKU", "sku", "único*"),
            ("Descrição", "descricao", ""),
            ("Código de barras", "codigo_barras", "único*"),
            ("Pendente de cadastro", "pendente_cadastro", ""),
            ("Loja de origem", "loja_origem_id", "FK"),
            CRIADO,
            ATUALIZADO,
        ],
    },
    "estoque": {
        "nome": "Posição de estoque",
        "modulo": "estoque",
        "atributos": [
            ID,
            ("Loja", "loja_id", "FK, único*"),
            ("Produto", "produto_id", "FK, único*"),
            ("Saldo", "saldo", ""),
            ("Saídas no período", "saidas", ""),
            ("Valor de custo", "valor_custo", ""),
            ("Valor de venda", "valor_venda", ""),
            ATUALIZADO,
        ],
    },
    "validades": {
        "nome": "Lote de validade",
        "modulo": "estoque",
        "atributos": [
            ID,
            ("Posição de estoque", "estoque_id", "FK"),
            ("Data de validade", "data_validade", ""),
            CRIADO,
        ],
    },
    "contagens": {
        "nome": "Contagem de auditoria",
        "modulo": "estoque",
        "atributos": [
            ID,
            ("Loja contada", "loja_id", "FK"),
            ("Produto", "produto_id", "FK"),
            ("Quantidade", "quantidade", ""),
            ("Contado por", "criado_por_id", "FK"),
            CRIADO,
        ],
    },
    "motivos": {
        "nome": "Motivo da quebra",
        "modulo": "quebra",
        "atributos": [
            ID,
            ("Conta", "conta_id", "FK"),
            ("Nome", "label", "único*"),
            ("Padrão do sistema", "embutido", ""),
            CRIADO,
        ],
    },
    "origens": {
        "nome": "Origem da quebra",
        "modulo": "quebra",
        "atributos": [
            ID,
            ("Conta", "conta_id", "FK"),
            ("Nome", "label", "único*"),
            ("Padrão do sistema", "embutido", ""),
            CRIADO,
        ],
    },
    "quebras": {
        "nome": "Registro de quebra",
        "modulo": "quebra",
        "atributos": [
            ID,
            ("Loja", "loja_id", "FK"),
            ("Produto", "produto_id", "FK"),
            ("SKU digitado", "sku", ""),
            ("Descrição digitada", "descricao", ""),
            ("Código de barras digitado", "codigo_barras", ""),
            ("Produto pendente", "pendente_produto", ""),
            ("Data de validade", "data_validade", ""),
            ("Quantidade", "quantidade", ""),
            ("Motivo", "motivo_id", "FK"),
            ("Origem", "origem_id", "FK"),
            ("Lote de origem", "origem_lote_id", "FK"),
            ("Observação", "observacao", ""),
            ("Registrado por", "criado_por_id", "FK"),
            CRIADO,
        ],
    },
    "anexos": {
        "nome": "Anexo (foto ou PDF)",
        "modulo": "quebra",
        "atributos": [
            ID,
            ("Registro de quebra", "quebra_id", "FK"),
            ("Tipo", "tipo", ""),
            ("Nome do arquivo", "nome_arquivo", ""),
            ("Tipo do arquivo", "mime_type", ""),
            ("Tamanho em bytes", "tamanho_bytes", ""),
            ("Caminho no bucket", "storage_path", ""),
            CRIADO,
        ],
    },
    "pedidos": {
        "nome": "Pedido",
        "modulo": "pedido",
        "atributos": [
            ID,
            ("Loja", "loja_id", "FK"),
            ("Número (PD)", "numero", "único*"),
            ("Cliente", "cliente", ""),
            ("Telefone", "telefone", ""),
            ("Observação", "observacao", ""),
            ("Situação", "status", ""),
            ("Criado por", "criado_por_id", "FK"),
            CRIADO,
            ("Fechado em", "fechado_em", ""),
        ],
    },
    "pedido_itens": {
        "nome": "Item do pedido",
        "modulo": "pedido",
        "atributos": [
            ID,
            ("Pedido", "pedido_id", "FK"),
            ("Produto", "produto_id", "FK"),
            ("SKU (cópia)", "sku", ""),
            ("Descrição (cópia)", "descricao", ""),
            ("Código de barras (cópia)", "codigo_barras", ""),
            ("Quantidade", "quantidade", ""),
            ("Preço unitário", "preco_unitario", ""),
            ("Custo unitário", "custo_unitario", ""),
            ("Tipo de desconto", "desconto_tipo", ""),
            ("Desconto", "desconto", ""),
            CRIADO,
        ],
    },
}


def rotulo_atributo(pt, tecnico):
    """Nome em português com o técnico entre parênteses, só quando forem diferentes."""
    if pt is None or pt.lower() == tecnico.lower():
        return tecnico
    return f"{pt} ({tecnico})"


# ---------------------------------------------------------------------------
# Caixas
# ---------------------------------------------------------------------------

CAB_H = 17  # altura do cabeçalho
LIN_H = 10.2  # altura de cada atributo
PAD = 5


class Caixa:
    """Geometria de uma entidade desenhada: serve de âncora para as linhas."""

    def __init__(self, x, topo, w, h, linhas=None):
        self.x, self.topo, self.w, self.h = x, topo, w, h
        self.base = topo - h
        self.cx = x + w / 2
        self.cy = topo - h / 2
        self.direita = x + w
        self.linhas = linhas or {}

    def y_do(self, tecnico):
        """Altura do meio da linha de um atributo (para a linha chegar no campo certo)."""
        return self.linhas[tecnico]


def _texto_cabecalho(chave):
    ent = ENTIDADES[chave]
    return ent["nome"], f"({chave})"


def desenhar_entidade(c, chave, x, topo, w):
    """Caixa completa: cabeçalho colorido e todos os atributos, com PK/FK/único à direita."""
    ent = ENTIDADES[chave]
    cor = MODULOS[ent["modulo"]][1]
    atributos = ent["atributos"]
    h = CAB_H + len(atributos) * LIN_H + PAD * 1.4

    c.setFillColor(colors.white)
    c.setStrokeColor(cor)
    c.setLineWidth(1)
    c.roundRect(x, topo - h, w, h, 4, stroke=1, fill=1)
    c.setFillColor(cor)
    c.roundRect(x, topo - CAB_H, w, CAB_H, 4, stroke=0, fill=1)
    c.rect(x, topo - CAB_H, w, 4, stroke=0, fill=1)

    nome, tecnico = _texto_cabecalho(chave)
    c.setFillColor(colors.white)
    c.setFont("Sans-Bold", 7.6)
    largura_nome = pdfmetrics.stringWidth(nome, "Sans-Bold", 7.6)
    c.setFont("Sans", 6.6)
    largura_tec = pdfmetrics.stringWidth(" " + tecnico, "Sans", 6.6)
    inicio = x + (w - largura_nome - largura_tec) / 2
    c.setFont("Sans-Bold", 7.6)
    c.drawString(inicio, topo - 11.6, nome)
    c.setFont("Sans", 6.6)
    c.drawString(inicio + largura_nome, topo - 11.6, " " + tecnico)

    linhas = {}
    y = topo - CAB_H - PAD + 1
    for pt, tec, marcas in atributos:
        y_meio = y - LIN_H / 2
        linhas[tec] = y_meio
        c.setFillColor(TINTA)
        c.setFont("Sans", 6.6)
        texto = rotulo_atributo(pt, tec)
        c.drawString(x + 6, y_meio - 2.3, texto)
        largura_texto = pdfmetrics.stringWidth(texto, "Sans", 6.6)
        if marcas:
            c.setFont("Sans-Bold", 5.9)
            largura_marca = pdfmetrics.stringWidth(marcas, "Sans-Bold", 5.9)
            # Uma caixa estreita demais faria o nome invadir a marca: melhor falhar
            # na geração do que entregar o PDF com texto sobreposto.
            assert x + 6 + largura_texto + 6 < x + w - 6 - largura_marca, f"caixa estreita: {chave}.{tec}"
            c.setFillColor(COR_PK if "PK" in marcas else COR_FK if "FK" in marcas else COR_UNICO)
            if "único" in marcas and "FK" in marcas:
                c.setFillColor(COR_FK)
            c.drawRightString(x + w - 6, y_meio - 2.2, marcas)
        else:
            assert x + 6 + largura_texto < x + w - 4, f"caixa estreita: {chave}.{tec}"
        y -= LIN_H
    return Caixa(x, topo, w, h, linhas)


def desenhar_resumo(c, chave, x, topo, w, h=30):
    """Caixa da visão geral: só o nome, a tabela e quantos campos ela tem."""
    ent = ENTIDADES[chave]
    cor = MODULOS[ent["modulo"]][1]
    c.setFillColor(colors.white)
    c.setStrokeColor(cor)
    c.setLineWidth(1)
    c.roundRect(x, topo - h, w, h, 4, stroke=1, fill=1)
    c.setFillColor(cor)
    c.roundRect(x, topo - 15, w, 15, 4, stroke=0, fill=1)
    c.rect(x, topo - 15, w, 4, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Sans-Bold", 7.4)
    assert pdfmetrics.stringWidth(ent["nome"], "Sans-Bold", 7.4) < w - 8, f"resumo estreito: {chave}"
    c.drawCentredString(x + w / 2, topo - 10.4, ent["nome"])
    c.setFillColor(TINTA_SUAVE)
    c.setFont("Sans", 6.3)
    c.drawCentredString(x + w / 2, topo - 24.5, f"{chave} · {len(ent['atributos'])} campos")
    return Caixa(x, topo, w, h)


def desenhar_fantasma(c, chave, x, topo, w, campos=("id",)):
    """Entidade de OUTRO módulo: clara e tracejada, só com a chave que a página usa."""
    ent = ENTIDADES[chave]
    cor = MODULOS[ent["modulo"]][1]
    clara = clarear(cor, 0.72)
    h = CAB_H + 11 + len(campos) * LIN_H + 4
    c.setFillColor(colors.white)
    c.setStrokeColor(clarear(cor, 0.35))
    c.setLineWidth(0.9)
    c.setDash(3, 2)
    c.roundRect(x, topo - h, w, h, 4, stroke=1, fill=1)
    c.setDash()
    c.setFillColor(clara)
    c.roundRect(x, topo - CAB_H, w, CAB_H, 4, stroke=0, fill=1)
    c.rect(x, topo - CAB_H, w, 4, stroke=0, fill=1)
    c.setFillColor(cor)
    c.setFont("Sans-Bold", 7.4)
    c.drawCentredString(x + w / 2, topo - 11.6, f"{ent['nome']} ({chave})")
    c.setFillColor(TINTA_SUAVE)
    c.setFont("Sans-Italic", 6)
    c.drawCentredString(x + w / 2, topo - CAB_H - 8.5, f"outro módulo · ver página {PAGINA_DO_MODULO[ent['modulo']]}")
    linhas = {}
    y = topo - CAB_H - 11
    for tec in campos:
        pt, _, marcas = next(a for a in ent["atributos"] if a[1] == tec)
        y_meio = y - LIN_H / 2
        linhas[tec] = y_meio
        c.setFillColor(TINTA)
        c.setFont("Sans", 6.6)
        c.drawString(x + 6, y_meio - 2.3, rotulo_atributo(pt, tec))
        if marcas:
            c.setFont("Sans-Bold", 5.9)
            c.setFillColor(COR_PK if "PK" in marcas else COR_FK)
            c.drawRightString(x + w - 6, y_meio - 2.2, marcas)
        y -= LIN_H
    return Caixa(x, topo, w, h, linhas)


def desenhar_externo(c, x, topo, w, titulo, linhas_texto):
    """Algo que não é tabela (o arquivo no bucket): caixa tracejada cinza."""
    h = CAB_H + len(linhas_texto) * LIN_H + 6
    c.setFillColor(colors.HexColor("#F9FAFB"))
    c.setStrokeColor(LINHA_INFERIDA)
    c.setLineWidth(0.9)
    c.setDash(3, 2)
    c.roundRect(x, topo - h, w, h, 4, stroke=1, fill=1)
    c.setDash()
    c.setFillColor(TINTA)
    c.setFont("Sans-Bold", 7.4)
    c.drawCentredString(x + w / 2, topo - 11.6, titulo)
    c.setFont("Sans", 6.5)
    c.setFillColor(TINTA_SUAVE)
    y = topo - CAB_H - 3
    for t in linhas_texto:
        c.drawCentredString(x + w / 2, y - 5.5, t)
        y -= LIN_H
    return Caixa(x, topo, w, h)


# ---------------------------------------------------------------------------
# Linhas e notação pé de galinha
# ---------------------------------------------------------------------------


def _unit(dx, dy):
    n = math.hypot(dx, dy)
    return dx / n, dy / n


def desenhar_marca(c, p, d, tipo, cor):
    """Marca na ponta da linha. `d` aponta da linha PARA a caixa.

    um        = barra (exatamente um)
    zero_um   = círculo + barra (zero ou um)
    zero_n    = círculo + pé de galinha (zero ou muitos)
    """
    px, py = p
    dx, dy = d
    nx, ny = -dy, dx
    c.setStrokeColor(cor)
    c.setLineWidth(1)
    if tipo in ("um", "zero_um"):
        bx, by = px - dx * 6, py - dy * 6
        c.line(bx - nx * 4.5, by - ny * 4.5, bx + nx * 4.5, by + ny * 4.5)
    if tipo == "zero_n":
        bx, by = px - dx * 9, py - dy * 9
        for s in (-5, 0, 5):
            c.line(bx, by, px + nx * s, py + ny * s)
    if tipo in ("zero_um", "zero_n"):
        recuo = 12.5 if tipo == "zero_um" else 12.5
        cx, cy = px - dx * recuo, py - dy * recuo
        c.setFillColor(colors.white)
        c.circle(cx, cy, 2.7, stroke=1, fill=1)


def desenhar_rotulo(c, x, y, texto, tamanho=6.3, cor=TINTA_SUAVE, fundo=True, fonte="Sans-Italic"):
    largura = pdfmetrics.stringWidth(texto, fonte, tamanho)
    if fundo:
        c.setFillColor(colors.white)
        c.rect(x - largura / 2 - 2, y - 2.5, largura + 4, tamanho + 2.5, stroke=0, fill=1)
    c.setFillColor(cor)
    c.setFont(fonte, tamanho)
    c.drawCentredString(x, y, texto)


def _rotulo_cardinalidade(c, p, d, texto, lado, comprimento):
    """Escreve 1 / 0..1 / 0..N perto da ponta, ao lado da marca.

    Em trecho curto o recuo encolhe: com o recuo fixo, os rótulos das duas pontas
    se encontravam no meio da linha.
    """
    px, py = p
    dx, dy = d
    recuo = min(21, max(10, comprimento * 0.3))
    bx, by = px - dx * recuo, py - dy * recuo
    c.setFillColor(TINTA)
    c.setFont("Sans-Bold", 6.6)
    if abs(dy) < 0.01:  # linha horizontal: texto acima (ou abaixo)
        y = by + 3.6 if lado == "+" else by - 8.5
        c.drawCentredString(bx, y, texto)
    else:  # linha vertical: texto à direita (ou à esquerda), longe do pé de galinha
        if lado == "+":
            c.drawString(px + 7, by - 2, texto)
        else:
            c.drawRightString(px - 7, by - 2, texto)


def desenhar_relacao(c, pontos, inicio, fim, card_inicio, card_fim, verbo=None, segmento=None,
                     inferida=False, lado_inicio=None, lado_fim=None, verbo_desloc=(0, 0)):
    """Linha ortogonal entre duas caixas, com as marcas, as cardinalidades e o verbo.

    `pontos[0]` fica na caixa do lado "um" (quem é referenciado) e `pontos[-1]` na
    do lado "muitos" (quem tem a chave estrangeira).
    """
    cor = LINHA_INFERIDA if inferida else LINHA
    c.setStrokeColor(cor)
    c.setLineWidth(1)
    if inferida:
        c.setDash(3, 2)
    caminho = c.beginPath()
    caminho.moveTo(*pontos[0])
    for p in pontos[1:]:
        caminho.lineTo(*p)
    c.drawPath(caminho, stroke=1, fill=0)
    c.setDash()

    d0 = _unit(pontos[0][0] - pontos[1][0], pontos[0][1] - pontos[1][1])
    d1 = _unit(pontos[-1][0] - pontos[-2][0], pontos[-1][1] - pontos[-2][1])
    desenhar_marca(c, pontos[0], d0, inicio, cor)
    desenhar_marca(c, pontos[-1], d1, fim, cor)
    # Padrão: na horizontal, os dois rótulos acima; na vertical, um de cada lado,
    # para não se empilharem quando a linha é curta.
    vertical = abs(d0[1]) > 0.5
    lado_inicio = lado_inicio or ("-" if vertical else "+")
    lado_fim = lado_fim or ("+" if abs(d1[1]) > 0.5 else "+")
    _rotulo_cardinalidade(c, pontos[0], d0, card_inicio, lado_inicio, math.dist(pontos[0], pontos[1]))
    _rotulo_cardinalidade(c, pontos[-1], d1, card_fim, lado_fim, math.dist(pontos[-1], pontos[-2]))

    if verbo:
        if segmento is None:
            # O trecho mais longo é o que tem espaço para o verbo.
            segmento = max(range(len(pontos) - 1),
                           key=lambda i: math.dist(pontos[i], pontos[i + 1]))
        a, b = pontos[segmento], pontos[segmento + 1]
        mx, my = (a[0] + b[0]) / 2 + verbo_desloc[0], (a[1] + b[1]) / 2 + verbo_desloc[1]
        texto = f"{verbo} (inferido)" if inferida else verbo
        # Verbo que não cabe entre as duas marcas iria por cima delas: quem chama
        # precisa deslocá-lo para fora da linha (`verbo_desloc`).
        if abs(a[0] - b[0]) < 0.01:  # trecho vertical: o texto atravessa a linha, precisa de altura
            cabe = math.dist(a, b) >= 52
        else:
            cabe = math.dist(a, b) >= pdfmetrics.stringWidth(texto, "Sans-Italic", 6.3) + 44
        assert cabe or verbo_desloc != (0, 0), f"verbo sem espaço: {texto}"
        desenhar_rotulo(c, mx, my - 2.2, texto, fundo=verbo_desloc == (0, 0) or cabe)


# ---------------------------------------------------------------------------
# Elementos comuns das páginas de diagrama
# ---------------------------------------------------------------------------


def cabecalho(c, titulo, subtitulo):
    c.setFillColor(TINTA)
    c.setFont("Sans-Bold", 16)
    c.drawString(MARGIN, PAGE_H - 44, titulo)
    c.setFillColor(TINTA_SUAVE)
    c.setFont("Sans", 8)
    c.drawString(MARGIN, PAGE_H - 57, subtitulo)


def legenda_cardinalidades(c, x, topo, w=150, extra=True):
    """Legenda da notação. `extra` acrescenta tracejado e caixa de outro módulo."""
    itens = [("um", "1", "exatamente um"), ("zero_um", "0..1", "zero ou um"), ("zero_n", "0..N", "zero ou muitos")]
    h = 22 + len(itens) * 15 + (45 if extra else 0)
    c.setFillColor(colors.HexColor("#F9FAFB"))
    c.setStrokeColor(BORDA)
    c.setLineWidth(0.8)
    c.roundRect(x, topo - h, w, h, 4, stroke=1, fill=1)
    c.setFillColor(TINTA)
    c.setFont("Sans-Bold", 7.4)
    c.drawString(x + 8, topo - 13, "Legenda das cardinalidades")
    y = topo - 27
    for tipo, card, texto in itens:
        c.setStrokeColor(LINHA)
        c.setLineWidth(1)
        c.line(x + 10, y, x + 42, y)
        desenhar_marca(c, (x + 42, y), (1, 0), tipo, LINHA)
        c.setFillColor(TINTA)
        c.setFont("Sans", 6.8)
        c.drawString(x + 52, y - 2.4, f"{card}  =  {texto}")
        y -= 15
    if extra:
        c.setStrokeColor(LINHA_INFERIDA)
        c.setDash(3, 2)
        c.line(x + 10, y, x + 42, y)
        c.setDash()
        c.setFillColor(TINTA)
        c.setFont("Sans", 6.8)
        c.drawString(x + 52, y - 2.4, "inferido (sem FK no banco)")
        y -= 15
        c.setStrokeColor(LINHA_INFERIDA)
        c.setFillColor(colors.white)
        c.setDash(3, 2)
        c.roundRect(x + 10, y - 4, 32, 9, 2, stroke=1, fill=1)
        c.setDash()
        c.setFillColor(TINTA)
        c.drawString(x + 52, y - 2.4, "entidade de outro módulo")
        y -= 15
        c.setFillColor(COR_UNICO)
        c.setFont("Sans-Bold", 6.6)
        c.drawString(x + 12, y - 2.4, "único*")
        c.setFillColor(TINTA)
        c.setFont("Sans", 6.8)
        c.drawString(x + 52, y - 2.4, "único junto com outro campo")
    return h


def chips_modulos(c, x, y):
    c.setFont("Sans", 6.8)
    for chave in ("conta", "estoque", "quebra", "pedido", "plataforma"):
        nome, cor = MODULOS[chave]
        c.setFillColor(cor)
        c.roundRect(x, y - 1.5, 9, 7, 1.5, stroke=0, fill=1)
        c.setFillColor(TINTA)
        c.drawString(x + 12, y, nome)
        x += 12 + pdfmetrics.stringWidth(nome, "Sans", 6.8) + 14


def nota(c, x, topo, w, texto_html, h=None):
    """Caixa azul-clara com uma observação, como a do PDF de referência."""
    estilo = ParagraphStyle("nota", fontName="Sans", fontSize=6.9, leading=9, textColor=TINTA)
    p = Paragraph(texto_html, estilo)
    _, ph = p.wrap(w - 16, 400)
    h = h or ph + 14
    c.setFillColor(colors.HexColor("#EFF6FF"))
    c.setStrokeColor(colors.HexColor("#93C5FD"))
    c.setDash(3, 2)
    c.setLineWidth(0.8)
    c.roundRect(x, topo - h, w, h, 4, stroke=1, fill=1)
    c.setDash()
    p.drawOn(c, x + 8, topo - 7 - ph)
    return h


def grupo(c, x, topo, w, h, titulo, cor):
    """Moldura tracejada que junta caixas de um mesmo assunto."""
    c.setStrokeColor(clarear(cor, 0.4))
    c.setLineWidth(0.8)
    c.setDash(4, 3)
    c.roundRect(x, topo - h, w, h, 6, stroke=1, fill=0)
    c.setDash()
    c.setFillColor(cor)
    c.setFont("Sans-Bold", 6.8)
    c.drawString(x + 6, topo - 10, titulo)


# ---------------------------------------------------------------------------
# Página 1 — visão geral
# ---------------------------------------------------------------------------


def pagina_visao_geral(c):
    cabecalho(
        c,
        "Gestão de Validades  |  Modelagem de dados",
        "Visão geral: 16 tabelas em 5 módulos, com as chaves estrangeiras declaradas no banco. "
        "Os atributos e os vínculos inferidos estão nas páginas de cada módulo (2 a 5).",
    )
    chips_modulos(c, MARGIN, PAGE_H - 74)

    h = 28
    r = [492 - i * 64 for i in range(7)]  # topo de cada faixa
    meio = lambda caixa: caixa.topo - h / 2  # noqa: E731

    # Coluna da esquerda: configurações, tokens e o que não se liga a nada.
    config = desenhar_resumo(c, "configuracoes_conta", MARGIN, r[0], 118, h)
    tokens = desenhar_resumo(c, "tokens_email", MARGIN, r[2], 118, h)
    grupo(c, MARGIN - 6, r[3] + 16, 130, 16 + h + 16 + h + 10, "Sem relacionamento", MODULOS["plataforma"][1])
    desenhar_resumo(c, "administradores_plataforma", MARGIN, r[3], 118, h)
    desenhar_resumo(c, "changelog", MARGIN, r[3] - h - 16, 118, h)

    # Os dois "eixos": quase tudo pertence a uma loja e se refere a um produto.
    altura_eixo = r[1] - (r[6] - h)
    lojas = desenhar_resumo(c, "lojas", 222, r[1], 112, altura_eixo)
    produtos = desenhar_resumo(c, "produtos", 696, r[1], 112, altura_eixo)

    cw = 104
    contas = desenhar_resumo(c, "contas", 463, r[0], cw, h)
    motivos = desenhar_resumo(c, "motivos", 394, r[1], cw, h)
    origens = desenhar_resumo(c, "origens", 532, r[1], cw, h)
    quebras = desenhar_resumo(c, "quebras", 463, r[2], cw, h)
    validades = desenhar_resumo(c, "validades", 394, r[3], cw, h)
    anexos = desenhar_resumo(c, "anexos", 532, r[3], cw, h)
    estoque = desenhar_resumo(c, "estoque", 463, r[4], cw, h)
    contagens = desenhar_resumo(c, "contagens", 463, r[5], cw, h)
    pedidos = desenhar_resumo(c, "pedidos", 386, r[6], 96, h)
    itens = desenhar_resumo(c, "pedido_itens", 548, r[6], 96, h)

    # Conta → configurações, lojas, produtos, motivos, origens.
    y_cfg = contas.topo - 8
    desenhar_relacao(c, [(contas.x, y_cfg), (config.direita, y_cfg)], "um", "zero_um", "1", "0..1", "configura")
    y_loja = contas.topo - 21
    desenhar_relacao(c, [(contas.x, y_loja), (lojas.cx, y_loja), (lojas.cx, lojas.topo)],
                     "um", "zero_n", "1", "0..N", "possui", segmento=0, lado_inicio="-")
    desenhar_relacao(c, [(contas.direita, meio(contas)), (produtos.cx, meio(contas)), (produtos.cx, produtos.topo)],
                     "um", "zero_n", "1", "0..N", "cataloga", segmento=0)
    desenhar_relacao(c, [(480, contas.base), (480, motivos.topo)], "um", "zero_n", "1", "0..N")
    desenhar_relacao(c, [(550, contas.base), (550, origens.topo)], "um", "zero_n", "1", "0..N")
    desenhar_relacao(c, [(486, motivos.base), (486, quebras.topo)], "um", "zero_n", "1", "0..N")
    desenhar_relacao(c, [(544, origens.base), (544, quebras.topo)], "um", "zero_n", "1", "0..N")

    # Loja → tokens, quebras, estoque, contagens, pedidos; e a loja de origem do produto.
    desenhar_relacao(c, [(lojas.x, meio(tokens)), (tokens.direita, meio(tokens))], "um", "zero_n", "1", "0..N",
                     "recebe", verbo_desloc=(0, -8))
    for alvo, verbo in ((quebras, "registra (2 FKs)"), (estoque, "mantém"), (contagens, "conta (2 FKs)")):
        desenhar_relacao(c, [(lojas.direita, meio(alvo)), (alvo.x, meio(alvo))], "um", "zero_n", "1", "0..N", verbo)
    desenhar_relacao(c, [(lojas.direita, meio(pedidos)), (pedidos.x, meio(pedidos))], "um", "zero_n", "1", "0..N",
                     "vende (2 FKs)", verbo_desloc=(0, -8))
    y_base = 58
    desenhar_relacao(c, [(lojas.cx, lojas.base), (lojas.cx, y_base), (produtos.cx, y_base), (produtos.cx, produtos.base)],
                     "zero_um", "zero_n", "0..1", "0..N", "origina pendência de cadastro", segmento=1)

    # Produto → quebras, estoque, contagens, itens.
    for alvo, tipo, card, verbo in ((quebras, "zero_um", "0..1", "aparece em"), (estoque, "um", "1", "tem posição"),
                                    (contagens, "um", "1", "é contado")):
        desenhar_relacao(c, [(produtos.x, meio(alvo)), (alvo.direita, meio(alvo))], tipo, "zero_n", card, "0..N", verbo)
    desenhar_relacao(c, [(produtos.x, meio(itens)), (itens.direita, meio(itens))], "zero_um", "zero_n", "0..1", "0..N",
                     "é vendido", verbo_desloc=(0, -8))

    # Dentro do centro: lotes, anexos e itens.
    desenhar_relacao(c, [(490, estoque.topo), (490, validades.base)], "um", "zero_n", "1", "0..N", lado_inicio="+")
    desenhar_relacao(c, [(474, validades.topo), (474, quebras.base)], "zero_um", "zero_n", "0..1", "0..N",
                     lado_fim="-")
    desenhar_relacao(c, [(556, quebras.base), (556, anexos.topo)], "um", "zero_n", "1", "0..N", lado_inicio="+")
    desenhar_relacao(c, [(pedidos.direita, meio(pedidos)), (itens.x, meio(itens))], "um", "zero_n", "1", "0..N",
                     "contém", verbo_desloc=(0, -8))

    legenda_cardinalidades(c, MARGIN, 196, 130, extra=False)

    c.setFillColor(TINTA_SUAVE)
    c.setFont("Sans", 7)
    c.drawString(MARGIN, 26, "Regra central: tudo pertence a uma conta (empresa) e cada login é uma loja. O operador só enxerga "
                             "a própria loja; o administrador, todas as lojas da conta. Quem garante é a RLS do banco.")


# ---------------------------------------------------------------------------
# Páginas 2 a 5 — um módulo por página
# ---------------------------------------------------------------------------


def pagina_conta(c):
    cabecalho(c, "Módulo 1  |  Conta e acesso",
              "A empresa (conta), os logins (cada login é uma loja), o plano e os tokens de e-mail. "
              "Abaixo, as duas tabelas da plataforma, que não se ligam a nenhuma outra.")
    contas = desenhar_entidade(c, "contas", MARGIN + 10, 480, 150)
    config = desenhar_entidade(c, "configuracoes_conta", MARGIN + 10, 360, 190)
    lojas = desenhar_entidade(c, "lojas", 315, 480, 200)
    tokens = desenhar_entidade(c, "tokens_email", 610, 480, 165)

    desenhar_relacao(c, [(contas.direita, lojas.y_do("conta_id")), (lojas.x, lojas.y_do("conta_id"))],
                     "um", "zero_n", "1", "0..N", "possui")
    desenhar_relacao(c, [(contas.x + 60, contas.base), (contas.x + 60, config.topo)],
                     "um", "zero_um", "1", "0..1", "configura")
    desenhar_relacao(c, [(lojas.direita, tokens.y_do("loja_id")), (tokens.x, tokens.y_do("loja_id"))],
                     "um", "zero_n", "1", "0..N", "recebe")

    grupo(c, 300, 262, 490, 132, "Plataforma: sem relacionamento com as outras tabelas", MODULOS["plataforma"][1])
    desenhar_entidade(c, "administradores_plataforma", 315, 245, 200)
    desenhar_entidade(c, "changelog", 575, 245, 190)

    nota(c, 610, 385, 180,
         "<b>A loja é o login.</b> Não existe usuário dentro de loja: e-mail e senha moram em "
         "<i>lojas</i>. O e-mail é único no sistema todo, porque o login acontece antes de se "
         "saber a conta.")
    nota(c, MARGIN + 10, 262, 230,
         "<b>Outros módulos dependem daqui.</b> A conta é referenciada por produtos, motivos e "
         "origens; a loja, por produtos (origem), estoque, contagens, quebras e pedidos. "
         "Esses vínculos estão desenhados nas páginas 3 a 5.")
    legenda_cardinalidades(c, MARGIN + 10, 160, 160)


def pagina_estoque(c):
    cabecalho(c, "Módulo 2  |  Catálogo, estoque e auditoria",
              "O catálogo é da conta inteira; a posição de estoque e os lotes são de cada loja. "
              "A contagem de auditoria soma parcelas por loja e produto.")
    conta = desenhar_fantasma(c, "contas", MARGIN + 10, 486, 150)
    produto = desenhar_entidade(c, "produtos", 300, 486, 190)
    loja = desenhar_fantasma(c, "lojas", MARGIN + 10, 316, 150)
    estoque = desenhar_entidade(c, "estoque", 300, 316, 190)
    validades = desenhar_entidade(c, "validades", 585, 316, 170)
    contagens = desenhar_entidade(c, "contagens", 300, 150, 190)

    desenhar_relacao(c, [(conta.direita, produto.y_do("conta_id")), (produto.x, produto.y_do("conta_id"))],
                     "um", "zero_n", "1", "0..N", "cataloga")
    y_origem = produto.y_do("loja_origem_id")
    desenhar_relacao(c, [(loja.cx, loja.topo), (loja.cx, y_origem), (produto.x, y_origem)],
                     "zero_um", "zero_n", "0..1", "0..N", "origina pendência", segmento=1, lado_inicio="+")
    desenhar_relacao(c, [(loja.direita, estoque.y_do("loja_id")), (estoque.x, estoque.y_do("loja_id"))],
                     "um", "zero_n", "1", "0..N", "mantém")
    desenhar_relacao(c, [(produto.cx, produto.base), (produto.cx, estoque.topo)],
                     "um", "zero_n", "1", "0..N", "tem posição")
    desenhar_relacao(c, [(estoque.direita, validades.y_do("estoque_id")), (validades.x, validades.y_do("estoque_id"))],
                     "um", "zero_n", "1", "0..N", "tem lotes")
    # As duas chaves de loja em contagens: a loja contada e quem contou.
    for x_saida, campo, verbo in ((loja.x + 40, "criado_por_id", "conta (autor)"), (loja.x + 95, "loja_id", "é contada")):
        y = contagens.y_do(campo)
        desenhar_relacao(c, [(x_saida, loja.base), (x_saida, y), (contagens.x, y)],
                         "um", "zero_n", "1", "0..N", verbo, segmento=1)
    y_prod = contagens.y_do("produto_id")
    x_volta = 800
    desenhar_relacao(c, [(produto.direita, produto.y_do("sku")), (x_volta, produto.y_do("sku")), (x_volta, y_prod),
                         (contagens.direita, y_prod)],
                     "um", "zero_n", "1", "0..N", "é contado", segmento=2)
    desenhar_relacao(c, [(estoque.cx, estoque.base), (estoque.cx, contagens.topo)],
                     "zero_um", "zero_n", "0..1", "0..N", "comparada com", inferida=True)

    legenda_cardinalidades(c, 585, 245, 165)
    nota(c, 585, 94, 195,
         "<b>Inferido:</b> a auditoria compara a contagem com a posição de estoque da mesma loja e "
         "produto (<i>auditoria.ts:47</i>), sem chave estrangeira entre as duas tabelas.")


def pagina_quebras(c):
    cabecalho(c, "Módulo 3  |  Quebras",
              "O registro de perda de uma loja, com motivo e origem obrigatórios, e os anexos (fotos e PDFs). "
              "O arquivo em si fica fora do banco, no bucket R2.")
    conta = desenhar_fantasma(c, "contas", 340, 495, 150)
    motivos = desenhar_entidade(c, "motivos", MARGIN + 10, 495, 170)
    origens = desenhar_entidade(c, "origens", 620, 495, 170)
    quebras = desenhar_entidade(c, "quebras", 300, 405, 205)
    loja = desenhar_fantasma(c, "lojas", MARGIN + 10, 330, 130)
    produto = desenhar_fantasma(c, "produtos", 630, 345, 150)
    lote = desenhar_fantasma(c, "validades", 630, 285, 150)
    estoque = desenhar_fantasma(c, "estoque", 630, 222, 150)
    anexos = desenhar_entidade(c, "anexos", 300, 195, 205)
    arquivo = desenhar_externo(c, 620, 130, 170, "Arquivo no bucket R2 (fora do banco)",
                               ["conta / quebra / anexo", "foto ou PDF de até 10 MB"])

    # A conta define as duas listas.
    y_c = conta.topo - 24
    desenhar_relacao(c, [(conta.x, y_c), (motivos.direita, y_c)], "um", "zero_n", "1", "0..N", "define")
    desenhar_relacao(c, [(conta.direita, y_c), (origens.x, y_c)], "um", "zero_n", "1", "0..N", "define")

    # Motivo e origem entram pelo alto da quebra, acima das linhas da loja e dos fantasmas.
    y_classe = 380
    desenhar_relacao(c, [(motivos.cx, motivos.base), (motivos.cx, y_classe), (quebras.x, y_classe)],
                     "um", "zero_n", "1", "0..N", "classifica (motivo_id)", segmento=1)
    desenhar_relacao(c, [(origens.cx, origens.base), (origens.cx, y_classe), (quebras.direita, y_classe)],
                     "um", "zero_n", "1", "0..N", "classifica (origem_id)", segmento=1)

    # As duas chaves da loja: a dona do registro e quem o registrou.
    for y, verbo in ((loja.topo - 12, "registra (loja_id)"), (loja.base + 12, "autora (criado_por_id)")):
        desenhar_relacao(c, [(loja.direita, y), (quebras.x, y)], "um", "zero_n", "1", "0..N", verbo)

    desenhar_relacao(c, [(produto.x, produto.cy), (quebras.direita, produto.cy)],
                     "zero_um", "zero_n", "0..1", "0..N", "aparece em")
    desenhar_relacao(c, [(lote.x, lote.cy), (quebras.direita, lote.cy)],
                     "zero_um", "zero_n", "0..1", "0..N", "origina")
    y_e = quebras.base + 12
    desenhar_relacao(c, [(estoque.x, estoque.cy), (575, estoque.cy), (575, y_e), (quebras.direita, y_e)],
                     "zero_um", "zero_n", "0..1", "0..N", "saldo e custo", segmento=0, inferida=True,
                     verbo_desloc=(-16, -9))

    desenhar_relacao(c, [(quebras.cx, quebras.base), (quebras.cx, anexos.topo)], "um", "zero_n", "1", "0..N")
    desenhar_rotulo(c, quebras.cx + 36, (quebras.base + anexos.topo) / 2 - 2, "tem anexos")
    y_a = anexos.y_do("storage_path")
    desenhar_relacao(c, [(anexos.direita, y_a), (arquivo.x, y_a)], "um", "um", "1", "1", "aponta para", inferida=True)

    legenda_cardinalidades(c, MARGIN + 10, 270, 165)


def pagina_pedidos(c):
    cabecalho(c, "Módulo 4  |  Pedidos",
              "O pedido de um cliente (PD), numerado por loja, e os itens. Preço e custo são copiados "
              "do estoque da loja quando o item entra, e não mudam depois.")
    loja = desenhar_fantasma(c, "lojas", MARGIN + 10, 424, 120)
    pedidos = desenhar_entidade(c, "pedidos", 270, 470, 190)
    itens = desenhar_entidade(c, "pedido_itens", 560, 470, 215)
    produto = desenhar_fantasma(c, "produtos", 560, 240, 120)
    estoque = desenhar_fantasma(c, "estoque", 690, 240, 120)

    # As duas chaves da loja chegam às linhas dos campos com um cotovelo cada: a
    # caixa da loja fica entre as duas, e as linhas não se cruzam.
    for y_saida, x_cotovelo, campo, verbo in ((loja.topo - 10, 200, "loja_id", "vende"),
                                              (loja.base + 10, 214, "criado_por_id", "cria")):
        y = pedidos.y_do(campo)
        desenhar_relacao(c, [(loja.direita, y_saida), (x_cotovelo, y_saida), (x_cotovelo, y), (pedidos.x, y)],
                         "um", "zero_n", "1", "0..N", verbo, segmento=2)
    y_p = itens.y_do("pedido_id")
    desenhar_relacao(c, [(pedidos.direita, y_p), (itens.x, y_p)], "um", "zero_n", "1", "0..N", "contém")
    desenhar_relacao(c, [(produto.cx, produto.topo), (produto.cx, itens.base)], "zero_um", "zero_n", "0..1", "0..N",
                     "é vendido")
    desenhar_relacao(c, [(estoque.cx, estoque.topo), (estoque.cx, itens.base)], "zero_um", "zero_n", "0..1", "0..N",
                     "preço e custo", inferida=True)

    nota(c, 270, 330, 230,
         "<b>Inferido:</b> o item copia preço e custo da posição de estoque da loja do pedido "
         "(mesma loja e produto, <i>pedidosItens.ts:49-57</i>). Não há chave estrangeira: "
         "mudar o estoque depois não altera o pedido.")
    nota(c, 270, 255, 230,
         "<b>Cópia de propósito:</b> SKU, descrição e código de barras ficam no item; se o "
         "produto for excluído, <i>produto_id</i> vira nulo e o pedido continua legível.")
    legenda_cardinalidades(c, MARGIN + 10, 200, 165)


# ---------------------------------------------------------------------------
# Páginas de texto — relacionamentos, regras e pontos de atenção
# ---------------------------------------------------------------------------

E_TIT = ParagraphStyle("tit", fontName="Sans-Bold", fontSize=16, leading=19, textColor=TINTA)
E_SUB = ParagraphStyle("sub", fontName="Sans", fontSize=8, leading=10, textColor=TINTA_SUAVE, spaceAfter=8)
E_H2 = ParagraphStyle("h2", fontName="Sans-Bold", fontSize=10.5, leading=13, textColor=TINTA, spaceBefore=10, spaceAfter=4)
E_CEL = ParagraphStyle("cel", fontName="Sans", fontSize=7, leading=8.8, textColor=TINTA)
E_CEL_B = ParagraphStyle("celb", parent=E_CEL, fontName="Sans-Bold")
E_CEL_C = ParagraphStyle("celc", parent=E_CEL_B, alignment=TA_CENTER)
E_HDR = ParagraphStyle("hdr", parent=E_CEL_B, textColor=colors.white)
E_ITEM = ParagraphStyle("item", fontName="Sans", fontSize=7.4, leading=9.6, textColor=TINTA, leftIndent=10,
                        bulletIndent=0, spaceAfter=2.5)

COR_CAB_TABELA = colors.HexColor("#0F766E")

# (de, para, chave estrangeira, cardinalidade, leitura, inferida)
RELACOES = [
    ("Conta", "Loja / login", "lojas.conta_id", "1 : 0..N",
     "Uma conta possui nenhuma ou várias lojas (logins). Cada loja pertence a exatamente uma conta.", False),
    ("Conta", "Configurações da conta", "configuracoes_conta.conta_id (PK)", "1 : 0..1",
     "Uma conta tem nenhuma ou uma linha de configurações. Cada configuração pertence a exatamente uma conta.", False),
    ("Conta", "Produto", "produtos.conta_id", "1 : 0..N",
     "Uma conta cataloga nenhum ou vários produtos. Cada produto pertence a exatamente uma conta.", False),
    ("Conta", "Motivo da quebra", "motivos.conta_id", "1 : 0..N",
     "Uma conta define nenhum ou vários motivos. Cada motivo pertence a exatamente uma conta.", False),
    ("Conta", "Origem da quebra", "origens.conta_id", "1 : 0..N",
     "Uma conta define nenhuma ou várias origens. Cada origem pertence a exatamente uma conta.", False),
    ("Loja / login", "Token de e-mail", "tokens_email.loja_id", "1 : 0..N",
     "Uma loja recebe nenhum ou vários tokens de e-mail. Cada token é de exatamente uma loja.", False),
    ("Loja / login", "Produto (loja de origem)", "produtos.loja_origem_id", "0..1 : 0..N",
     "Uma loja origina nenhum ou vários produtos pendentes. Um produto tem nenhuma ou uma loja de origem.", False),
    ("Loja / login", "Posição de estoque", "estoque.loja_id", "1 : 0..N",
     "Uma loja mantém nenhuma ou várias posições de estoque. Cada posição é de exatamente uma loja.", False),
    ("Produto", "Posição de estoque", "estoque.produto_id", "1 : 0..N",
     "Um produto tem nenhuma ou várias posições (uma por loja). Cada posição é de exatamente um produto.", False),
    ("Posição de estoque", "Lote de validade", "validades.estoque_id", "1 : 0..N",
     "Uma posição de estoque tem nenhum ou vários lotes. Cada lote pertence a exatamente uma posição.", False),
    ("Loja / login", "Contagem (loja contada)", "contagens.loja_id", "1 : 0..N",
     "Uma loja é contada em nenhuma ou várias parcelas. Cada parcela é de exatamente uma loja.", False),
    ("Loja / login", "Contagem (autor)", "contagens.criado_por_id", "1 : 0..N",
     "Um login registra nenhuma ou várias parcelas. Cada parcela tem exatamente um autor.", False),
    ("Produto", "Contagem de auditoria", "contagens.produto_id", "1 : 0..N",
     "Um produto é contado em nenhuma ou várias parcelas. Cada parcela é de exatamente um produto.", False),
    ("Loja / login", "Registro de quebra (dona)", "quebras.loja_id", "1 : 0..N",
     "Uma loja registra nenhuma ou várias quebras. Cada quebra é de exatamente uma loja.", False),
    ("Loja / login", "Registro de quebra (autor)", "quebras.criado_por_id", "1 : 0..N",
     "Um login é autor de nenhuma ou várias quebras. Cada quebra tem exatamente um autor.", False),
    ("Produto", "Registro de quebra", "quebras.produto_id", "0..1 : 0..N",
     "Um produto aparece em nenhuma ou várias quebras. Uma quebra tem nenhum ou um produto do cadastro.", False),
    ("Motivo da quebra", "Registro de quebra", "quebras.motivo_id", "1 : 0..N",
     "Um motivo classifica nenhuma ou várias quebras. Cada quebra tem exatamente um motivo.", False),
    ("Origem da quebra", "Registro de quebra", "quebras.origem_id", "1 : 0..N",
     "Uma origem classifica nenhuma ou várias quebras. Cada quebra tem exatamente uma origem.", False),
    ("Lote de validade", "Registro de quebra", "quebras.origem_lote_id", "0..1 : 0..N",
     "Um lote origina nenhuma ou várias quebras. Uma quebra tem nenhum ou um lote de origem.", False),
    ("Registro de quebra", "Anexo", "anexos.quebra_id", "1 : 0..N",
     "Uma quebra tem nenhum ou vários anexos. Cada anexo pertence a exatamente uma quebra.", False),
    ("Loja / login", "Pedido (loja que vende)", "pedidos.loja_id", "1 : 0..N",
     "Uma loja vende nenhum ou vários pedidos. Cada pedido é de exatamente uma loja.", False),
    ("Loja / login", "Pedido (autor)", "pedidos.criado_por_id", "1 : 0..N",
     "Um login cria nenhum ou vários pedidos. Cada pedido tem exatamente um autor.", False),
    ("Pedido", "Item do pedido", "pedido_itens.pedido_id", "1 : 0..N",
     "Um pedido contém nenhum ou vários itens. Cada item pertence a exatamente um pedido.", False),
    ("Produto", "Item do pedido", "pedido_itens.produto_id", "0..1 : 0..N",
     "Um produto é vendido em nenhum ou vários itens. Um item tem nenhum ou um produto (nulo se o produto for excluído).", False),
    ("Posição de estoque", "Registro de quebra", "loja_id + produto_id (consulta)", "0..1 : 0..N",
     "Uma posição de estoque fornece saldo e custo a nenhuma ou várias quebras da mesma loja e produto. "
     "Uma quebra corresponde a nenhuma ou uma posição.", True),
    ("Posição de estoque", "Contagem de auditoria", "loja_id + produto_id (consulta)", "0..1 : 0..N",
     "Uma posição de estoque é comparada com nenhuma ou várias parcelas da mesma loja e produto.", True),
    ("Posição de estoque", "Item do pedido", "pedidos.loja_id + produto_id (cópia)", "0..1 : 0..N",
     "Uma posição de estoque fornece preço e custo a nenhum ou vários itens no momento em que entram.", True),
    ("Anexo", "Arquivo no bucket R2", "anexos.storage_path", "1 : 1",
     "Cada anexo aponta para exatamente um arquivo no bucket, e cada arquivo é de exatamente um anexo.", True),
]

COR_CARD = {"1 : 0..N": "#CCFBF1", "1 : 0..1": "#FEF3C7", "0..1 : 0..N": "#EDE9FE", "1 : 1": "#E5E7EB"}


def tabela_relacoes():
    dados = [[Paragraph("Relacionamento", E_HDR), Paragraph("Chave", E_HDR), Paragraph("Cardinalidade", E_HDR),
              Paragraph("Leitura", E_HDR)]]
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), COR_CAB_TABELA),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, BORDA),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    for i, (de, para, chave, card, leitura, inferida) in enumerate(RELACOES, start=1):
        rel = f"{de} → {para}" + ("  <i>(inferido)</i>" if inferida else "")
        dados.append([Paragraph(rel, E_CEL), Paragraph(chave, E_CEL), Paragraph(card, E_CEL_C), Paragraph(leitura, E_CEL)])
        estilo.append(("BACKGROUND", (2, i), (2, i), colors.HexColor(COR_CARD[card])))
        if inferida:
            estilo.append(("TEXTCOLOR", (0, i), (-1, i), TINTA_SUAVE))
        if i % 2 == 0:
            estilo.append(("BACKGROUND", (0, i), (1, i), colors.HexColor("#F9FAFB")))
            estilo.append(("BACKGROUND", (3, i), (3, i), colors.HexColor("#F9FAFB")))
    t = Table(dados, colWidths=[175, 150, 62, PAGE_W - 2 * MARGIN - 175 - 150 - 62], repeatRows=1)
    t.setStyle(TableStyle(estilo))
    return t


# (regra, onde é garantida, fonte no código)
BANCO, BACK, FRONT = "Banco", "Back-end", "Só front-end"
REGRAS = [
    ("Unicidade", [
        ("E-mail de login único no sistema todo (não por conta).", [BANCO], "M0 lojas.email unique"),
        ("SKU único por conta; código de barras único por conta quando preenchido.", [BANCO],
         "M0 unique (conta_id, sku); índice parcial (conta_id, codigo_barras)"),
        ("Uma posição de estoque por loja e produto.", [BANCO], "M0 unique (loja_id, produto_id)"),
        ("Nome de motivo e de origem único por conta.", [BANCO], "M0 unique (conta_id, label)"),
        ("Número do pedido único e sequencial por loja.", [BANCO], "M8 unique (loja_id, numero) + gatilho pedidos_numerar"),
        ("E-mail do administrador da plataforma e hash de token de e-mail únicos.", [BANCO], "M0, M3 unique"),
        ("Um lote por posição de estoque e data de validade.", [BACK], "validades.ts:110-119 (trava, sem índice único)"),
        ("Um anexo por tipo em cada quebra (o novo substitui o antigo).", [BACK], "anexos.ts:113"),
    ]),
    ("Obrigatoriedade e valores válidos", [
        ("Motivo e origem obrigatórios em toda quebra.", [BANCO, BACK], "M0 not null + quebras.ts:123"),
        ("Saldo, saídas, custo, venda, preço e desconto nunca negativos.", [BANCO, BACK], "M0, M8 check (>= 0)"),
        ("Quantidade: quebra ≥ 0 no banco e na API; a tela exige ≥ 1.", [BANCO, BACK, FRONT],
         "M0 check; quebras.ts:100; QuantityField.tsx:46"),
        ("Item do pedido: quantidade de 1 a 1.000.000; desconto não passa do valor da linha.", [BANCO],
         "M8 check (desconto_tipo, desconto)"),
        ("Telefone do pedido só com dígitos (10 ou 11) ou vazio.", [BANCO, BACK], "M8 check; pedidos.ts:78-82"),
        ("Pedido fechado ⇔ data de fechamento preenchida.", [BANCO], "M8 check (status, fechado_em)"),
        ("Período de saídas do login entre 1 e 3650 dias.", [BANCO, BACK], "M5 check; conta.ts"),
        ("Senha nova com 8+ caracteres, letras e números, até 72 bytes.", [BACK, FRONT], "senha.ts:20; validation.ts:29"),
        ("Anexo só JPG, PNG, WebP, HEIC, HEIF ou PDF, até 10 MB.", [BACK], "anexos.ts:28-31,80"),
        ("Item só entra com preço de venda > 0 no estoque da loja; o preço não muda ao editar.", [BACK],
         "pedidosItens.ts:49-60,88"),
        ("Limites de registros e de MB por conta, conferidos a cada inclusão.", [BANCO], "M6 gatilhos; M7; M8"),
        ("Limite de logins ativos por conta (inclusive ao reativar).", [BACK], "lojas.ts:41-56"),
    ]),
    ("Exclusão", [
        ("Apagar a conta apaga em cascata lojas, produtos, motivos, origens e configurações.", [BANCO],
         "M0 on delete cascade; M9 excluir_conta"),
        ("Apagar a loja apaga estoque, tokens, contagens e pedidos; apagar a posição apaga os lotes; "
         "apagar a quebra apaga os anexos; apagar o pedido apaga os itens.", [BANCO], "M0, M3, M7, M8 on delete cascade"),
        ("Bloqueado: produto com estoque; motivo ou origem em uso; loja com quebras (como dona ou autora) ou com "
         "contagens e pedidos de sua autoria.",
         [BANCO], "M0, M7, M8 on delete restrict"),
        ("Vira nulo: produto da quebra e do item, lote de origem da quebra, loja de origem do produto.", [BANCO],
         "M0, M8 on delete set null"),
        ("Pedido fechado não se altera nem se exclui; é preciso reabrir antes.", [BACK], "lib/pedidos.ts:85-93; pedidos.ts:242-259"),
        ("Excluir todo o estoque exige digitar uma palavra de confirmação.", [FRONT], "DeleteStockDialog.tsx:17,134"),
        ("Excluir a empresa exige o nome dela (e a senha, no caso do cliente); apaga também os arquivos.", [BACK, FRONT],
         "conta.ts; plataforma.ts; exclusaoDeConta.ts"),
    ]),
    ("Acesso", [
        ("Uma conta nunca vê dados de outra; o operador só vê a própria loja.", [BANCO], "M1 RLS forçada em todas as tabelas"),
        ("Só o administrador cria, altera e exclui produtos; o operador só cria produto pendente.", [BANCO, BACK],
         "M1:155-163; M2; produtos.ts"),
        ("Perfil, e-mail e conta do login não mudam depois de criados.", [BANCO], "M4 privilégio por coluna"),
        ("O administrador não desativa o próprio login.", [BACK], "lojas.ts:126-129"),
    ]),
]

COR_ONDE = {BANCO: "#DBEAFE", BACK: "#DCFCE7", FRONT: "#FEE2E2"}


def tabela_regras():
    blocos = []
    for titulo, regras in REGRAS:
        dados = [[Paragraph(titulo, E_HDR), Paragraph("Onde é garantida", E_HDR), Paragraph("Origem no código", E_HDR)]]
        estilo = [
            ("BACKGROUND", (0, 0), (-1, 0), COR_CAB_TABELA),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDA),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ]
        for i, (regra, onde, fonte) in enumerate(regras, start=1):
            # "Só front-end" só faz sentido sozinho; junto de outra camada, é "Front-end".
            nomes = [("Front-end" if o == FRONT and len(onde) > 1 else o) for o in onde]
            chips = " ".join(
                f'<font backColor="{COR_ONDE[o]}">&nbsp;{n}&nbsp;</font>' for o, n in zip(onde, nomes)
            )
            dados.append([Paragraph(regra, E_CEL), Paragraph(chips, E_CEL), Paragraph(fonte, E_CEL)])
        t = Table(dados, colWidths=[400, 140, PAGE_W - 2 * MARGIN - 540], repeatRows=1)
        t.setStyle(TableStyle(estilo))
        blocos.append(KeepTogether([t, Spacer(1, 6)]))
    return blocos


INFERIDOS = [
    "<b>Posição de estoque → Registro de quebra:</b> a lista de quebras busca saldo e custo pela mesma loja e "
    "produto (<i>quebras.ts:45-49</i>); não há chave estrangeira entre as duas tabelas.",
    "<b>Posição de estoque → Contagem de auditoria:</b> a auditoria junta as duas por loja e produto "
    "(<i>auditoria.ts:47</i>).",
    "<b>Posição de estoque → Item do pedido:</b> preço e custo são copiados do estoque da loja do pedido no "
    "momento em que o item entra (<i>pedidosItens.ts:49-57</i>).",
    "<b>Anexo → Arquivo no bucket R2:</b> o vínculo é o texto <i>storage_path</i> "
    "(conta/quebra/anexo, <i>anexos.ts:21-23</i>); o banco não sabe se o arquivo existe.",
]

ATENCAO = [
    ("Tabelas e campos sem relacionamento ou sem uso", [
        "<b>administradores_plataforma</b> e <b>changelog</b> não se ligam a nenhuma outra tabela. O <i>changelog</i> "
        "não é lido nem escrito por nenhuma rota ou tela.",
        "<b>quebras.origem_lote_id</b> tem chave estrangeira, mas nenhuma rota ou tela grava ou lê o campo.",
        "Todo campo terminado em <i>_id</i> tem chave estrangeira declarada; os vínculos tracejados do diagrama são "
        "ligações feitas só por consulta, listadas na seção \"Inferidos\".",
    ]),
    ("Regras que existem só no front-end (ou só no back-end)", [
        "<b>Só na tela:</b> quantidade de quebra a partir de 1 (a API aceita 0); aviso de quantidade acima do saldo, "
        "na quebra e no pedido (nada impede); palavra de confirmação para excluir todo o estoque; a situação do lote "
        "(venceu, vence antes de vender, vende antes, sem estimativa) é calculada só na tela e não é gravada; a "
        "redução da foto antes do envio.",
        "<b>Só no back-end, sem garantia no banco:</b> lote único por data; pedido fechado imutável; pedido sem itens "
        "não fecha; limite de logins; um anexo por tipo; tipos e tamanho de arquivo; editar produto encerra a "
        "pendência; o administrador não desativa o próprio login.",
    ]),
    ("Campos sem restrição no banco", [
        "Textos sem limite de tamanho nem formato: <i>contas.nome</i>, <i>lojas.nome</i>, <i>lojas.email</i> "
        "(sem verificação de formato nem de minúsculas), <i>produtos.sku</i>, <i>produtos.descricao</i>, "
        "<i>produtos.codigo_barras</i>, <i>motivos.label</i>, <i>origens.label</i>, <i>quebras.sku</i>, "
        "<i>quebras.descricao</i>, <i>quebras.observacao</i>, <i>anexos.nome_arquivo</i>, <i>anexos.mime_type</i> "
        "e <i>anexos.storage_path</i>. Os limites existem só nas rotas.",
        "<i>configuracoes_conta.limite_usuarios</i> e <i>limite_armazenamento_mb</i> aceitam zero ou negativo no "
        "banco (só <i>limite_registros</i> tem verificação).",
        "<i>validades.data_validade</i> é opcional e pode se repetir na mesma posição de estoque.",
        "<i>quebras.sku</i>, <i>descricao</i> e <i>codigo_barras</i> são cópias digitadas, sem vínculo com o cadastro.",
    ]),
    ("Dados sensíveis", [
        "<b>Imagens e documentos:</b> fotos de produto e de etiqueta e PDFs dos anexos ficam no bucket R2 da "
        "Cloudflare, fora do banco; o banco guarda nome, tipo, tamanho e caminho. Antes do envio, o rascunho e as "
        "fotos ficam no aparelho (localStorage e IndexedDB). Fotos que não passam pela redução podem levar a "
        "localização (EXIF) — inferência a partir de <i>image.ts</i>.",
        "<b>Dados pessoais de clientes finais:</b> nome, telefone e observação livre em <i>pedidos</i>.",
        "<b>Dados de quem usa o sistema:</b> nome e e-mail em <i>lojas</i> e <i>administradores_plataforma</i>; "
        "senha guardada só como hash (bcrypt); tokens de e-mail só como hash (SHA-256).",
        "<b>Dados comerciais:</b> custo e preço de venda em <i>estoque</i> e <i>pedido_itens</i>.",
        "<b>Saúde e crianças:</b> o modelo não tem nenhum campo de saúde nem de dados de crianças.",
    ]),
]


def historia_texto():
    s = []
    s.append(Paragraph("Relacionamentos e regras de integridade", E_TIT))
    s.append(Paragraph("Leitura de cada relacionamento, como está no código (backend/migrations M0 a M9 e rotas em "
                       "backend/src/rotas). Linhas em cinza são vínculos inferidos, sem chave estrangeira.", E_SUB))
    s.append(tabela_relacoes())
    s.append(PageBreak())
    s.append(Paragraph("Regras de integridade e onde cada uma é garantida", E_TIT))
    s.append(Paragraph('Banco = constraint, gatilho, função ou RLS. Back-end = código das rotas. Só front-end = a tela '
                       'avisa ou impede, mas a API aceita.', E_SUB))
    s.extend(tabela_regras())
    # Sem quebra de página: a última tabela de regras é curta, e a página ficaria quase
    # vazia. Cada seção fica inteira (título junto com os itens).
    s.append(Spacer(1, 6))
    s.append(KeepTogether([Paragraph("Pontos de atenção", E_TIT),
                           Paragraph("Descrição do estado atual, sem propostas de correção.", E_SUB)]))
    for titulo, itens in ATENCAO + [("Vínculos marcados como inferidos", INFERIDOS)]:
        s.append(KeepTogether([Paragraph(titulo, E_H2)] + [Paragraph(i, E_ITEM, bulletText="•") for i in itens]))
    return s


# ---------------------------------------------------------------------------
# Montagem
# ---------------------------------------------------------------------------

DIAGRAMAS = [pagina_visao_geral, pagina_conta, pagina_estoque, pagina_quebras, pagina_pedidos]


def montar(total_paginas):
    def rodape(c, doc):
        c.saveState()
        c.setFillColor(TINTA_SUAVE)
        c.setFont("Sans", 7)
        c.drawRightString(PAGE_W - MARGIN, 26, f"Página {doc.page} de {total_paginas or '?'}")
        if doc.page > 1:
            c.drawString(MARGIN, 26, "Gestão de Validades — modelagem de dados gerada a partir de backend/migrations "
                                     "(M0 = 1700000000000_schema.sql … M9 = 1700000000009_plataforma_e_exclusao_de_conta.sql)")
        c.restoreState()

    def pagina_de(funcao):
        def ao_desenhar(c, doc):
            funcao(c)
            rodape(c, doc)
        return ao_desenhar

    doc = BaseDocTemplate(SAIDA, pagesize=(PAGE_W, PAGE_H), leftMargin=MARGIN, rightMargin=MARGIN,
                          topMargin=MARGIN, bottomMargin=44, title="Gestão de Validades — Modelagem de dados",
                          author="Gestão de Validades")
    quadro = Frame(MARGIN, 44, PAGE_W - 2 * MARGIN, PAGE_H - MARGIN - 44, id="quadro",
                   leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    modelos = [PageTemplate(id=f"diagrama{i}", frames=[quadro], onPage=pagina_de(f)) for i, f in enumerate(DIAGRAMAS)]
    modelos.append(PageTemplate(id="texto", frames=[quadro], onPage=rodape))
    doc.addPageTemplates(modelos)

    historia = []
    for i in range(len(DIAGRAMAS)):
        # A página de diagrama é desenhada inteira pelo `onPage`; o quadro só precisa
        # de algo pequeno para a página existir.
        if i > 0:
            historia.append(NextPageTemplate(f"diagrama{i}"))
            historia.append(PageBreak())
        historia.append(Spacer(1, 1))
    historia.append(NextPageTemplate("texto"))
    historia.append(PageBreak())
    historia.extend(historia_texto())
    doc.build(historia)
    return doc.page


if __name__ == "__main__":
    # Duas passadas: a primeira descobre quantas páginas há, para o rodapé dizer "de N".
    total = montar(None)
    montar(total)
    print(f"Gerado: {SAIDA} ({total} páginas)")
