import { View } from './View.js';

export class ModelView extends View {

    #trainModelBtn =
        document.querySelector('#trainModelBtn');

    #purchasesArrow =
        document.querySelector('#purchasesArrow');

    #purchasesDiv =
        document.querySelector('#purchasesDiv');

    #allUsersPurchasesList =
        document.querySelector('#allUsersPurchasesList');

    #runRecommendationBtn =
        document.querySelector('#runRecommendationBtn');

    #trainingStatusBadge =
        document.querySelector('#trainingStatusBadge');

    #trainingProgressText =
        document.querySelector('#trainingProgressText');

    #onTrainModel;
    #onRunRecommendation;


    constructor() {
        super();

        this.attachEventListeners();
    }


    registerTrainModelCallback(callback) {
        this.#onTrainModel = callback;
    }


    registerRunRecommendationCallback(callback) {
        this.#onRunRecommendation = callback;
    }


    attachEventListeners() {

        this.#trainModelBtn.addEventListener(
            'click',
            () => {
                this.#onTrainModel();
            }
        );


        this.#runRecommendationBtn.addEventListener(
            'click',
            () => {
                this.#onRunRecommendation();
            }
        );


        this.#purchasesDiv.addEventListener(
            'click',
            () => {

                const purchasesList =
                    this.#allUsersPurchasesList;


                const isHidden =
                    window
                        .getComputedStyle(purchasesList)
                        .display
                    ===
                    'none';


                if (isHidden) {

                    purchasesList.style.display =
                        'block';

                    this.#purchasesArrow.classList.remove(
                        'bi-chevron-down'
                    );

                    this.#purchasesArrow.classList.add(
                        'bi-chevron-up'
                    );

                    return;
                }


                purchasesList.style.display =
                    'none';

                this.#purchasesArrow.classList.remove(
                    'bi-chevron-up'
                );

                this.#purchasesArrow.classList.add(
                    'bi-chevron-down'
                );
            }
        );
    }


    /**
     * Libera o botão de recomendação depois que:
     *
     * - existe um usuário selecionado;
     * - o modelo terminou de treinar.
     */
    enableRecommendButton() {

        this.#runRecommendationBtn.disabled =
            false;
    }


    /**
     * Atualiza visualmente o estado do treinamento.
     *
     * O Worker envia:
     *
     * { progress: 1 }
     *
     * no início e:
     *
     * { progress: 100 }
     *
     * ao finalizar.
     */
    updateTrainingProgress(progress) {

        this.#trainModelBtn.disabled =
            true;


        this.#trainModelBtn.innerHTML = `
            <span
                class="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
            ></span>
            Treinando...
        `;


        this.#trainingStatusBadge.textContent =
            'Treinando';

        this.#trainingStatusBadge.className =
            'status-badge status-training';


        this.#trainingProgressText.textContent =
            'A rede neural está ajustando os pesos';


        if (progress.progress !== 100) {
            return;
        }


        this.#trainModelBtn.disabled =
            false;


        this.#trainModelBtn.innerHTML = `
            <i class="bi bi-cpu"></i>
            Treinar novamente
        `;


        this.#trainingStatusBadge.textContent =
            'Concluído';

        this.#trainingStatusBadge.className =
            'status-badge status-complete';


        this.#trainingProgressText.textContent =
            'Treinamento concluído — modelo pronto para recomendar';
    }


    /**
     * Mostra, de forma compacta, quais compras de cada usuário
     * estão sendo utilizadas como histórico de treinamento.
     */
    renderAllUsersPurchases(users) {

        const html =
            users
                .map(usuario => {

                    const comprasHtml =
                        usuario.purchases
                            .map(compra => {

                                return `
                                    <span
                                        class="badge bg-light text-dark me-1 mb-1"
                                    >
                                        ${compra.name}
                                    </span>
                                `;

                            })
                            .join('');


                    return `
                        <div class="user-purchase-summary">

                            <h6>
                                ${usuario.name}
                                ·
                                ${usuario.age} anos
                            </h6>

                            <div class="purchases-badges">
                                ${
                                    comprasHtml
                                    ||
                                    `
                                        <span class="text-muted">
                                            Nenhuma compra
                                        </span>
                                    `
                                }
                            </div>

                        </div>
                    `;

                })
                .join('');


        this.#allUsersPurchasesList.innerHTML =
            html;
    }
}
