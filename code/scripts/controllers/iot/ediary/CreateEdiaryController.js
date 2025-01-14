import EDiaryService from "../../../services/iot/EDiaryService.js";

const { WebcController } = WebCardinal.controllers;

function getTodayDate() {
    let date = new Date(),
        month = '' + (date.getMonth() + 1),
        day = '' + date.getDate(),
        year = date.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [year, month, day].join('-');
}

const initModel = {
    isFormInvalid: true,
    isUsed: {
        checked: false
    },
    isDetached: {
        checked: true
    },
    date: {
       label: "Please indicate the date of the activity",
       name: "date",
       required: true,
       value: getTodayDate()
    },
    notes: {
        label: "Notes",
        name: "notes",
        required: true,
        placeholder: "Insert your note here",
        value: ""
    }
}

export default class CreateEdiaryController extends WebcController {
    constructor(...props) {
        super(...props);

        this.setModel(JSON.parse(JSON.stringify(initModel)));
        this.EDiaryService = new EDiaryService();
        this._addHandlerBack();
        this._attachHandlerEDiaryCreate();
    }

    _attachHandlerEDiaryCreate() {

        this.model.onChange("notes.value", () => {
            let notes = this.model.notes.value;
            this.model.isFormInvalid = notes.trim() === "";
        });
        
        this.onTagClick('ediary:create', (event) => {
            let ediaryRecord = {
                //isNew: this.model.isNew,
                isUsed: this.model.isUsed,
                isDetached: this.model.isDetached,
                date: new Date(this.model.date.value).getTime(),
                //date_mdy: new Date(this.model.date.value).getMonth()+1 + '/' + new Date(this.model.date.value).getDate() + '/' + new Date(this.model.date.value).getFullYear(),
                notes: this.model.notes.value
                
            }

            this.EDiaryService.saveEdiary(ediaryRecord, (err, data) => {
                if (err) {
                    return console.log(err);
                }

                this.navigateToPageTag("thk-ediary");
            });
        });

    }
    _addHandlerBack() {

        this.onTagClick('ediary:back', () => {
            this.navigateToPageTag('iot-ediary');

        });

    }
}