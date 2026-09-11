import { View } from './View.js';

export class ProductView extends View {

    #productList =
        document.querySelector('#productList');

    #productCount =
        document.querySelector('#productCount');

    #buttons;

    #productTemplate;

    #onBuyProduct;

    #inicializacao;


    // =========================================================================
    // PAGINAÇÃO
    // =========================================================================

    // Guarda todos os produtos recebidos.
    //
    // Pode ser:
    //
    // - catálogo normal;
    // - lista de recomendações já ordenada por afinidade.
    #produtos = [];


    // Página que está sendo exibida.
    #paginaAtual = 1;


    // Quantidade máxima de produtos exibidos por página.
    //
    // 100 produtos:
    //
    // 20 por página
    //
    // =
    //
    // 5 páginas.
    #itensPorPagina = 20;


    // Precisamos lembrar se os botões devem continuar desabilitados
    // quando o usuário troca de página.
    #botoesDesabilitados = true;


    // Elemento da paginação.
    #paginacaoContainer = null;


    constructor() {
        super();

        // Guardamos a Promise da inicialização para impedir
        // que o catálogo tente renderizar antes do template carregar.
        this.#inicializacao =
            this.init();
    }


    async init() {

        this.#productTemplate =
            await this.loadTemplate(
                './src/view/templates/product-card.html'
            );


        // A paginação é criada via JavaScript.
        //
        // Dessa forma não precisamos alterar o index.html.
        this.criarContainerPaginacao();
    }


    onUserSelected(user) {

        this.setButtonsState(
            user.id
                ? false
                : true
        );


        this.#botoesDesabilitados =
            user.id
                ? false
                : true;
    }


    registerBuyProductCallback(callback) {

        this.#onBuyProduct =
            callback;
    }


    /**
     * Recebe a lista completa de produtos, guarda em memória
     * e renderiza apenas a primeira página.
     *
     * Esta mesma função é utilizada:
     *
     * - ao abrir o catálogo;
     * - quando chegam as recomendações ordenadas pelo modelo.
     */
    async render(
        products,
        disableButtons = true
    ) {

        await this.#inicializacao;


        this.#produtos =
            Array.isArray(products)
                ? products
                : [];


        this.#paginaAtual =
            1;


        this.#botoesDesabilitados =
            disableButtons;


        this.atualizarQuantidadeProdutos(
            this.#produtos.length
        );


        this.renderizarPaginaAtual();
    }


    /**
     * Renderiza SOMENTE os produtos da página atual.
     *
     * Exemplo:
     *
     * página 1 → produtos 1 até 20
     * página 2 → produtos 21 até 40
     * página 3 → produtos 41 até 60
     */
    renderizarPaginaAtual() {

        const indiceInicial =
            (
                this.#paginaAtual
                -
                1
            )
            *
            this.#itensPorPagina;


        const indiceFinal =
            indiceInicial
            +
            this.#itensPorPagina;


        const produtosDaPagina =
            this.#produtos.slice(
                indiceInicial,
                indiceFinal
            );


        const html =
            produtosDaPagina
                .map(produto => {

                    const score =
                        this.formatarAfinidade(
                            produto.score
                        );


                    return this.replaceTemplate(
                        this.#productTemplate,
                        {
                            id:
                                produto.id,

                            name:
                                produto.name,

                            category:
                                produto.category,

                            price:
                                this.formatarMoeda(
                                    produto.price
                                ),

                            color:
                                produto.color,

                            score,

                            product:
                                JSON.stringify(produto)
                        }
                    );

                })
                .join('');


        this.#productList.innerHTML =
            html;


        this.attachBuyButtonListeners();


        this.setButtonsState(
            this.#botoesDesabilitados
        );


