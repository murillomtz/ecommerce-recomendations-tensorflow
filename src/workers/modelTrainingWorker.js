import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';

import {
    workerEvents as eventosWorker
} from '../events/constants.js';


// ============================================================================
// ESTADO GLOBAL DO WORKER
// ============================================================================

// Guarda todas as informações usadas para transformar os dados.
// Exemplo:
// - menor idade
// - maior idade
// - menor preço
// - maior preço
// - categorias existentes
// - cores existentes
// - vetores dos produtos
let _contextoGlobal = {};

// Guarda a rede neural depois que ela for treinada.
let _modelo = null;


// ============================================================================
// CONFIGURAÇÃO DOS PESOS DAS FEATURES
// ============================================================================
//
// Aqui estamos dizendo manualmente quanto cada característica
// deve participar da representação numérica.
//
// IMPORTANTE:
//
// Isso NÃO significa que a rede neural obrigatoriamente dará
// exatamente essa importância para cada informação.
//
// Estamos apenas alterando a escala inicial dos valores enviados
// para a rede.
//
// Categoria = característica que queremos destacar mais.
// Cor       = segunda característica mais importante.
// Preço     = importância intermediária.
// Idade     = menor peso.
// ============================================================================

const PESOS = {
    categoria: 0.4,
    cor: 0.3,
    preco: 0.2,
    idade: 0.1
};


// ============================================================================
// PASSO 1 — NORMALIZAÇÃO
// ============================================================================

/**
 * Converte um número para uma escala entre 0 e 1.
 *
 * Exemplo:
 *
 * preços:
 * 40 até 200
 *
 * produto:
 * 120
 *
 * cálculo:
 *
 * (120 - 40) / (200 - 40)
 *
 * 80 / 160
 *
 * = 0.5
 *
 * Dessa maneira:
 *
 * menor valor → próximo de 0
 * maior valor → próximo de 1
 *
 * Isso evita que valores numericamente grandes, como preço,
 * dominem características pequenas, como valores one-hot.
 */
function normalizar(valor, minimo, maximo) {

    return (
        (valor - minimo) /
        ((maximo - minimo) || 1)
    );
}


// ============================================================================
// PASSO 2 — CRIAR O CONTEXTO DOS DADOS
// ============================================================================

/**
 * Analisa todos os usuários e produtos antes do treinamento.
 *
 * O objetivo é descobrir informações necessárias para
 * transformar nossos objetos JavaScript em números.
 *
 * Exemplo:
 *
 * produto:
 *
 * {
 *     nome: "Tênis",
 *     categoria: "calçados",
 *     cor: "preto",
 *     preco: 150
 * }
 *
 * A rede neural não entende:
 *
 * "calçados"
 * "preto"
 * "Tênis"
 *
 * Então precisamos criar estruturas auxiliares para depois
 * transformar essas informações em números.
 */
