import { UserController } from './controller/UserController.js';
import { ProductController } from './controller/ProductController.js';
import { ModelController } from './controller/ModelTrainingController.js';
import { TFVisorController } from './controller/TFVisorController.js';
import { TFVisorView } from './view/TFVisorView.js';
import { UserService } from './service/UserService.js';
import { ProductService } from './service/ProductService.js';
import { UserView } from './view/UserView.js';
import { ProductView } from './view/ProductView.js';
import { ModelView } from './view/ModelTrainingView.js';
import Events from './events/events.js';
import { WorkerController } from './controller/WorkerController.js';


// ============================================================================
// SERVIÇOS COMPARTILHADOS
// ============================================================================

const userService =
    new UserService();

const productService =
    new ProductService();


// ============================================================================
// VIEWS
// ============================================================================

const userView =
    new UserView();

const productView =
    new ProductView();

const modelView =
    new ModelView();

const tfVisorView =
    new TFVisorView();


// ============================================================================
// WEB WORKER
// ============================================================================

const mlWorker =
    new Worker(
        '/src/workers/modelTrainingWorker.js',
        {
            type: 'module'
        }
    );


const w =
    WorkerController.init({
        worker:
            mlWorker,

        events:
            Events
    });


// ============================================================================
// TREINAMENTO INICIAL
// ============================================================================

const users =
    await userService.getDefaultUsers();


// Inicia o primeiro treinamento
// utilizando os usuários padrão.
w.triggerTrain(
    users
);


// ============================================================================
// CONTROLLERS
// ============================================================================

ModelController.init({
    modelView,
    userService,
    events:
        Events
});


TFVisorController.init({
    tfVisorView,
    events:
        Events
});


ProductController.init({
    productView,
    userService,
    productService,
    events:
        Events
});


const userController =
    UserController.init({
        userView,
        userService,
        productService,
        events:
            Events
    });


// ============================================================================
// USUÁRIO SEM HISTÓRICO
// ============================================================================
//
// Esse usuário não participa inicialmente
// do treinamento.
//
// Ele existe para demonstrar como o modelo
// se comporta com um usuário novo,
// que ainda não possui compras.
// ============================================================================

userController.renderUsers({
    id:
        99,

    name:
        'Caio Menezes',

    age:
        32,

    purchases:
        []
});