        this.renderizarPaginacao();
    }


    /**
     * Formata o score produzido pela rede neural.
     *
     * Antes:
     *
     * 0.23864
     *
     * Depois:
     *
     * Afinidade: 23,86%
     *
     * Usamos 2 casas decimais para não transformar valores pequenos,
     * por exemplo 0.0008, simplesmente em "0.0%".
     *
     * IMPORTANTE:
     *
     * este número é um SCORE do modelo.
     * Ele serve principalmente para ordenar os produtos.
     * Não deve ser interpretado como uma probabilidade estatística
     * perfeitamente calibrada.
     */
    formatarAfinidade(score) {

        if (
            typeof score !== 'number'
            ||
            !Number.isFinite(score)
        ) {

            return 'Disponível no catálogo';
        }


        const percentual =
            score
            *
            100;


        // Quando existe algum score positivo muito pequeno,
        // mostramos "< 0,01%" em vez de arredondar para 0,00%.
        if (
            percentual > 0
            &&
            percentual < 0.01
        ) {

            return 'Afinidade: < 0,01%';
        }


        return (
            'Afinidade: '
            +
            percentual.toLocaleString(
                'pt-BR',
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )
            +
            '%'
        );
    }


    /**
     * Cria o container da paginação logo abaixo do catálogo.
     *
     * Não é necessário adicionar HTML manualmente no index.html.
     */
    criarContainerPaginacao() {

        if (this.#paginacaoContainer) {
            return;
        }


        const container =
            document.createElement(
                'div'
            );


        container.id =
            'productPagination';


        container.className =
            'catalog-pagination';


        this.#productList.insertAdjacentElement(
            'afterend',
            container
        );


        this.#paginacaoContainer =
            container;
    }


    /**
     * Desenha:
     *
     * ← Anterior
     * 1 2 3 4 5
     * Próxima →
     *
     * e também informa:
     *
     * "Exibindo 1–20 de 100 produtos"
     */
    renderizarPaginacao() {

        if (!this.#paginacaoContainer) {
            return;
        }


        const totalProdutos =
            this.#produtos.length;


        const totalPaginas =
            Math.max(
                1,
                Math.ceil(
                    totalProdutos
                    /
                    this.#itensPorPagina
                )
            );


        // Garante que a página atual nunca fique fora do limite.
        this.#paginaAtual =
            Math.min(
                this.#paginaAtual,
                totalPaginas
            );


        const inicio =
            totalProdutos === 0
                ? 0
                : (
                    (
                        this.#paginaAtual
                        -
                        1
                    )
                    *
                    this.#itensPorPagina
                )
                +
                1;


        const fim =
            Math.min(
                this.#paginaAtual
                *
                this.#itensPorPagina,

                totalProdutos
            );


        const botoesPaginas =
            this.criarBotoesNumericos(
                totalPaginas
            );


        this.#paginacaoContainer.innerHTML = `
            <div class="pagination-summary">
                Exibindo
                <strong>${inicio}–${fim}</strong>
                de
                <strong>${totalProdutos}</strong>
                produtos
            </div>

            <div class="pagination-controls">

                <button
                    type="button"
                    class="pagination-button"
                    data-page="${this.#paginaAtual - 1}"
                    ${this.#paginaAtual === 1 ? 'disabled' : ''}
                >
                    <i class="bi bi-chevron-left"></i>
                    Anterior
                </button>

                <div class="pagination-pages">
                    ${botoesPaginas}
                </div>

                <button
                    type="button"
                    class="pagination-button"
                    data-page="${this.#paginaAtual + 1}"
                    ${this.#paginaAtual === totalPaginas ? 'disabled' : ''}
                >
                    Próxima
                    <i class="bi bi-chevron-right"></i>
                </button>

            </div>
        `;


        this.#paginacaoContainer
            .querySelectorAll(
                '[data-page]'
            )
            .forEach(
                botao => {

                    botao.addEventListener(
                        'click',
                        () => {

                            const pagina =
                                Number(
                                    botao.dataset.page
                                );


                            this.irParaPagina(
                                pagina
                            );
                        }
                    );

                }
            );
    }


    /**
     * Cria os botões numéricos.
     *
     * Como atualmente temos 100 produtos e 20 por página,
     * teremos apenas 5 páginas.
     *
     * Mesmo assim o método já suporta catálogos maiores,
     * exibindo reticências quando necessário.
     */
    criarBotoesNumericos(totalPaginas) {

        const paginas =
            new Set([
                1,
                totalPaginas,
                this.#paginaAtual - 1,
                this.#paginaAtual,
                this.#paginaAtual + 1
            ]);


        const paginasValidas =
            [...paginas]
                .filter(
                    pagina =>
                        pagina >= 1
                        &&
                        pagina <= totalPaginas
                )
                .sort(
                    (a, b) =>
                        a - b
                );


        let paginaAnterior =
            null;


        return paginasValidas
            .map(pagina => {

                let reticencias =
                    '';


                if (
                    paginaAnterior !== null
                    &&
                    pagina
                    -
                    paginaAnterior
                    >
                    1
                ) {

                    reticencias = `
                        <span class="pagination-ellipsis">
                            …
                        </span>
                    `;
                }


                paginaAnterior =
                    pagina;


                return (
                    reticencias
                    +
                    `
                        <button
                            type="button"
                            class="pagination-page ${
                                pagina === this.#paginaAtual
                                    ? 'active'
                                    : ''
                            }"
                            data-page="${pagina}"
                            aria-label="Ir para a página ${pagina}"
                        >
                            ${pagina}
                        </button>
                    `
                );

            })
            .join('');
    }


    /**
     * Troca a página sem recarregar o catálogo inteiro.
     */
    irParaPagina(pagina) {

        const totalPaginas =
            Math.max(
                1,
                Math.ceil(
                    this.#produtos.length
                    /
                    this.#itensPorPagina
                )
            );


        if (
            pagina < 1
            ||
            pagina > totalPaginas
            ||
            pagina === this.#paginaAtual
        ) {

            return;
        }


        this.#paginaAtual =
            pagina;


        this.renderizarPaginaAtual();


        // Leva o usuário novamente para o topo do catálogo.
        this.#productList.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }


    /**
     * Habilita ou desabilita os botões de compra
     * que existem NA PÁGINA ATUAL.
     */
    setButtonsState(disabled) {

        this.#buttons =
            document.querySelectorAll(
                '.buy-now-btn'
            );


        this.#buttons.forEach(
            button => {

                button.disabled =
                    disabled;

            }
        );
    }


    /**
     * Configura o clique nos produtos da página atual.
     */
    attachBuyButtonListeners() {

        this.#buttons =
            document.querySelectorAll(
                '.buy-now-btn'
            );


        this.#buttons.forEach(
            button => {

                button.addEventListener(
                    'click',
                    () => {

                        const produto =
                            JSON.parse(
                                button.dataset.product
                            );


                        const textoOriginal =
                            button.innerHTML;


                        button.innerHTML = `
                            <i class="bi bi-check-circle-fill"></i>
                            Adicionado
                        `;


                        button.classList.remove(
                            'btn-primary'
                        );


                        button.classList.add(
                            'btn-success'
                        );


                        setTimeout(
                            () => {

                                button.innerHTML =
                                    textoOriginal;


                                button.classList.remove(
                                    'btn-success'
                                );


                                button.classList.add(
                                    'btn-primary'
                                );

                            },
                            600
                        );


                        this.#onBuyProduct(
                            produto,
                            button
                        );
                    }
                );

            }
        );
    }


    /**
     * Formata valores para Real brasileiro.
     */
    formatarMoeda(valor) {

        return new Intl.NumberFormat(
            'pt-BR',
            {
                style: 'currency',
                currency: 'BRL'
            }
        )
            .format(valor);
    }


    /**
     * Mantém no topo a quantidade TOTAL de produtos,
     * e não somente os 20 produtos da página atual.
     */
    atualizarQuantidadeProdutos(quantidade) {

        if (!this.#productCount) {
            return;
        }


        this.#productCount.textContent =
            quantidade === 1
                ? '1 produto'
                : `${quantidade} produtos`;
    }
}