function criarContexto(produtos, usuarios) {

    // ------------------------------------------------------------------------
    // Descobrir todas as idades
    // ------------------------------------------------------------------------

    const idades = usuarios.map(
        usuario => usuario.age
    );


    // ------------------------------------------------------------------------
    // Descobrir todos os preços
    // ------------------------------------------------------------------------

    const precos = produtos.map(
        produto => produto.price
    );


    // ------------------------------------------------------------------------
    // Descobrir os limites usados na normalização
    // ------------------------------------------------------------------------

    const menorIdade = Math.min(...idades);
    const maiorIdade = Math.max(...idades);

    const menorPreco = Math.min(...precos);
    const maiorPreco = Math.max(...precos);


    // ------------------------------------------------------------------------
    // Encontrar todas as cores diferentes
    // ------------------------------------------------------------------------
    //
    // Exemplo:
    //
    // [
    //     "preto",
    //     "azul",
    //     "branco"
    // ]
    //
    // Set remove valores repetidos.
    // ------------------------------------------------------------------------

    const cores = [
        ...new Set(
            produtos.map(produto => produto.color)
        )
    ];


    // ------------------------------------------------------------------------
    // Encontrar todas as categorias diferentes
    // ------------------------------------------------------------------------

    const categorias = [
        ...new Set(
            produtos.map(produto => produto.category)
        )
    ];


    // ------------------------------------------------------------------------
    // Criar índice para cada cor
    // ------------------------------------------------------------------------
    //
    // Antes:
    //
    // [
    //     "preto",
    //     "azul",
    //     "branco"
    // ]
    //
    // Depois:
    //
    // {
    //     preto: 0,
    //     azul: 1,
    //     branco: 2
    // }
    //
    // Isso será usado posteriormente pelo One-Hot Encoding.
    // ------------------------------------------------------------------------

    const indiceCores = Object.fromEntries(

        cores.map((cor, indice) => {

            return [
                cor,
                indice
            ];

        })

    );


    // ------------------------------------------------------------------------
    // Criar índice para cada categoria
    // ------------------------------------------------------------------------

    const indiceCategorias = Object.fromEntries(

        categorias.map((categoria, indice) => {

            return [
                categoria,
                indice
            ];

        })

    );


    // ========================================================================
    // CALCULAR A IDADE MÉDIA DOS COMPRADORES DE CADA PRODUTO
    // ========================================================================
    //
    // Exemplo:
    //
    // Fone Bluetooth:
    //
    // João  → 20 anos
    // Maria → 30 anos
    //
    // Média:
    //
    // (20 + 30) / 2
    //
    // = 25 anos
    //
    // Assim podemos representar aproximadamente a faixa etária
    // relacionada a determinado produto.
    // ========================================================================

    const idadeMediaGeral = (
        menorIdade + maiorIdade
    ) / 2;


    // Soma das idades por produto.
    const somaIdadesPorProduto = {};


    // Quantidade de compradores por produto.
    const quantidadeCompradoresPorProduto = {};


    usuarios.forEach(usuario => {

        usuario.purchases.forEach(produtoComprado => {

            const nomeProduto = produtoComprado.name;


            somaIdadesPorProduto[nomeProduto] =
                (
                    somaIdadesPorProduto[nomeProduto] || 0
                )
                +
                usuario.age;


            quantidadeCompradoresPorProduto[nomeProduto] =
                (
                    quantidadeCompradoresPorProduto[nomeProduto] || 0
                )
                +
                1;

        });

    });


    // ========================================================================
    // CALCULAR A IDADE MÉDIA NORMALIZADA POR PRODUTO
    // ========================================================================

    const idadeMediaNormalizadaPorProduto = Object.fromEntries(

        produtos.map(produto => {

            const nomeProduto = produto.name;


            // Se alguém comprou esse produto,
            // calculamos a média real.
            //
            // Caso ninguém tenha comprado,
            // usamos a idade média geral.

            const idadeMedia =
                quantidadeCompradoresPorProduto[nomeProduto]

                    ? somaIdadesPorProduto[nomeProduto]
                        /
                        quantidadeCompradoresPorProduto[nomeProduto]

                    : idadeMediaGeral;


            const idadeNormalizada = normalizar(
                idadeMedia,
                menorIdade,
                maiorIdade
            );


            return [
                nomeProduto,
                idadeNormalizada
            ];

        })

    );


    // ========================================================================
    // QUANTIDADE DE FEATURES
    // ========================================================================
    //
    // Nosso vetor de produto terá:
    //
    // 1 posição → preço
    // 1 posição → idade
    // N posições → categorias
    // N posições → cores
    //
    // Exemplo:
    //
    // 1 preço
    // 1 idade
    // 3 categorias
    // 4 cores
    //
    // Total:
    //
    // 1 + 1 + 3 + 4
    //
    // = 9 números
    // ========================================================================

    const quantidadeDimensoes =
        2
        +
        categorias.length
        +
        cores.length;


    return {

        produtos,
        usuarios,

        indiceCores,
        indiceCategorias,

        idadeMediaNormalizadaPorProduto,

        menorIdade,
        maiorIdade,

        menorPreco,
        maiorPreco,

        quantidadeCategorias: categorias.length,
        quantidadeCores: cores.length,

        quantidadeDimensoes
    };
}


// ============================================================================
// PASSO 3 — ONE-HOT ENCODING
// ============================================================================

/**
 * Transforma uma informação categórica em números.
 *
 * Exemplo:
 *
 * categorias:
 *
 * 0 = eletrônico
 * 1 = vestuário
 * 2 = calçados
 *
 * Produto:
 *
 * calçados
 *
 * vira:
 *
 * [0, 0, 1]
 *
 * Depois aplicamos o peso.
 *
 * Se peso = 0.4:
 *
 * [0, 0, 0.4]
 */
