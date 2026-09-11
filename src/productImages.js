class ProductImageManager {
    #dummyJsonUrl = 'https://dummyjson.com';
    #openverseUrl = 'https://api.openverse.org/v1/images/';
    #cacheKey = 'vitrine-ia:product-images:v2';

    #cache = new Map();
    #pending = new Map();

    #productList =
        document.querySelector('#productList');


    constructor() {

        if (!this.#productList) {
            return;
        }


        this.carregarCache();
        this.adicionarEstilos();
        this.observarCatalogo();
        this.decorarCards();
    }


    // =========================================================================
    // OBSERVAR O CATÁLOGO
    // =========================================================================

    observarCatalogo() {

        const observer =
            new MutationObserver(
                () => {
                    this.decorarCards();
                }
            );


        observer.observe(
            this.#productList,
            {
                childList: true,
                subtree: true
            }
        );
    }


    decorarCards() {

        this.#productList
            .querySelectorAll(
                '.product-card'
            )
            .forEach(
                card => {
                    this.decorarCard(card);
                }
            );
    }


    async decorarCard(card) {

        if (
            card.querySelector(
                '.product-image-container'
            )
        ) {

            return;
        }


        // O botão já possui o produto inteiro serializado.
        // Isso é melhor do que tentar descobrir o produto
        // apenas pelo texto visível no card.
        const botaoCompra =
            card.querySelector(
                '.buy-now-btn'
            );


        let produto =
            null;


        try {

            produto =
                JSON.parse(
                    botaoCompra?.dataset?.product
                    ||
                    '{}'
                );

        } catch {

            produto =
                {};
        }


        const nome =
            produto.name
            ||
            card
                .querySelector(
                    '.card-title'
                )
                ?.textContent
                ?.trim();


        const categoria =
            produto.category
            ||
            card
                .querySelector(
                    '.product-category'
                )
                ?.textContent
                ?.trim()
            ||
            '';


        if (!nome) {
            return;
        }


        produto = {
            ...produto,
            name:
                nome,
            category:
                categoria
        };


        // Enquanto a API não responde mostramos um placeholder
        // correto, contendo o nome do próprio produto.
        const fallback =
            this.criarImagemFallback(
                produto
            );


        const container =
            document.createElement(
                'div'
            );


        container.className =
            'product-image-container';


        const imagem =
            document.createElement(
                'img'
            );


        imagem.className =
            'product-image';


        imagem.src =
            fallback;


        imagem.alt =
            `Imagem de ${nome}`;


        imagem.loading =
            'lazy';


        imagem.decoding =
            'async';


        const credito =
            document.createElement(
                'a'
            );


        credito.className =
            'product-image-credit';


        credito.href =
            'https://dummyjson.com/docs/image';


        credito.target =
            '_blank';


        credito.rel =
            'noopener noreferrer';


        credito.textContent =
            'Buscando imagem...';


        imagem.addEventListener(
            'error',
            () => {

                // Se a foto externa quebrar,
                // nunca deixamos uma imagem quebrada no card.
                imagem.src =
                    fallback;


                credito.textContent =
                    'Imagem ilustrativa';


                credito.href =
                    'https://dummyjson.com/docs/image';
            }
        );


        container.append(
            imagem,
            credito
        );


        card.prepend(
            container
        );


        const resultado =
            await this.obterImagem(
                produto
            );


        // A paginação pode remover esse card
        // antes da API responder.
        if (!card.isConnected) {
            return;
        }


        imagem.src =
            resultado.url;


        credito.textContent =
            resultado.credito;


        credito.href =
            resultado.pagina;
    }


    // =========================================================================
    // OBTER IMAGEM
    // =========================================================================

    async obterImagem(produto) {

        const configuracao =
            this.obterConfiguracaoProduto(
                produto
            );


        // Produtos do mesmo TIPO compartilham cache.
        // Exemplo:
        // Fones de Ouvido Sem Fio / Headset Gamer
        // podem utilizar a mesma foto de headphones.
        const chave =
            configuracao.chave;


        if (
            this.#cache.has(
                chave
            )
        ) {

            return this.#cache.get(
                chave
            );
        }


        if (
            this.#pending.has(
                chave
            )
        ) {

            return await this.#pending.get(
                chave
            );
        }


        const busca =
            this.buscarImagemConfiavel(
                produto,
                configuracao
            );


        this.#pending.set(
            chave,
            busca
        );


        try {

            const resultado =
                await busca;


            this.#cache.set(
                chave,
                resultado
            );


            this.salvarCache();


            return resultado;

        } finally {

            this.#pending.delete(
                chave
            );
        }
    }


    async buscarImagemConfiavel(
        produto,
        configuracao
    ) {

        // 1 — DUMMYJSON
        // Primeiro tentamos uma API de catálogo.
        // As imagens normalmente possuem aparência mais próxima de e-commerce.
        try {

            const imagemDummyJson =
                await this.buscarNoDummyJson(
                    configuracao
                );


            if (imagemDummyJson) {

                return imagemDummyJson;
            }

        } catch (erro) {

            console.warn(
                `DummyJSON indisponível para "${produto.name}".`,
                erro
            );
        }


        // 2 — OPENVERSE COM VALIDAÇÃO
        // O código antigo pegava simplesmente o primeiro resultado.
        // Agora só aceitamos uma imagem quando os metadados realmente
        // indicam que é aquele tipo de objeto.
        try {

            const imagemOpenverse =
                await this.buscarNoOpenverse(
                    configuracao
                );


            if (imagemOpenverse) {

                return imagemOpenverse;
            }

        } catch (erro) {

            console.warn(
                `Openverse indisponível para "${produto.name}".`,
                erro
            );
        }


        // 3 — FALLBACK
        // Uma imagem neutra e correta é melhor do que uma fotografia errada.
        return {
            url:
                this.criarImagemFallback(
                    produto
                ),

            credito:
                'Imagem ilustrativa',

            pagina:
                'https://dummyjson.com/docs/image'
        };
    }


    // =========================================================================
    // DUMMYJSON
    // =========================================================================

    async buscarNoDummyJson(
        configuracao
    ) {

        for (
            const termo
            of
            configuracao.buscas
        ) {

            const url =
                `${this.#dummyJsonUrl}/products/search`
                +
                `?q=${encodeURIComponent(termo)}`
                +
                '&limit=12'
                +
                '&select=title,thumbnail,images,category,tags';


            const dados =
                await this.buscarJson(
                    url
                );


            const produtos =
                Array.isArray(
                    dados?.products
                )
                    ? dados.products
                    : [];


            const melhor =
                this.escolherMelhorResultado(
                    produtos,
                    configuracao
                );


            if (melhor) {

                const imagem =
                    melhor.thumbnail
                    ||
                    melhor.images?.[0];


                if (!imagem) {
                    continue;
                }


                return {
                    url:
                        imagem,

                    credito:
                        'Imagem: DummyJSON',

                    pagina:
                        'https://dummyjson.com/docs/products'
                };
            }
        }


        return null;
    }


    // =========================================================================
    // OPENVERSE
    // =========================================================================

    async buscarNoOpenverse(
        configuracao
    ) {

        const termo =
            configuracao.buscas[0];


        const url =
            new URL(
                this.#openverseUrl
            );


        url.searchParams.set(
            'q',
            termo
        );


        // Buscamos vários candidatos e validamos antes de escolher.
        url.searchParams.set(
            'page_size',
            '20'
        );


        const dados =
            await this.buscarJson(
                url.toString()
            );


        const resultados =
            Array.isArray(
                dados?.results
            )
                ? dados.results
                : [];


        const candidatos =
            resultados
                .map(
                    item => {

                        const texto =
                            this.normalizarTexto(
                                [
                                    item.title,
                                    item.creator,
                                    item.source,
                                    ...(Array.isArray(item.tags)
                                        ? item.tags.map(
                                            tag =>
                                                typeof tag === 'string'
                                                    ? tag
                                                    : tag?.name
                                        )
                                        : [])
                                ]
                                    .filter(Boolean)
                                    .join(' ')
                            );


                        return {
                            item,
                            pontos:
                                this.calcularPontuacao(
                                    texto,
                                    configuracao
                                )
                        };
                    }
                )

                .filter(
                    candidato =>
                        candidato.pontos
                        >=
                        configuracao.pontuacaoMinimaOpenverse
                )

                .sort(
                    (a, b) =>
                        b.pontos
                        -
                        a.pontos
                );


        const melhor =
            candidatos[0]?.item;


        const imagem =
            melhor?.thumbnail
            ||
            melhor?.url;


        if (!imagem) {

            return null;
        }


        const autor =
            melhor.creator
                ? ` · ${melhor.creator}`
                : '';


        const licenca =
            melhor.license
                ? ` · ${String(melhor.license).toUpperCase()}`
                : '';


        return {
            url:
                imagem,

            credito:
                `Openverse${autor}${licenca}`,

            pagina:
                melhor.foreign_landing_url
                ||
                melhor.url
                ||
                'https://openverse.org/'
        };
    }


    // =========================================================================
    // ESCOLHER RESULTADO
    // =========================================================================

    escolherMelhorResultado(
        produtos,
        configuracao
    ) {

        const candidatos =
            produtos
                .map(
                    produto => {

                        const texto =
                            this.normalizarTexto(
                                [
                                    produto.title,
                                    produto.category,
                                    ...(produto.tags || [])
                                ]
                                    .filter(Boolean)
                                    .join(' ')
                            );


                        return {
                            produto,
                            pontos:
                                this.calcularPontuacao(
                                    texto,
                                    configuracao
                                )
                        };
                    }
                )

                .filter(
                    candidato =>
                        candidato.pontos
                        >=
                        configuracao.pontuacaoMinimaDummyJson
                )

                .sort(
                    (a, b) =>
                        b.pontos
                        -
                        a.pontos
                );


        return candidatos[0]?.produto
            ||
            null;
    }


    calcularPontuacao(
        texto,
        configuracao
    ) {

        let pontos =
            0;


        configuracao.termosObrigatorios
            .forEach(
                grupo => {

                    const encontrou =
                        grupo.some(
                            termo =>
                                texto.includes(
                                    this.normalizarTexto(
                                        termo
                                    )
                                )
                        );


                    if (encontrou) {

                        pontos +=
                            10;
                    }
                }
            );


        configuracao.termosDesejaveis
            .forEach(
                termo => {

                    if (
                        texto.includes(
                            this.normalizarTexto(
                                termo
                            )
                        )
                    ) {

                        pontos +=
                            2;
                    }
                }
            );


        return pontos;
    }


    // =========================================================================
    // CONFIGURAÇÃO DOS PRODUTOS
    // =========================================================================

    obterConfiguracaoProduto(
        produto
    ) {

        const nome =
            this.normalizarTexto(
                produto.name
            );


        const regras = [
            this.regra(/fone|headset/, 'headphones', ['airpods max', 'headphones'], [['airpods', 'headphone', 'headphones', 'headset']], ['audio', 'wireless']),
            this.regra(/relogio inteligente|pulseira inteligente|relogio para corrida/, 'smart-watch', ['watch'], [['watch', 'smartwatch']], ['wrist']),
            this.regra(/relogio analogico/, 'analog-watch', ['mens watch', 'womens watch', 'watch'], [['watch']], []),
            this.regra(/caixa de som/, 'speaker', ['speaker'], [['speaker']], ['bluetooth', 'audio']),
            this.regra(/teclado/, 'keyboard', ['keyboard'], [['keyboard']], ['computer', 'gaming']),
            this.regra(/mouse gamer/, 'computer-mouse', ['mouse'], [['mouse']], ['computer', 'wireless']),
            this.regra(/monitor led/, 'monitor', ['monitor'], [['monitor', 'display']], ['computer', 'screen']),
            this.regra(/webcam/, 'webcam', ['webcam', 'web camera'], [['webcam', 'web camera']], ['camera', 'computer']),
            this.regra(/carregador/, 'charger', ['charger', 'charging cable'], [['charger', 'charging']], ['usb', 'adapter']),
            this.regra(/power bank/, 'power-bank', ['power bank', 'battery charger'], [['power bank', 'portable battery']], ['battery', 'charger']),
            this.regra(/hub usb/, 'usb-hub', ['usb hub'], [['usb hub', 'hub']], ['usb']),
            this.regra(/suporte para notebook/, 'laptop-stand', ['laptop stand'], [['laptop stand', 'notebook stand']], ['laptop', 'stand']),
            this.regra(/tablet/, 'tablet', ['tablet'], [['tablet']], []),
            this.regra(/cabo usb/, 'usb-cable', ['usb cable', 'charging cable'], [['cable']], ['usb']),
            this.regra(/camisa polo/, 'polo-shirt', ['polo shirt', 'mens shirt'], [['shirt', 'polo']], ['mens']),
            this.regra(/moletom/, 'hoodie', ['hoodie'], [['hoodie']], []),
            this.regra(/jaqueta/, 'jacket', ['jacket'], [['jacket']], []),
            this.regra(/bermuda/, 'shorts', ['shorts'], [['shorts']], []),
            this.regra(/camiseta/, 't-shirt', ['t shirt', 'shirt'], [['shirt', 't shirt']], []),
            this.regra(/calca jeans/, 'jeans', ['jeans'], [['jeans', 'denim']], ['pants']),
            this.regra(/calca jogger/, 'jogger-pants', ['pants'], [['pants', 'trousers', 'jogger']], []),
            this.regra(/camisa social/, 'dress-shirt', ['mens shirt'], [['shirt']], ['mens']),
            this.regra(/vestido/, 'dress', ['dress'], [['dress']], []),
            this.regra(/saia/, 'skirt', ['skirt'], [['skirt']], []),
            this.regra(/blusa de trico/, 'sweater', ['sweater', 'top'], [['sweater', 'top']], []),
            this.regra(/tenis|sapatenis/, 'sneakers', ['shoes', 'sneakers'], [['shoe', 'shoes', 'sneaker', 'sneakers']], []),
            this.regra(/bota/, 'boots', ['boots'], [['boot', 'boots']], []),
            this.regra(/chinelo/, 'flip-flops', ['shoes'], [['flip flop', 'slipper', 'sandal']], []),
            this.regra(/sapato social/, 'dress-shoes', ['mens shoes'], [['shoe', 'shoes']], ['mens']),
            this.regra(/sandalia/, 'sandals', ['womens shoes', 'shoes'], [['sandal', 'sandals']], []),
            this.regra(/sapatilha/, 'flat-shoes', ['womens shoes'], [['shoe', 'shoes', 'flat']], ['womens']),
            this.regra(/bone/, 'cap', ['cap'], [['cap', 'hat']], []),
            this.regra(/oculos de sol/, 'sunglasses', ['sunglasses'], [['sunglasses']], []),
            this.regra(/carteira/, 'wallet', ['wallet'], [['wallet']], []),
            this.regra(/cinto/, 'belt', ['belt'], [['belt']], []),
            this.regra(/bolsa transversal/, 'bag', ['bag'], [['bag']], []),
            this.regra(/mochila/, 'backpack', ['backpack'], [['backpack']], []),
            this.regra(/garrafa termica/, 'thermos', ['bottle'], [['bottle', 'thermos']], []),
            this.regra(/porta-cartoes/, 'card-holder', ['card holder'], [['card holder']], []),
            this.regra(/guarda-chuva/, 'umbrella', ['umbrella'], [['umbrella']], []),
            this.regra(/necessaire/, 'toiletry-bag', ['bag'], [['bag']], ['beauty']),
            this.regra(/air fryer/, 'air-fryer', ['air fryer', 'fryer'], [['fryer']], ['kitchen']),
            this.regra(/cafeteira/, 'coffee-maker', ['coffee maker'], [['coffee']], ['maker']),
            this.regra(/liquidificador/, 'blender', ['blender'], [['blender']], []),
            this.regra(/jogo de panelas/, 'cookware', ['cookware', 'pan'], [['pan', 'cookware', 'pot']], []),
            this.regra(/kit de facas/, 'kitchen-knives', ['knife'], [['knife', 'knives']], []),
            this.regra(/panela de pressao/, 'pressure-cooker', ['pressure cooker', 'cooker'], [['cooker']], []),
            this.regra(/sanduicheira/, 'sandwich-maker', ['sandwich maker'], [['sandwich']], ['maker']),
            this.regra(/balanca digital de cozinha/, 'kitchen-scale', ['kitchen scale', 'scale'], [['scale']], ['kitchen']),
            this.regra(/jarra de vidro/, 'glass-pitcher', ['pitcher', 'jug'], [['pitcher', 'jug']], ['glass']),
            this.regra(/conjunto de potes/, 'food-containers', ['container'], [['container']], ['kitchen']),
            this.regra(/cadeira de escritorio/, 'office-chair', ['chair'], [['chair']], ['office']),
            this.regra(/luminaria de mesa/, 'desk-lamp', ['lamp'], [['lamp']], ['desk']),
            this.regra(/caderno executivo/, 'notebook-stationery', ['notebook'], [['notebook']], ['paper']),
            this.regra(/kit de canetas/, 'pens', ['pen'], [['pen', 'pens']], []),
            this.regra(/organizador de mesa/, 'desk-organizer', ['organizer'], [['organizer']], ['desk']),
            this.regra(/apoio ergonomico/, 'footrest', ['footrest'], [['footrest']], []),
            this.regra(/mousepad/, 'mouse-pad', ['mouse pad'], [['mouse pad', 'mousepad']], []),
            this.regra(/quadro branco/, 'whiteboard', ['whiteboard'], [['whiteboard']], []),
            this.regra(/suporte para monitor/, 'monitor-stand', ['monitor stand'], [['monitor stand']], []),
            this.regra(/pasta executiva/, 'briefcase', ['briefcase'], [['briefcase']], []),
            this.regra(/secador/, 'hair-dryer', ['hair dryer'], [['hair dryer', 'dryer']], ['hair']),
            this.regra(/chapinha/, 'hair-straightener', ['hair straightener'], [['straightener']], ['hair']),
            this.regra(/aparador de barba/, 'beard-trimmer', ['trimmer'], [['trimmer']], ['beard']),
            this.regra(/escova modeladora/, 'hair-brush', ['hair brush'], [['brush']], ['hair']),
            this.regra(/espelho com led/, 'makeup-mirror', ['mirror'], [['mirror']], ['makeup', 'led']),
            this.regra(/kit de pinceis/, 'makeup-brushes', ['makeup'], [['makeup']], ['brush']),
            this.regra(/massageador facial/, 'facial-massager', ['skin care'], [['skin', 'facial', 'face']], []),
            this.regra(/maquina de cortar cabelo/, 'hair-clipper', ['hair clipper', 'trimmer'], [['clipper', 'trimmer']], ['hair']),
            this.regra(/balanca corporal/, 'body-scale', ['scale'], [['scale']], []),
            this.regra(/halter/, 'dumbbells', ['dumbbell'], [['dumbbell', 'weight']], ['fitness']),
            this.regra(/tapete de yoga|colchonete/, 'yoga-mat', ['yoga mat'], [['yoga mat', 'mat']], ['yoga']),
            this.regra(/corda de pular/, 'jump-rope', ['jump rope'], [['jump rope', 'skipping rope']], []),
            this.regra(/bola de futebol/, 'soccer-ball', ['football', 'soccer ball'], [['football', 'soccer']], ['ball']),
            this.regra(/garrafa esportiva/, 'sports-bottle', ['water bottle'], [['bottle']], ['water', 'sports']),
            this.regra(/luvas de academia/, 'gym-gloves', ['fitness gloves', 'gloves'], [['glove', 'gloves']], ['gym', 'fitness']),
            this.regra(/faixa elastica/, 'resistance-bands', ['resistance band'], [['resistance band', 'band']], ['fitness']),
            this.regra(/controle bluetooth|controle arcade/, 'game-controller', ['game controller', 'controller'], [['game controller', 'controller', 'gamepad']], ['gaming']),
            this.regra(/suporte para headset/, 'headset-stand', ['headphone stand'], [['headphone stand', 'headset stand']], []),
            this.regra(/microfone usb/, 'usb-microphone', ['microphone'], [['microphone']], ['usb']),
            this.regra(/cadeira gamer/, 'gaming-chair', ['gaming chair', 'chair'], [['gaming chair']], ['gaming']),
            this.regra(/luminaria pixel/, 'pixel-lamp', ['led lamp'], [['lamp']], ['led'])
        ];


        const encontrada =
            regras.find(
                regra =>
                    regra.regex.test(
                        nome
                    )
            );


        if (encontrada) {

            return encontrada.configuracao;
        }


        const palavrasNome =
            nome
                .split(/\s+/)
                .filter(
                    palavra =>
                        palavra.length >= 5
                )
                .slice(
                    0,
                    2
                );


        return {
            chave:
                `produto-${produto.id || nome}`,

            buscas:
                [
                    produto.name
                ],

            termosObrigatorios:
                [
                    palavrasNome.length
                        ? palavrasNome
                        : [nome]
                ],

            termosDesejaveis:
                [],

            pontuacaoMinimaDummyJson:
                10,

            pontuacaoMinimaOpenverse:
                10
        };
    }


    regra(
        regex,
        chave,
        buscas,
        termosObrigatorios,
        termosDesejaveis
    ) {

        return {
            regex,

            configuracao: {
                chave,
                buscas,
                termosObrigatorios,
                termosDesejaveis,

                pontuacaoMinimaDummyJson:
                    10,

                pontuacaoMinimaOpenverse:
                    10
            }
        };
    }


    // =========================================================================
    // UTILITÁRIOS
    // =========================================================================

    normalizarTexto(
        valor
    ) {

        return String(
            valor
            ||
            ''
        )
            .normalize(
                'NFD'
            )
            .replace(
                /[\u0300-\u036f]/g,
                ''
            )
            .toLowerCase();
    }


    criarImagemFallback(
        produto
    ) {

        const texto =
            encodeURIComponent(
                produto.name
            );


        return (
            `${this.#dummyJsonUrl}/image/800x600/f8fafc/0f172a`
            +
            `?type=webp`
            +
            `&fontSize=30`
            +
            `&text=${texto}`
        );
    }


    async buscarJson(
        url,
        timeoutMs = 4500
    ) {

        const controller =
            new AbortController();


        const timer =
            setTimeout(
                () => {
                    controller.abort();
                },
                timeoutMs
            );


        try {

            const response =
                await fetch(
                    url,
                    {
                        signal:
                            controller.signal
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );
            }


            return await response.json();

        } finally {

            clearTimeout(
                timer
            );
        }
    }


    // =========================================================================
    // CACHE
    // =========================================================================

    carregarCache() {

        try {

            const salvo =
                localStorage.getItem(
                    this.#cacheKey
                );


            if (!salvo) {
                return;
            }


            Object
                .entries(
                    JSON.parse(
                        salvo
                    )
                )
                .forEach(
                    ([chave, valor]) => {

                        this.#cache.set(
                            chave,
                            valor
                        );
                    }
                );

        } catch (erro) {

            console.warn(
                'Não foi possível carregar o cache de imagens.',
                erro
            );
        }
    }


    salvarCache() {

        try {

            localStorage.setItem(
                this.#cacheKey,

                JSON.stringify(
                    Object.fromEntries(
                        this.#cache
                    )
                )
            );

        } catch (erro) {

            console.warn(
                'Não foi possível salvar o cache de imagens.',
                erro
            );
        }
    }


    // =========================================================================
    // ESTILO DAS IMAGENS
    // =========================================================================

    adicionarEstilos() {

        if (
            document.querySelector(
                '#product-image-styles'
            )
        ) {

            return;
        }


        const style =
            document.createElement(
                'style'
            );


        style.id =
            'product-image-styles';


        style.textContent = `
            .product-image-container {
                position: relative;
                width: 100%;
                aspect-ratio: 4 / 3;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                border-bottom: 1px solid var(--cinza-200);
                border-radius: 11px 11px 0 0;
                background: #ffffff;
            }

            .product-image {
                width: 100%;
                height: 100%;
                display: block;
                object-fit: contain;
                padding: 8px;
                background: #ffffff;
                transition: transform .25s ease;
            }

            .product-card:hover .product-image {
                transform: scale(1.025);
            }

            .product-image-credit {
                position: absolute;
                left: 8px;
                bottom: 8px;
                max-width: calc(100% - 16px);
                overflow: hidden;
                padding: 3px 7px;
                border-radius: 999px;
                background: rgba(15, 23, 42, .78);
                color: #ffffff;
                font-size: .55rem;
                line-height: 1.2;
                text-decoration: none;
                text-overflow: ellipsis;
                white-space: nowrap;
                backdrop-filter: blur(4px);
            }

            .product-image-credit:hover {
                color: #ffffff;
                text-decoration: underline;
            }
        `;


        document.head.append(
            style
        );
    }
}


new ProductImageManager();
