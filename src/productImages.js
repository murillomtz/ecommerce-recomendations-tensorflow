class ProductImageManager {
    #openverseUrl = 'https://api.openverse.org/v1/images/';
    #dummyJsonUrl = 'https://dummyjson.com';
    #cacheKey = 'vitrine-ia:product-images:v1';
    #cache = new Map();
    #pending = new Map();
    #productList = document.querySelector('#productList');

    constructor() {
        if (!this.#productList) return;

        this.carregarCache();
        this.adicionarEstilos();
        this.observarCatalogo();
        this.decorarCards();
    }

    observarCatalogo() {
        const observer = new MutationObserver(() => this.decorarCards());
        observer.observe(this.#productList, { childList: true, subtree: true });
    }

    decorarCards() {
        this.#productList
            .querySelectorAll('.product-card')
            .forEach(card => this.decorarCard(card));
    }

    async decorarCard(card) {
        if (card.querySelector('.product-image-container')) return;

        const nome = card.querySelector('.card-title')?.textContent?.trim();
        const categoria = card.querySelector('.product-category')?.textContent?.trim();
        if (!nome) return;

        const produto = { name: nome, category: categoria || '' };
        const fallback = this.criarImagemFallback(produto);

        const container = document.createElement('div');
        container.className = 'product-image-container';

        const imagem = document.createElement('img');
        imagem.className = 'product-image';
        imagem.src = fallback;
        imagem.alt = `Imagem de ${nome}`;
        imagem.loading = 'lazy';
        imagem.decoding = 'async';
        imagem.dataset.fallback = fallback;

        const credito = document.createElement('a');
        credito.className = 'product-image-credit';
        credito.href = 'https://dummyjson.com/docs/image';
        credito.target = '_blank';
        credito.rel = 'noopener noreferrer';
        credito.textContent = 'Carregando imagem...';

        imagem.addEventListener('error', () => {
            if (imagem.src !== fallback) imagem.src = fallback;
        });

        container.append(imagem, credito);
        card.prepend(container);

        const resultado = await this.obterImagem(produto);

        // O card pode ter saído da página enquanto a API respondia.
        if (!card.isConnected) return;

        imagem.src = resultado.url;
        credito.textContent = resultado.credito;
        credito.href = resultado.pagina;
    }

    async obterImagem(produto) {
        const termo = this.criarTermoBusca(produto);
        const chave = termo.toLowerCase();

        if (this.#cache.has(chave)) return this.#cache.get(chave);
        if (this.#pending.has(chave)) return await this.#pending.get(chave);

        const busca = this.buscarImagemExterna(produto, termo);
        this.#pending.set(chave, busca);

        try {
            const resultado = await busca;
            this.#cache.set(chave, resultado);
            this.salvarCache();
            return resultado;
        } finally {
            this.#pending.delete(chave);
        }
    }

    async buscarImagemExterna(produto, termo) {
        try {
            const imagem = await this.buscarNoOpenverse(termo);
            if (imagem) return imagem;
        } catch (erro) {
            console.warn(`Openverse indisponível para "${termo}".`, erro);
        }

        try {
            const imagem = await this.buscarNoDummyJson(produto, termo);
            if (imagem) return imagem;
        } catch (erro) {
            console.warn(`DummyJSON indisponível para "${termo}".`, erro);
        }

        return {
            url: this.criarImagemFallback(produto),
            credito: 'Imagem ilustrativa',
            pagina: 'https://dummyjson.com/docs/image'
        };
    }

    async buscarNoOpenverse(termo) {
        const url = new URL(this.#openverseUrl);
        url.searchParams.set('q', termo);
        url.searchParams.set('page_size', '1');

        const dados = await this.buscarJson(url.toString());
        const item = dados?.results?.[0];
        const imagem = item?.thumbnail || item?.url;
        if (!imagem) return null;

        const autor = item.creator ? ` · ${item.creator}` : '';
        const licenca = item.license ? ` · ${String(item.license).toUpperCase()}` : '';

        return {
            url: imagem,
            credito: `Openverse${autor}${licenca}`,
            pagina: item.foreign_landing_url || item.url || 'https://openverse.org/'
        };
    }

    async buscarNoDummyJson(produto, termo) {
        const busca = await this.buscarJson(
            `${this.#dummyJsonUrl}/products/search?q=${encodeURIComponent(termo)}&limit=1`
        );

        let item = busca?.products?.[0];

        if (!item) {
            const categoria = this.obterCategoriaDummyJson(produto.category);
            if (categoria) {
                const dados = await this.buscarJson(
                    `${this.#dummyJsonUrl}/products/category/${categoria}?limit=1`
                );
                item = dados?.products?.[0];
            }
        }

        const imagem = item?.thumbnail || item?.images?.[0];
        if (!imagem) return null;

        return {
            url: imagem,
            credito: 'Imagem: DummyJSON',
            pagina: 'https://dummyjson.com/docs/products'
        };
    }

    obterCategoriaDummyJson(categoria) {
        return {
            'eletrônicos': 'mobile-accessories',
            'vestuário': 'mens-shirts',
            'calçados': 'mens-shoes',
            'acessórios': 'sunglasses',
            'casa e cozinha': 'kitchen-accessories',
            'escritório': 'furniture',
            'beleza': 'beauty',
            'esporte': 'sports-accessories',
            'games': 'mobile-accessories'
        }[String(categoria).toLowerCase()];
    }

    criarTermoBusca(produto) {
        const nome = String(produto.name).toLowerCase();

        // Itens do mesmo tipo compartilham o termo e podem repetir a foto.
        const regras = [
            [/fone|headset/, 'headphones product'],
            [/relógio inteligente|pulseira inteligente|relógio para corrida/, 'smartwatch product'],
            [/relógio analógico/, 'wrist watch product'],
            [/caixa de som/, 'bluetooth speaker product'],
            [/teclado|kit gamer teclado/, 'computer keyboard product'],
            [/mousepad/, 'mouse pad product'],
            [/mouse gamer/, 'computer mouse product'],
            [/monitor led/, 'computer monitor product'],
            [/suporte para monitor/, 'monitor stand product'],
            [/webcam/, 'webcam product'],
            [/carregador/, 'usb charger product'],
            [/power bank/, 'power bank product'],
            [/hub usb/, 'usb hub product'],
            [/suporte para notebook/, 'laptop stand product'],
            [/tablet/, 'tablet computer product'],
            [/cabo usb/, 'usb cable product'],
            [/camisa polo/, 'polo shirt'],
            [/moletom/, 'hoodie clothing'],
            [/jaqueta/, 'jacket clothing'],
            [/bermuda/, 'shorts clothing'],
            [/camiseta/, 't shirt clothing'],
            [/calça jogger/, 'jogger pants'],
            [/calça jeans/, 'jeans pants'],
            [/camisa social/, 'dress shirt'],
            [/vestido/, 'dress clothing'],
            [/saia/, 'denim skirt'],
            [/blusa de tricô/, 'sweater clothing'],
            [/tênis|sapatênis/, 'sneakers product'],
            [/bota/, 'boots product'],
            [/chinelo/, 'flip flops product'],
            [/sapato social/, 'dress shoes product'],
            [/sandália/, 'sandals product'],
            [/sapatilha/, 'flat shoes product'],
            [/boné/, 'baseball cap product'],
            [/óculos de sol/, 'sunglasses product'],
            [/carteira/, 'wallet product'],
            [/cinto/, 'leather belt product'],
            [/bolsa transversal/, 'crossbody bag product'],
            [/mochila/, 'backpack product'],
            [/garrafa térmica/, 'thermos bottle product'],
            [/porta-cartões/, 'card holder product'],
            [/guarda-chuva/, 'umbrella product'],
            [/necessaire/, 'toiletry bag product'],
            [/air fryer/, 'air fryer appliance'],
            [/cafeteira/, 'coffee maker appliance'],
            [/liquidificador/, 'blender appliance'],
            [/jogo de panelas/, 'cookware set'],
            [/kit de facas/, 'kitchen knives product'],
            [/panela de pressão/, 'pressure cooker product'],
            [/sanduicheira/, 'sandwich maker appliance'],
            [/balança digital de cozinha/, 'kitchen scale product'],
            [/jarra de vidro/, 'glass pitcher product'],
            [/conjunto de potes/, 'food containers product'],
            [/cadeira de escritório/, 'office chair product'],
            [/luminária de mesa/, 'desk lamp product'],
            [/caderno executivo/, 'notebook stationery'],
            [/kit de canetas/, 'pens stationery'],
            [/organizador de mesa/, 'desk organizer product'],
            [/apoio ergonômico/, 'office footrest product'],
            [/quadro branco/, 'whiteboard product'],
            [/pasta executiva/, 'briefcase product'],
            [/secador/, 'hair dryer product'],
            [/chapinha/, 'hair straightener product'],
            [/aparador de barba/, 'beard trimmer product'],
            [/escova modeladora/, 'hair brush product'],
            [/espelho com led/, 'led makeup mirror product'],
            [/kit de pincéis/, 'makeup brushes product'],
            [/massageador facial/, 'facial massager product'],
            [/máquina de cortar cabelo/, 'hair clipper product'],
            [/balança corporal/, 'bathroom scale product'],
            [/halter/, 'dumbbells fitness'],
            [/tapete de yoga|colchonete/, 'yoga mat fitness'],
            [/corda de pular/, 'jump rope fitness'],
            [/bola de futebol/, 'soccer ball product'],
            [/garrafa esportiva/, 'sports water bottle'],
            [/luvas de academia/, 'gym gloves product'],
            [/faixa elástica/, 'resistance bands fitness'],
            [/controle bluetooth|controle arcade/, 'game controller product'],
            [/suporte para headset/, 'headphone stand product'],
            [/microfone usb/, 'usb microphone product'],
            [/cadeira gamer/, 'gaming chair product'],
            [/luminária pixel/, 'pixel led lamp product']
        ];

        const regra = regras.find(([regex]) => regex.test(nome));
        if (regra) return regra[1];

        return {
            'eletrônicos': 'electronics product',
            'vestuário': 'clothing product',
            'calçados': 'shoes product',
            'acessórios': 'fashion accessory product',
            'casa e cozinha': 'kitchen product',
            'escritório': 'office product',
            'beleza': 'beauty product',
            'esporte': 'sports equipment product',
            'games': 'gaming accessory product'
        }[String(produto.category).toLowerCase()] || 'consumer product';
    }

    criarImagemFallback(produto) {
        const texto = encodeURIComponent(produto.name);
        return `${this.#dummyJsonUrl}/image/600x420/e2e8f0/0f172a?type=webp&text=${texto}`;
    }

    async buscarJson(url, timeoutMs = 4500) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } finally {
            clearTimeout(timer);
        }
    }

    carregarCache() {
        try {
            const salvo = localStorage.getItem(this.#cacheKey);
            if (!salvo) return;
            Object.entries(JSON.parse(salvo)).forEach(([chave, valor]) => {
                this.#cache.set(chave, valor);
            });
        } catch (erro) {
            console.warn('Não foi possível carregar o cache de imagens.', erro);
        }
    }

    salvarCache() {
        try {
            localStorage.setItem(
                this.#cacheKey,
                JSON.stringify(Object.fromEntries(this.#cache))
            );
        } catch (erro) {
            console.warn('Não foi possível salvar o cache de imagens.', erro);
        }
    }

    adicionarEstilos() {
        if (document.querySelector('#product-image-styles')) return;

        const style = document.createElement('style');
        style.id = 'product-image-styles';
        style.textContent = `
            .product-image-container {
                position: relative;
                width: 100%;
                aspect-ratio: 4 / 3;
                overflow: hidden;
                border-bottom: 1px solid var(--cinza-200);
                border-radius: 11px 11px 0 0;
                background: var(--cinza-100);
            }

            .product-image {
                width: 100%;
                height: 100%;
                display: block;
                object-fit: cover;
                transition: transform .25s ease;
            }

            .product-card:hover .product-image {
                transform: scale(1.035);
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
                color: #fff;
                font-size: .55rem;
                line-height: 1.2;
                text-decoration: none;
                text-overflow: ellipsis;
                white-space: nowrap;
                backdrop-filter: blur(4px);
            }

            .product-image-credit:hover {
                color: #fff;
                text-decoration: underline;
            }
        `;

        document.head.append(style);
    }
}

new ProductImageManager();