function criarOneHotComPeso(
    indice,
    quantidade,
    peso
) {

    return tf
        .oneHot(
            indice,
            quantidade
        )
        .cast('float32')
        .mul(peso);
}


// ============================================================================
// PASSO 4 — CODIFICAR PRODUTO
// ============================================================================

/**
 * Transforma um produto JavaScript em um vetor numérico.
 *
 * Antes:
 *
 * {
 *     name: "Tênis",
 *     category: "calçados",
 *     price: 150,
 *     color: "preto"
 * }
 *
 * Depois:
 *
 * [
 *     preço,
 *     idade média,
 *     categorias...,
 *     cores...
 * ]
 *
 * A rede neural trabalha somente com essa representação numérica.
 */
function codificarProduto(
    produto,
    contexto
) {

    // ========================================================================
    // PREÇO
    // ========================================================================

    const precoNormalizado = normalizar(
        produto.price,
        contexto.menorPreco,
        contexto.maiorPreco
    );


    const preco = tf.tensor1d([

        precoNormalizado
        *
        PESOS.preco

    ]);


    // ========================================================================
    // IDADE
    // ========================================================================
    //
    // Não usamos diretamente uma idade do produto.
    //
    // Usamos a média das idades das pessoas que compraram
    // esse produto.
    // ========================================================================

    const idadeMediaNormalizada =
        contexto.idadeMediaNormalizadaPorProduto[
            produto.name
        ]
        ??
        0.5;


    const idade = tf.tensor1d([

        idadeMediaNormalizada
        *
        PESOS.idade

    ]);


    // ========================================================================
    // CATEGORIA
    // ========================================================================

    const categoria = criarOneHotComPeso(

        contexto.indiceCategorias[
            produto.category
        ],

        contexto.quantidadeCategorias,

        PESOS.categoria
    );


    // ========================================================================
    // COR
    // ========================================================================

    const cor = criarOneHotComPeso(

        contexto.indiceCores[
            produto.color
        ],

        contexto.quantidadeCores,

        PESOS.cor
    );


    // ========================================================================
    // JUNTAR TUDO EM UM ÚNICO VETOR
    // ========================================================================
    //
    // Exemplo:
    //
    // preço
    // ↓
    // [0.12]
    //
    // idade
    // ↓
    // [0.07]
    //
    // categoria
    // ↓
    // [0, 0.4, 0]
    //
    // cor
    // ↓
    // [0.3, 0, 0]
    //
    // Resultado:
    //
    // [
    //     0.12,
    //     0.07,
    //     0,
    //     0.4,
    //     0,
    //     0.3,
    //     0,
    //     0
    // ]
    // ========================================================================

    return tf.concat1d([

        preco,
        idade,
        categoria,
        cor

    ]);
}


// ============================================================================
// PASSO 5 — CODIFICAR USUÁRIO
// ============================================================================

/**
 * Transforma o comportamento de um usuário em um vetor numérico.
 *
 * Se o usuário possui compras:
 *
 * 1. codificamos cada produto comprado;
 * 2. juntamos os vetores;
 * 3. calculamos a média.
 *
 * Essa média representa aproximadamente o "perfil" daquele usuário.
 *
 *
 * Exemplo:
 *
 * Produto A:
 *
 * [0.2, 0.1, 0.4, 0, 0.3]
 *
 * Produto B:
 *
 * [0.4, 0.1, 0.4, 0, 0]
 *
 * Média:
 *
 * [0.3, 0.1, 0.4, 0, 0.15]
 *
 *
 * Se o usuário ainda não comprou nada:
 *
 * somente a idade será utilizada.
 */
