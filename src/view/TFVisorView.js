import { View } from './View.js';

export class TFVisorView extends View {

    #logs = [];
    #pontosErro = [];
    #pontosPrecisao = [];

    #painel = document.querySelector('#trainingPanel');
    #corpoPainel = document.querySelector('#trainingPanelBody');

    #botaoOcultar = document.querySelector('#toggleTrainingPanelBtn');
    #botaoExpandir = document.querySelector('#expandTrainingPanelBtn');
    #botaoExibir = document.querySelector('#showTrainingPanelBtn');

    #graficoPrecisao = document.querySelector('#graficoPrecisao');
    #graficoErro = document.querySelector('#graficoErro');

    #metricaEpoca = document.querySelector('#trainingEpochMetric');
    #metricaPrecisao = document.querySelector('#trainingAccuracyMetric');
    #metricaErro = document.querySelector('#trainingLossMetric');

    #estaExpandido = false;


    constructor() {
        super();

        this.configurarEventosPainel();
    }


    /**
     * Configura os botões do painel inferior:
     *
     * - ocultar o painel;
     * - exibir novamente;
     * - aumentar/reduzir a altura.
     */
    configurarEventosPainel() {

        this.#botaoOcultar?.addEventListener(
            'click',
            () => this.ocultarPainel()
        );


        this.#botaoExibir?.addEventListener(
            'click',
            () => this.exibirPainel()
        );


        this.#botaoExpandir?.addEventListener(
            'click',
            () => this.alternarTamanhoPainel()
        );
    }


    /**
     * Limpa os dados visuais antes de um novo treinamento.
     */
    resetDashboard() {

        this.#logs = [];
        this.#pontosErro = [];
        this.#pontosPrecisao = [];

        if (this.#graficoPrecisao) {
            this.#graficoPrecisao.innerHTML = '';
        }

        if (this.#graficoErro) {
            this.#graficoErro.innerHTML = '';
        }

        if (this.#metricaEpoca) {
            this.#metricaEpoca.textContent = '--';
        }

        if (this.#metricaPrecisao) {
            this.#metricaPrecisao.textContent = '--';
        }

        if (this.#metricaErro) {
            this.#metricaErro.textContent = '--';
        }

        this.exibirPainel();
    }


    /**
     * Recebe os dados enviados pelo Worker ao final de cada época.
     *
     * O Worker envia:
     *
     * {
     *     epoch,
     *     loss,
     *     accuracy
     * }
     *
     * Aqui nós:
     *
     * 1. armazenamos o histórico;
     * 2. atualizamos as métricas do cabeçalho;
     * 3. redesenhamos os dois gráficos.
     */
    handleTrainingLog(log) {

        const {
            epoch,
            loss,
            accuracy
        } = log;


        // O TensorFlow normalmente entrega accuracy entre 0 e 1.
        // Para exibição, convertemos para percentual.
        const precisaoPercentual = accuracy * 100;


        this.#pontosPrecisao.push({
            x: epoch + 1,
            y: precisaoPercentual
        });


        this.#pontosErro.push({
            x: epoch + 1,
            y: loss
        });


        this.#logs.push(log);


        this.atualizarMetricas({
            epoca: epoch + 1,
            precisao: precisaoPercentual,
            erro: loss
        });


        this.renderizarGraficos();
    }


    /**
     * Atualiza os três indicadores apresentados
     * no cabeçalho do painel.
     */
    atualizarMetricas({
        epoca,
        precisao,
        erro
    }) {

        if (this.#metricaEpoca) {
            this.#metricaEpoca.textContent = epoca;
        }


        if (this.#metricaPrecisao) {
            this.#metricaPrecisao.textContent =
                `${precisao.toFixed(2)}%`;
        }


        if (this.#metricaErro) {
            this.#metricaErro.textContent =
                erro.toFixed(4);
        }
    }


    /**
     * Renderiza os gráficos diretamente dentro da página.
     *
     * Não usamos mais tfvis.visor().open().
     *
     * O primeiro argumento de tfvis.render.linechart
     * agora é um elemento HTML da nossa interface.
     */
    renderizarGraficos() {

        if (
            !this.#graficoPrecisao
            ||
            !this.#graficoErro
        ) {
            return;
        }


        const alturaGrafico =
            this.#estaExpandido
                ? 430
                : 205;


        tfvis.render.linechart(
            this.#graficoPrecisao,
            {
                values: this.#pontosPrecisao,
                series: ['Precisão']
            },
            {
                xLabel: 'Época',
                yLabel: 'Precisão (%)',
                height: alturaGrafico,
                zoomToFit: true
            }
        );


        tfvis.render.linechart(
            this.#graficoErro,
            {
                values: this.#pontosErro,
                series: ['Erro']
            },
            {
                xLabel: 'Época',
                yLabel: 'Erro',
                height: alturaGrafico,
                zoomToFit: true
            }
        );
    }


    /**
     * Esconde completamente o painel inferior.
     *
     * Quando isso acontece, um pequeno botão "Treinamento"
     * aparece no canto inferior direito.
     */
    ocultarPainel() {

        this.#painel?.classList.add(
            'training-panel-hidden'
        );


        this.#botaoExibir?.classList.add(
            'visible'
        );


        document.body.classList.remove(
            'painel-treinamento-visivel'
        );
    }


    /**
     * Exibe novamente o painel inferior.
     */
    exibirPainel() {

        this.#painel?.classList.remove(
            'training-panel-hidden'
        );


        this.#botaoExibir?.classList.remove(
            'visible'
        );


        document.body.classList.add(
            'painel-treinamento-visivel'
        );


        // Redesenha para adaptar o gráfico ao tamanho atual.
        requestAnimationFrame(
            () => this.renderizarGraficos()
        );
    }


    /**
     * Alterna entre o modo compacto e o modo ampliado.
     */
    alternarTamanhoPainel() {

        this.#estaExpandido =
            !this.#estaExpandido;


        this.#painel?.classList.toggle(
            'training-panel-expanded',
            this.#estaExpandido
        );


        const icone =
            this.#botaoExpandir?.querySelector('i');


        if (icone) {

            icone.className =
                this.#estaExpandido
                    ? 'bi bi-arrows-angle-contract'
                    : 'bi bi-arrows-angle-expand';
        }


        if (this.#botaoExpandir) {

            const texto =
                this.#estaExpandido
                    ? 'Reduzir painel'
                    : 'Aumentar painel';


            this.#botaoExpandir.title = texto;
            this.#botaoExpandir.setAttribute(
                'aria-label',
                texto
            );
        }


        // Espera a animação de altura terminar
        // para recalcular corretamente o tamanho dos gráficos.
        window.setTimeout(
            () => this.renderizarGraficos(),
            220
        );
    }
}
