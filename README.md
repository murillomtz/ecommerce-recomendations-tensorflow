# Vitrine IA — Recomendador de E-commerce

Projeto didático de **recomendação de produtos para e-commerce** utilizando **TensorFlow.js** no navegador.

O sistema utiliza o histórico de compras dos usuários para treinar uma rede neural capaz de gerar um **score de afinidade entre o usuário e os produtos do catálogo**.

## Tecnologias

* JavaScript
* TensorFlow.js
* TensorFlow.js Vis
* Web Workers
* HTML
* CSS
* Bootstrap

## Como executar

```bash id="mte72g"
npm install
npm start
```

Depois acesse:

```text id="wtdvnd"
http://localhost:3000
```

## Funcionalidades

* seleção de usuários;
* histórico de compras;
* catálogo com 100 produtos;
* treinamento da rede neural;
* recomendações personalizadas;
* produtos ordenados por afinidade;
* acompanhamento de `accuracy` e `loss`;
* gráficos de treinamento em tempo real;
* painel de treinamento expansível e ocultável;
* interface responsiva em PT-BR.

## Como funciona

```text id="vphiwm"
Histórico de compras
        ↓
Normalização dos dados
        ↓
Transformação em vetores
        ↓
Criação dos dados de treinamento
        ↓
Rede Neural
        ↓
model.fit()
        ↓
Modelo treinado
        ↓
model.predict()
        ↓
Score de afinidade
        ↓
Recomendação
```

Após o treinamento, o modelo analisa os produtos e gera um **score de afinidade**, utilizado para ordenar as recomendações.

## Objetivo

O objetivo do projeto é demonstrar de forma prática conceitos de:

* Machine Learning;
* preparação e normalização de dados;
* redes neurais;
* treinamento supervisionado;
* `accuracy`;
* `loss`;
* predição;
* sistemas de recomendação com TensorFlow.js.

O projeto possui finalidade educacional e foi desenvolvido para facilitar o entendimento do fluxo entre **dados, treinamento e recomendação**.

**Categoria: Inteligência Artificial (IA) · Machine Learning (ML)**

## Interface e treinamento

O projeto reúne a interface web do e-commerce e o fluxo de treinamento do recomendador no mesmo repositório. A interface em JavaScript exibe catálogo e histórico de compras; o treinamento usa TensorFlow.js e pode ser acompanhado com TensorFlow.js Vis. Web Workers isolam tarefas de treinamento do fluxo principal da interface.