function codificarUsuario(
    usuario,
    contexto
) {

    // ========================================================================
    // USUÁRIO COM HISTÓRICO DE COMPRAS
    // ========================================================================

    if (usuario.purchases.length > 0) {

        // Codifica cada produto comprado.
        const vetoresProdutosComprados =
            usuario.purchases.map(
                produto => {

                    return codificarProduto(
                        produto,
                        contexto
                    );

                }
            );


        // Junta os produtos em uma matriz.
        //
        // Exemplo:
        //
        // [
        //     [produto 1],
        //     [produto 2],
        //     [produto 3]
        // ]
        //
        // Depois calcula a média verticalmente.

        return tf
            .stack(vetoresProdutosComprados)
            .mean(0)
            .reshape([
                1,
                contexto.quantidadeDimensoes
            ]);
    }


    // ========================================================================
    // USUÁRIO SEM HISTÓRICO DE COMPRAS
    // ========================================================================
    //
    // Não sabemos:
    //
    // - preço favorito
    // - categoria favorita
    // - cor favorita
    //
    // Portanto essas informações ficam zeradas.
    //
    // A única informação conhecida é a idade.
    // ========================================================================

    const idadeNormalizada = normalizar(
        usuario.age,
        contexto.menorIdade,
        contexto.maiorIdade
    );


    return tf.concat1d([

        // Preço desconhecido.
        tf.zeros([1]),


        // Idade conhecida.
        tf.tensor1d([

            idadeNormalizada
            *
            PESOS.idade

        ]),


        // Categorias desconhecidas.
        tf.zeros([
            contexto.quantidadeCategorias
        ]),


        // Cores desconhecidas.
        tf.zeros([
            contexto.quantidadeCores
        ])

    ])
        .reshape([
            1,
            contexto.quantidadeDimensoes
        ]);
}


// ============================================================================
// PASSO 6 — CRIAR OS DADOS DE TREINAMENTO
// ============================================================================

/**
 * Aqui transformamos nosso histórico em exemplos para a rede neural.
 *
 * A rede precisa aprender algo parecido com:
 *
 * "Dado este usuário e este produto,
 *  ele compraria esse produto?"
 *
 *
 * Para cada usuário:
 *
 * usuário + produto A → comprou? 1
 * usuário + produto B → comprou? 0
 * usuário + produto C → comprou? 1
 *
 *
 * X = entradas
 *
 * Y = respostas corretas
 *
 *
 * Em Machine Learning normalmente usamos:
 *
 * X → informações usadas para prever
 * Y → resultado esperado
 */
