import EDiaryService from "../../../services/iot/EDiaryService.js";

const { WebcController } = WebCardinal.controllers;

const BUTTON_NEW = 'ed_button_new';
//const BUTTON_USED = 'ed-button-used';
const BUTTON_ATTACHED = 'ed_button_attached';
//const BUTTON_DETACHED = 'ed-button-detached';

const initModel = {
    title: 'Create EDiary',
    patchState: BUTTON_NEW,
    patchOption: BUTTON_ATTACHED,
    date: {
        label: "Please indicate the date of the activity",
        name: "date",
        required: true,
        dataFormat: "DD MM YYYY",
        placeholder: "DD MM YYYY",
        value: ''
    },
    notes: {
        label: "Notes",
        name: "notes",
        required: true,
        placeholder: "Notes",
        value: ''
    }

}

export default class CreateEdiaryController extends WebcController {
    constructor(...props) {
        super(...props);

        this.setModel(JSON.parse(JSON.stringify(initModel)));

        this.EDiaryService = new EDiaryService();

        this.on('openFeedback', (evt) => {
            this.feedbackEmitter = evt.detail;
        });

        this._initHandlers()
    }

    _initHandlers() {
        this._attachHandlerEDiaryCreate();

        this.on(BUTTON_NEW, (event) => {
            this.model.patchState = BUTTON_NEW;
        });


        this.on(BUTTON_ATTACHED, (event) => {
            this.model.patchOption = BUTTON_ATTACHED;
        });

    }

    _attachHandlerEDiaryCreate() {
        this.onTagClick('ediary:create', (event) => {
            let ediaryRecord = {
                patchOption: this.model.patchOption,
                patchState: this.model.patchState,
                date: this._getDateFormatted(),
                notes: this.model.notes.value,
            }
            this.EDiaryService.saveEdiary(ediaryRecord, (err, data) => {
                if (err) {
                    return console.log(err);
                }
                this.navigateToPageTag("thk-ediary");
            });

        });

    }


    __displayErrorMessages = (event) => {
        return this.__displayErrorRequiredField(event, 'name', this.model.name.value) ||
            this.__displayErrorRequiredField(event, 'version', this.model.version.value) ||
            this.__displayErrorRequiredField(event, 'consentName', this.model.consentName.value);
    }

    __displayErrorRequiredField(event, fieldName, field) {
        if (field === undefined || field === null || field.length === 0) {
            this._emitFeedback(event, fieldName.toUpperCase() + " field is required.", "alert-danger")
            return true;
        }
        return false;
    }

    _emitFeedback(event, message, alertType) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof this.feedbackEmitter === 'function') {
            this.feedbackEmitter(message, "Validation", alertType)
        }
    }

    _getDateFormatted() {
        let date = new Date(this.model.date.value);
        return date.getDay() + "/" + date.getMonth() + "/" + date.getFullYear();
    }

}