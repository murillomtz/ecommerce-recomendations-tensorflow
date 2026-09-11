import { View } from './View.js';

export class UserView extends View {

    #userSelect =
        document.querySelector('#userSelect');

    #userAge =
        document.querySelector('#userAge');

    #pastPurchasesList =
        document.querySelector('#pastPurchasesList');

    #purchaseTemplate;

    #onUserSelect;

    #onPurchaseRemove;

    #pastPurchaseElements = [];


    constructor() {
        super();

        this.init();
    }


    async init() {

        // O select pode começar a escutar imediatamente.
        // O template de compras é carregado em paralelo.
        this.attachUserSelectListener();


        this.#purchaseTemplate =
            await this.loadTemplate(
                './src/view/templates/past-purchase.html'
            );
    }


    registerUserSelectCallback(callback) {

        this.#onUserSelect =
            callback;
    }


    registerPurchaseRemoveCallback(callback) {

        this.#onPurchaseRemove =
            callback;
    }


    /**
     * Renderiza as opções do seletor de usuários.
     */
    renderUserOptions(users) {

        const options =
            users
                .map(usuario => {

                    return `
                        <option value="${usuario.id}">
                            ${usuario.name}
                        </option>
                    `;

                })
                .join('');


        this.#userSelect.innerHTML +=
            options;
    }


    /**
     * Mostra os dados básicos do usuário selecionado.
     */
    renderUserDetails(user) {

        this.#userAge.value =
            user.age;
    }


    /**
     * Renderiza o histórico de compras.
     */
    renderPastPurchases(pastPurchases) {

        if (!this.#purchaseTemplate) {
            return;
        }


        if (
            !pastPurchases
            ||
            pastPurchases.length === 0
        ) {

            this.#pastPurchasesList.innerHTML = `
                <div class="col-12">
                    <span class="text-muted small">
                        Nenhuma compra anterior.
                    </span>
                </div>
            `;

            return;
        }


        const html =
            pastPurchases
                .map(produto => {

                    return this.criarHtmlCompra(
                        produto
                    );

                })
                .join('');


        this.#pastPurchasesList.innerHTML =
            html;


        this.attachPurchaseClickHandlers();
    }


    /**
     * Adiciona uma nova compra no topo do histórico.
     */
    addPastPurchase(product) {

        const mensagemSemCompra =
            this.#pastPurchasesList
                .querySelector('.text-muted');


        if (mensagemSemCompra) {

            this.#pastPurchasesList.innerHTML =
                '';
        }


        const purchaseHtml =
            this.criarHtmlCompra(
                product
            );


        this.#pastPurchasesList.insertAdjacentHTML(
            'afterbegin',
            purchaseHtml
        );


        const newPurchase =
            this.#pastPurchasesList
                .firstElementChild
                .querySelector(
                    '.past-purchase'
                );


        newPurchase.classList.add(
            'past-purchase-highlight'
        );


        setTimeout(
            () => {

                newPurchase.classList.remove(
                    'past-purchase-highlight'
                );

            },
            1000
        );


        this.attachPurchaseClickHandlers();
    }


    /**
     * Monta o HTML de uma compra usando o template.
     */
    criarHtmlCompra(produto) {

        return this.replaceTemplate(
            this.#purchaseTemplate,
            {
                ...produto,

                price:
                    this.formatarMoeda(
                        produto.price
                    ),

                product:
                    JSON.stringify(
                        produto
                    )
            }
        );
    }


    /**
     * Escuta a troca de usuário no select.
     */
    attachUserSelectListener() {

        this.#userSelect.addEventListener(
            'change',
            event => {

                const userId =
                    event.target.value
                        ? Number(
                            event.target.value
                        )
                        : null;


                if (userId) {

                    if (this.#onUserSelect) {

                        this.#onUserSelect(
                            userId
                        );
                    }

                    return;
                }


                this.#userAge.value =
                    '';


                this.#pastPurchasesList.innerHTML =
                    '';
            }
        );
    }


    /**
     * Permite remover uma compra clicando no item.
     */
    attachPurchaseClickHandlers() {

        this.#pastPurchaseElements =
            [];


        const purchaseElements =
            document.querySelectorAll(
                '.past-purchase'
            );


        purchaseElements.forEach(
            purchaseElement => {

                this.#pastPurchaseElements.push(
                    purchaseElement
                );


                purchaseElement.onclick =
                    () => {

                        const produto =
                            JSON.parse(
                                purchaseElement.dataset.product
                            );


                        const userId =
                            this.getSelectedUserId();


                        const element =
                            purchaseElement.closest(
                                '.purchase-item'
                            );


                        this.#onPurchaseRemove({
                            element,
                            userId,
                            product: produto
                        });


                        element.style.transition =
                            'opacity 0.5s ease';


                        element.style.opacity =
                            '0';


                        setTimeout(
                            () => {

                                element.remove();


                                if (
                                    document.querySelectorAll(
                                        '.past-purchase'
                                    ).length === 0
                                ) {

                                    this.renderPastPurchases(
                                        []
                                    );
                                }

                            },
                            500
                        );
                    };
            }
        );
    }


    /**
     * Retorna o ID do usuário atualmente selecionado.
     */
    getSelectedUserId() {

        return this.#userSelect.value
            ? Number(
                this.#userSelect.value
            )
            : null;
    }


    /**
     * Formata preço para Real brasileiro.
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
}