function criarDadosTreinamento(contexto) {

    const entradas = [];
    const rotulos = [];


    // =========================================================================
    // BALANCEAMENTO DO DATASET
    // =========================================================================
    //
    // Depois que o catálogo passou de 10 para 100 produtos,
    // surgiu um problema importante:
    //
    // um usuário possui, por exemplo:
    //
    // 3 produtos comprados
    // 97 produtos não comprados
    //
    // Se enviarmos tudo isso para a rede:
    //
    // positivos = 3
    // negativos = 97
    //
    // A rede descobre que consegue uma accuracy muito alta
    // simplesmente respondendo:
    //
    // "não compraria"
    //
    // para praticamente tudo.
    //
    // Resultado:
    //
    // score próximo de zero para todos os produtos.
    //
    //
    // SOLUÇÃO DIDÁTICA:
    //
    // usar TODOS os exemplos positivos e somente uma quantidade
    // controlada de exemplos negativos.
    //
    // Para cada compra positiva utilizaremos até 3 negativos.
    //
    // Exemplo:
    //
    // 3 positivos
    // 9 negativos
    //
    // Isso deixa o treinamento muito mais equilibrado.
    // =========================================================================

    const QUANTIDADE_NEGATIVOS_POR_POSITIVO =
        3;


    contexto.usuarios

        // Usuários sem nenhuma compra não possuem exemplos positivos
        // para este treinamento supervisionado.
        .filter(
            usuario =>
                usuario.purchases.length > 0
        )

        .forEach(usuario => {

            // -----------------------------------------------------------------
            // Separar produtos comprados e não comprados
            // -----------------------------------------------------------------

            const produtosComprados =
                contexto.produtos.filter(
                    produto => {

                        return usuario.purchases.some(
                            compra =>
                                compra.id === produto.id
                                ||
                                compra.name === produto.name
                        );

                    }
                );


            const produtosNaoComprados =
                contexto.produtos.filter(
                    produto => {

                        return !usuario.purchases.some(
                            compra =>
                                compra.id === produto.id
                                ||
                                compra.name === produto.name
                        );

                    }
                );


            // -----------------------------------------------------------------
            // Selecionar uma amostra de negativos
            // -----------------------------------------------------------------
            //
            // Não pegamos simplesmente os primeiros itens.
            //
            // Como o catálogo está organizado em blocos de categorias,
            // pegamos itens distribuídos ao longo de toda a lista.
            //
            // Isso ajuda a ter negativos de diferentes categorias.
            // -----------------------------------------------------------------

            const quantidadeNegativos =
                Math.min(
                    produtosNaoComprados.length,

                    produtosComprados.length
                    *
                    QUANTIDADE_NEGATIVOS_POR_POSITIVO
                );


            const negativosSelecionados =
                selecionarItensDistribuidos(
                    produtosNaoComprados,
                    quantidadeNegativos
                );


            // -----------------------------------------------------------------
            // Criar exemplos positivos
            // -----------------------------------------------------------------

            produtosComprados.forEach(
                produto => {

                    adicionarExemploTreinamento({
                        usuario,
                        produto,
                        rotulo: 1,
                        contexto,
                        entradas,
                        rotulos,

                        // Para um exemplo positivo, removemos o produto alvo
                        // do histórico usado para montar o vetor do usuário.
                        //
                        // Exemplo:
                        //
                        // Ana comprou:
                        //
                        // Fone
                        // Relógio
                        //
                        // Para ensinar:
                        //
                        // Ana → Relógio = 1
                        //
                        // usamos o perfil da Ana baseado no Fone.
                        //
                        // Isso evita entregar a resposta para a própria rede.
                        removerProdutoAlvoDoHistorico: true
                    });

                }
            );


            // -----------------------------------------------------------------
            // Criar exemplos negativos
            // -----------------------------------------------------------------

            negativosSelecionados.forEach(
                produto => {

                    adicionarExemploTreinamento({
                        usuario,
                        produto,
                        rotulo: 0,
                        contexto,
                        entradas,
                        rotulos,
                        removerProdutoAlvoDoHistorico: false
                    });

                }
            );

        });


    // Mostrar no console como o dataset ficou balanceado.
    const quantidadePositivos =
        rotulos.filter(
            rotulo =>
                rotulo === 1
        ).length;


    const quantidadeNegativos =
        rotulos.filter(
            rotulo =>
                rotulo === 0
        ).length;


    console.log(
        'Dataset balanceado:',
        {
            positivos:
                quantidadePositivos,

            negativos:
                quantidadeNegativos,

            total:
                rotulos.length
        }
    );


    // ========================================================================
    // CONVERTER ARRAYS JAVASCRIPT PARA TENSORES
    // ========================================================================

    const dadosEntrada =
        tf.tensor2d(
            entradas
        );


    const respostasEsperadas =
        tf.tensor2d(
            rotulos,
            [
                rotulos.length,
                1
            ]
        );


    // Cada entrada possui:
    //
    // vetor do usuário
    //
    // +
    //
    // vetor do produto.

    const dimensaoEntrada =
        contexto.quantidadeDimensoes
        *
        2;


    return {
        dadosEntrada,
        respostasEsperadas,
        dimensaoEntrada
    };
}


/**
 * Adiciona UM exemplo no dataset.
 *
 * Entrada:
 *
 * [vetor usuário + vetor produto]
 *
 * Resposta:
 *
 * 1 = comprou
 * 0 = não comprou
 */
function adicionarExemploTreinamento({
    usuario,
    produto,
    rotulo,
    contexto,
    entradas,
    rotulos,
    removerProdutoAlvoDoHistorico
}) {

    let usuarioUsadoNoExemplo =
        usuario;


    // =========================================================================
    // EVITAR VAZAMENTO DA RESPOSTA
    // =========================================================================
    //
    // No código anterior o vetor do usuário era criado usando todas
    // as compras dele.
    //
    // Depois esse mesmo vetor era usado para perguntar se ele comprou
    // um dos produtos que já estava dentro do próprio vetor.
    //
    // Para os exemplos positivos, retiramos temporariamente o produto alvo.
    // =========================================================================

    if (removerProdutoAlvoDoHistorico) {

        usuarioUsadoNoExemplo = {
            ...usuario,

            purchases:
                usuario.purchases.filter(
                    compra =>
                        compra.id !== produto.id
                        &&
                        compra.name !== produto.name
                )
        };
    }


    const vetorUsuario =
        codificarUsuario(
            usuarioUsadoNoExemplo,
            contexto
        )
            .dataSync();


    const vetorProduto =
        codificarProduto(
            produto,
            contexto
        )
            .dataSync();


    entradas.push([
        ...vetorUsuario,
        ...vetorProduto
    ]);


    rotulos.push(
        rotulo
    );
}


