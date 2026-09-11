import { events } from './constants.js';

export default class Events {

    static onTrainingComplete(callback) {
        document.addEventListener(
            events.trainingComplete,
            event => callback(event.detail)
        );
    }

    static dispatchTrainingComplete(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.trainingComplete,
                { detail: data }
            )
        );
    }


    static onRecommend(callback) {
        document.addEventListener(
            events.recommend,
            event => callback(event.detail)
        );
    }

    static dispatchRecommend(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.recommend,
                { detail: data }
            )
        );
    }


    static onRecommendationsReady(callback) {
        document.addEventListener(
            events.recommendationsReady,
            event => callback(event.detail)
        );
    }

    static dispatchRecommendationsReady(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.recommendationsReady,
                { detail: data }
            )
        );
    }


    static onTrainModel(callback) {
        document.addEventListener(
            events.modelTrain,
            event => callback(event.detail)
        );
    }

    static dispatchTrainModel(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.modelTrain,
                { detail: data }
            )
        );
    }


    static onTFVisLogs(callback) {
        document.addEventListener(
            events.tfVisLogs,
            event => callback(event.detail)
        );
    }

    static dispatchTFVisLogs(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.tfVisLogs,
                { detail: data }
            )
        );
    }


    static onTFVisorData(callback) {
        document.addEventListener(
            events.tfVisData,
            event => callback(event.detail)
        );
    }

    static dispatchTFVisorData(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.tfVisData,
                { detail: data }
            )
        );
    }


    static onProgressUpdate(callback) {
        document.addEventListener(
            events.modelProgressUpdate,
            event => callback(event.detail)
        );
    }

    static dispatchProgressUpdate(progressData) {
        document.dispatchEvent(
            new CustomEvent(
                events.modelProgressUpdate,
                { detail: progressData }
            )
        );
    }


    static onUserSelected(callback) {
        document.addEventListener(
            events.userSelected,
            event => callback(event.detail)
        );
    }

    static dispatchUserSelected(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.userSelected,
                { detail: data }
            )
        );
    }


    static onUsersUpdated(callback) {
        document.addEventListener(
            events.usersUpdated,
            event => callback(event.detail)
        );
    }

    static dispatchUsersUpdated(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.usersUpdated,
                { detail: data }
            )
        );
    }


    static onPurchaseAdded(callback) {
        document.addEventListener(
            events.purchaseAdded,
            event => callback(event.detail)
        );
    }

    static dispatchPurchaseAdded(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.purchaseAdded,
                { detail: data }
            )
        );
    }


    static onPurchaseRemoved(callback) {
        document.addEventListener(
            events.purchaseRemoved,
            event => callback(event.detail)
        );
    }

    static dispatchEventPurchaseRemoved(data) {
        document.dispatchEvent(
            new CustomEvent(
                events.purchaseRemoved,
                { detail: data }
            )
        );
    }
}