/**
 * Seleciona uma quantidade de itens espalhados ao longo da lista.
 *
 * Exemplo:
 *
 * lista com 90 itens
 * queremos 9
 *
 * aproximadamente:
 *
 * posição 0
 * posição 10
 * posição 20
 * posição 30
 * ...
 *
 * Isso é melhor do que pegar somente os 9 primeiros produtos.
 */
function selecionarItensDistribuidos(
    itens,
    quantidade
) {

    if (
        quantidade <= 0
        ||
        itens.length === 0
    ) {

        return [];
    }


    if (quantidade >= itens.length) {

        return [
            ...itens
        ];
    }


    const resultado =
        [];


    const intervalo =
        itens.length
        /
        quantidade;


    for (
        let indice = 0;
        indice < quantidade;
        indice++
    ) {

        const posicao =
            Math.floor(
                indice
                *
                intervalo
            );


        resultado.push(
            itens[posicao]
        );
    }


    return resultado;
}


// ============================================================================
// PASSO 7 — CRIAR E TREINAR A REDE NEURAL
// ============================================================================

/**
 * Agora finalmente chegamos na rede neural.
 *
 * Tudo que aconteceu anteriormente foi PREPARAÇÃO DOS DADOS.
 *
 * Aqui fazemos:
 *
 * 1. criar a rede;
 * 2. criar as camadas;
 * 3. compilar;
 * 4. treinar.
 */
async function configurarETreinarRedeNeural(
    dadosTreinamento
) {

    // ========================================================================
    // CRIAR MODELO SEQUENCIAL
    // ========================================================================
    //
    // Sequential significa:
    //
    // entrada
    //    ↓
    // camada 1
    //    ↓
    // camada 2
    //    ↓
    // camada 3
    //    ↓
    // saída
    //
    // As informações percorrem as camadas em sequência.
    // ========================================================================

    const modelo = tf.sequential();


    // ========================================================================
    // CAMADA 1
    // ========================================================================
    //
    // inputShape:
    //
    // quantidade de números existentes em cada entrada.
    //
    //
    // units: 128
    //
    // significa que esta camada possui 128 neurônios.
    //
    //
    // activation: relu
    //
    // permite que a rede aprenda relações não-lineares.
    // ========================================================================

    modelo.add(

        tf.layers.dense({

            inputShape: [
                dadosTreinamento.dimensaoEntrada
            ],

            units: 128,

            activation: 'relu'

        })

    );


    // ========================================================================
    // CAMADA OCULTA 2
    // ========================================================================

    modelo.add(

        tf.layers.dense({

            units: 64,

            activation: 'relu'

        })

    );


    // ========================================================================
    // CAMADA OCULTA 3
    // ========================================================================

    modelo.add(

        tf.layers.dense({

            units: 32,

            activation: 'relu'

        })

    );


    // ========================================================================
    // CAMADA DE SAÍDA
    // ========================================================================
    //
    // Queremos apenas UMA resposta:
    //
    // "qual a chance desse usuário gostar desse produto?"
    //
    // Por isso:
    //
    // units = 1
    //
    //
    // SIGMOID:
    //
    // transforma a saída em algo entre 0 e 1.
    //
    // Exemplos:
    //
    // 0.03 → recomendação muito baixa
    //
    // 0.52 → recomendação média
    //
    // 0.95 → recomendação muito alta
    // ========================================================================

    modelo.add(

        tf.layers.dense({

            units: 1,

            activation: 'sigmoid'

        })

    );


    // ========================================================================
    // PASSO 8 — COMPILAR A REDE
    // ========================================================================
    //
    // Aqui definimos COMO ela aprenderá.
    //
    // optimizer:
    //
    // algoritmo responsável por ajustar pesos da rede.
    //
    //
    // loss:
    //
    // mede o quanto a resposta da rede está errada.
    //
    //
    // binaryCrossentropy:
    //
    // apropriada porque nosso problema possui:
    //
    // 0 → não comprou
    // 1 → comprou
    //
    //
    // accuracy:
    //
    // mede quantas classificações foram acertadas.
    // ========================================================================

    modelo.compile({

        optimizer:
            tf.train.adam(0.01),

        loss:
            'binaryCrossentropy',

        metrics: [
            'accuracy'
        ]

    });


    // ========================================================================
    // PASSO 9 — TREINAMENTO
    // ========================================================================
    //
    // É AQUI QUE O MODELO REALMENTE APRENDE.
    //
    // model.fit(
    //
    //     X,
    //     Y
    //
    // )
    //
    //
    // X:
    //
    // dados de entrada
    //
    //
    // Y:
    //
    // respostas corretas
    //
    //
    // O TensorFlow:
    //
    // 1. faz uma previsão;
    // 2. compara com a resposta correta;
    // 3. calcula o erro;
    // 4. ajusta os pesos;
    // 5. tenta novamente.
    //
    // Isso acontece repetidamente durante as épocas.
    // ========================================================================

    await modelo.fit(

        dadosTreinamento.dadosEntrada,

        dadosTreinamento.respostasEsperadas,

        {

            // Quantas vezes o modelo estudará
            // todo o conjunto de treinamento.
            epochs: 100,


            // Quantos exemplos serão processados
            // antes de atualizar os pesos.
            batchSize: 32,


            // Mistura os exemplos de treinamento.
            shuffle: true,


            // Executado ao terminar cada época.
            callbacks: {

                onEpochEnd: (
                    epoca,
                    metricas
                ) => {

                    postMessage({

                        type:
                            eventosWorker.trainingLog,

                        epoch:
                            epoca,

                        loss:
                            metricas.loss,

                        accuracy:
                            metricas.acc
                            ??
                            metricas.accuracy

                    });

                }

            }

        }

    );


    return modelo;
}


// ============================================================================
// PASSO 10 — ORQUESTRAR TODO O TREINAMENTO
// ============================================================================

/**
 * Essa é a função principal do treinamento.
 *
 * Ela coordena todas as etapas:
 *
 * produtos
 *    ↓
 * contexto
 *    ↓
 * normalização
 *    ↓
 * codificação
 *    ↓
 * criação de X e Y
 *    ↓
 * criação da rede
 *    ↓
 * treinamento
 *    ↓
 * modelo treinado
 */
async function treinarModelo({
    users: usuarios
}) {

    console.log(
        'Treinando modelo com usuários:',
        usuarios
    );


    // Informar para a interface que começamos.
    postMessage({

        type:
            eventosWorker.progressUpdate,

        progress: {
            progress: 1
        }

    });


    // ========================================================================
    // CARREGAR PRODUTOS
    // ========================================================================

    const respostaProdutos =
        await fetch(
            '/data/products.json'
        );


    const produtos =
        await respostaProdutos.json();


    // ========================================================================
    // CRIAR CONTEXTO
    // ========================================================================

    const contexto =
        criarContexto(
            produtos,
            usuarios
        );


    // ========================================================================
    // PRÉ-CALCULAR OS VETORES DOS PRODUTOS
    // ========================================================================
    //
    // Não precisamos converter o mesmo produto toda vez
    // que fizermos uma recomendação.
    //
    // Portanto salvamos os vetores previamente.
    // ========================================================================

    contexto.vetoresProdutos =
        produtos.map(produto => {

            return {

                nome:
                    produto.name,


                // Mantém os dados originais.
                dadosOriginais: {
                    ...produto
                },


                // Representação matemática.
                vetor:
                    codificarProduto(
                        produto,
                        contexto
                    )
                        .dataSync()

            };

        });


    // Guardar contexto para ser reutilizado
    // posteriormente na recomendação.
    _contextoGlobal = contexto;


    // ========================================================================
    // CRIAR DATASET DE TREINAMENTO
    // ========================================================================

    const dadosTreinamento =
        criarDadosTreinamento(
            contexto
        );


    console.log(
        'Formato das entradas:',
        dadosTreinamento.dadosEntrada.shape
    );


    console.log(
        'Formato das respostas:',
        dadosTreinamento.respostasEsperadas.shape
    );


    // ========================================================================
    // CRIAR E TREINAR MODELO
    // ========================================================================

    _modelo =
        await configurarETreinarRedeNeural(
            dadosTreinamento
        );


    // ========================================================================
    // TREINAMENTO FINALIZADO
    // ========================================================================

    postMessage({

        type:
            eventosWorker.progressUpdate,

        progress: {
            progress: 100
        }

    });


    postMessage({

        type:
            eventosWorker.trainingComplete

    });

}


// ============================================================================
// PASSO 11 — FAZER RECOMENDAÇÕES
// ============================================================================

/**
 * Utiliza o modelo já treinado para recomendar produtos.
 *
 * IMPORTANTE:
 *
 * Aqui não existe mais aprendizado.
 *
 * model.fit()
 *
 *      =
 *
 * APRENDER
 *
 *
 * model.predict()
 *
 *      =
 *
 * UTILIZAR O QUE FOI APRENDIDO
 */
function recomendarProdutos({
    user: usuario
}) {

    // Não podemos fazer previsão
    // se o modelo ainda não foi treinado.
    if (!_modelo) {

        console.warn(
            'O modelo ainda não foi treinado.'
        );

        return;
    }


    const contexto =
        _contextoGlobal;


    // ========================================================================
    // 1 — CODIFICAR USUÁRIO
    // ========================================================================

    const vetorUsuario =
        codificarUsuario(
            usuario,
            contexto
        )
            .dataSync();


    // ========================================================================
    // 2 — CRIAR UMA ENTRADA PARA CADA PRODUTO
    // ========================================================================
    //
    // Exemplo:
    //
    // usuário + notebook
    //
    // usuário + celular
    //
    // usuário + camiseta
    //
    // usuário + tênis
    //
    // Cada combinação será analisada separadamente pelo modelo.
    // ========================================================================

    const entradas =
        contexto.vetoresProdutos.map(

            ({
                vetor
            }) => {

                return [

                    ...vetorUsuario,
                    ...vetor

                ];

            }

        );


    // ========================================================================
    // 3 — CONVERTER PARA TENSOR
    // ========================================================================

    const tensorEntrada =
        tf.tensor2d(
            entradas
        );


    // ========================================================================
    // 4 — PREDIÇÃO
    // ========================================================================
    //
    // A rede retorna algo aproximadamente assim:
    //
    // [
    //     0.92,
    //     0.81,
    //     0.23,
    //     0.05
    // ]
    //
    // Uma pontuação para cada produto.
    // ========================================================================

    const previsoes =
        _modelo.predict(
            tensorEntrada
        );


    // Converter Tensor → Array JavaScript.
    const pontuacoes =
        previsoes.dataSync();


    // ========================================================================
    // 5 — ASSOCIAR SCORE AO PRODUTO
    // ========================================================================

    const recomendacoes =
        contexto.vetoresProdutos.map(

            (
                produto,
                indice
            ) => {

                return {

                    ...produto.dadosOriginais,

                    name:
                        produto.nome,

                    score:
                        pontuacoes[indice]

                };

            }

        );


    // ========================================================================
    // 6 — ORDENAR MELHOR → PIOR
    // ========================================================================

    const produtosOrdenados =
        recomendacoes.sort(

            (
                produtoA,
                produtoB
            ) => {

                return (
                    produtoB.score
                    -
                    produtoA.score
                );

            }

        );


    // ========================================================================
    // 7 — DEVOLVER RESULTADO PARA A INTERFACE
    // ========================================================================

    postMessage({

        type:
            eventosWorker.recommend,

        user:
            usuario,

        recommendations:
            produtosOrdenados

    });

}


// ============================================================================
// PASSO 12 — EVENTOS RECEBIDOS PELO WEB WORKER
// ============================================================================
//
// O arquivo está rodando dentro de um Web Worker.
//
// A thread principal envia uma mensagem:
//
// {
//     action: "train:model",
//     users: [...]
// }
//
// ou:
//
// {
//     action: "recommend",
//     user: {...}
// }
//
// Este objeto decide qual função executar.
// ============================================================================

const manipuladores = {

    [eventosWorker.trainModel]:
        treinarModelo,

    [eventosWorker.recommend]:
        recomendarProdutos

};


// ============================================================================
// ENTRADA DO WEB WORKER
// ============================================================================

self.onmessage = evento => {

    // Exemplo recebido:
    //
    // {
    //     action: "train:model",
    //     users: [...]
    // }

    const {
        action: acao,
        ...dados
    } = evento.data;


    // Procurar qual função corresponde
    // à ação recebida.
    const manipulador =
        manipuladores[acao];


    // Se existir função para essa ação,
    // executá-la.
    if (manipulador) {

        manipulador(
            dados
        );

    }

};