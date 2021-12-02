import TrialService from "../../services/TrialService.js";
import TrialConsentService from "../../services/TrialConsentService.js";

const {WebcController} = WebCardinal.controllers;
const commonServices = require('common-services');
const DIDService = commonServices.DIDService;
const usecases = WebCardinal.USECASES;

const Constants = commonServices.Constants;
const DateTimeService = commonServices.DateTimeService;
const BaseRepository = commonServices.BaseRepository;

export default class LandingController extends WebcController {
    constructor(...props) {
        super(...props);
        this.model = JSON.parse(JSON.stringify(usecases));
        this.addHandlers();
        this.initServices();
    }

    addHandlers() {
        this.onTagEvent("navigate:notifications", "click", () => {
            this.navigateToPageTag('notifications');
        });
        this.onTagEvent("navigate:my-profile", "click", () => {
            this.navigateToPageTag('my-profile');
        });
        this.onTagEvent("navigate:econsent-trials-dashboard", "click", () => {
            this.navigateToPageTag('econsent-trials-dashboard');
        });
        this.onTagEvent("navigate:iot-devices", "click", () => {
            this.navigateToPageTag('iot-devices');
        });
        this.onTagEvent("navigate:health-studies", "click", () => {
            this.navigateToPageTag('iot-health-studies');
        });
        this.onTagEvent("navigate:iot-feedback", "click", () => {
            this.navigateToPageTag('iot-feedback');
        });
    }

    async initServices() {
        this.model.did = await DIDService.getDidAsync(this);
        this.TrialService = new TrialService();
        this.TrialParticipantRepository = BaseRepository.getInstance(BaseRepository.identities.PATIENT.TRIAL_PARTICIPANT);
        this.NotificationsRepository = BaseRepository.getInstance(BaseRepository.identities.PATIENT.NOTIFICATIONS);
        this.EconsentsStatusRepository = BaseRepository.getInstance(BaseRepository.identities.PATIENT.ECOSESENT_STATUSES);
        this.VisitsAndProceduresRepository = BaseRepository.getInstance(BaseRepository.identities.PATIENT.VISITS);
        this.QuestionsRepository = BaseRepository.getInstance(BaseRepository.identities.PATIENT.QUESTIONS);

        this.CommunicationService = await DIDService.getCommunicationServiceInstanceAsync(this);
        this.TrialConsentService = new TrialConsentService();
        this.model.trialConsent = await this.TrialConsentService.getOrCreateAsync();
        this._handleMessages();

    }

    _handleMessages() {
        this.CommunicationService.listenForMessages(async (err, data) => {
            if (err) {
                return console.error(err);
            }
            let hcoIdentity = {
                did: data.did,
                domain: data.domain
            }
            console.log("OPERATION:", data.message.operation);
            switch (data.message.operation) {
                case  Constants.MESSAGES.PATIENT.REFRESH_TRIAL: {
                    this.TrialService.reMountTrial(data.message.ssi, (err, trial) => {
                        this._saveConsentsStatuses(this.model.trialConsent.volatile.ifc, this.model.tp?.did);
                    });
                    break;
                }
                case Constants.MESSAGES.PATIENT.ADD_TO_TRIAL : {
                    this._handleAddToTrial(data);
                    this._saveConsentsStatuses(this.model.trialConsent.volatile?.ifc?.consents, data.message.useCaseSpecifics.did);
                    break;
                }
                case Constants.MESSAGES.PATIENT.SCHEDULE_VISIT : {
                    this.saveNotification(data);
                    this._saveVisit(data.message.useCaseSpecifics.visit);
                    break;
                }
                case Constants.MESSAGES.PATIENT.UPDATE_VISIT : {
                    this.saveNotification(data);
                    this._updateVisit(data.message.useCaseSpecifics.visit);
                    break;
                }
                case Constants.MESSAGES.PATIENT.UPDATE_TP_NUMBER: {
                    this.saveNotification(data);
                    this._updateTrialParticipant(data.message.useCaseSpecifics);
                    break;
                }
                case Constants.MESSAGES.PATIENT.QUESTION_RESPONSE: {
                    this.saveNotification(data);
                    this._updateQuestion(data.message.useCaseSpecifics)
                    break;
                }
                case Constants.MESSAGES.HCO.SEND_HCO_DSU_TO_PATIENT: {
                    this._handleAddToTrial(data);
                    this._mountHCODSUAndSaveConsentStatuses(data, (err, data) => {
                        if (err) {
                            return console.log(err);
                        }
                        this._sendTrialConsentToHCO(hcoIdentity);
                    });
                    break;
                }
                case Constants.MESSAGES.HCO.SEND_REFRESH_CONSENTS_TO_PATIENT: {
                    await this._mountICFAndSaveConsentStatuses(data);
                    break;
                }
            }
        });
    }

    _sendTrialConsentToHCO(hcoIdentity) {
        let sendObject = {
            operation: Constants.MESSAGES.PATIENT.SEND_TRIAL_CONSENT_DSU_TO_HCO,
            ssi: this.TrialConsentService.ssi,
            shortDescription: null,
        };
        this.CommunicationService.sendMessage(hcoIdentity, sendObject);
    }

    _mountHCODSUAndSaveConsentStatuses(data, callback) {
        this.TrialConsentService.mountHCODSU(data.message.ssi, (err, trialConsent) => {
            if (err) {
                return callback(err);
            }
            this.model.trialConsent = trialConsent;
            callback(err, trialConsent);
        })
    }


    async _mountICFAndSaveConsentStatuses(data) {
        let trialConsent = await this.TrialConsentService.mountIFCAsync(data.message.ssi);
        this.model.trialConsent = trialConsent;
        await this._saveConsentsStatuses(this.model.trialConsent.volatile?.ifc, data.message.useCaseSpecifics.did);
    }

    async _saveConsentsStatuses(consents, did) {
        if (consents === undefined) {
            consents = [];
        }

        //TODO extract this to a service. it is used also in TrialController
        let statusesMappedByConsent = {};
        let statuses = await this.EconsentsStatusRepository.findAllAsync();
        statuses.filter(status => status.tpDid === this.model.tpDid);

        statuses.forEach(status => {
            statusesMappedByConsent[status.foreignConsentId] = status;
        })

        for (const consent of consents) {
            let status = statusesMappedByConsent[consent.uid];
            if (!status) {
                consent.actions = [];
                consent.actions.push({name: 'required'});
                consent.foreignConsentId = consent.keySSI;
                consent.tpDid = did;
                await this.EconsentsStatusRepository.createAsync(consent);
            }
        }
    }

    async _saveTrialParticipantInfo(hcoIdentity, data) {
        let trialParticipant = {
            name: data.tpName,
            did: data.tpDid,
            site: data.site,
            hcoIdentity: hcoIdentity,
            sponsorIdentity: data.sponsorIdentity
        }
        this.model.tp = await this.TrialParticipantRepository.createAsync(trialParticipant);
    }

    async _updateTrialParticipant(data) {
        this.model.tp.number = data.number;
        await this.TrialParticipantRepository.updateAsync(this.model.tp.uid, this.model.tp);
    }

    async saveNotification(message) {
        let notification = {
            ...message.message,
            uid: message.message.ssi,
            viewed: false,
            startDate: DateTimeService.convertStringToLocaleDate(),
        }
        await this.NotificationsRepository.createAsync(notification, () => {
        });
    }

    async mountTrial(trialSSI) {
        let trial = await this.TrialService.mountTrialAsync(trialSSI);
        this.model.trials?.push(trial);
    }


    _saveVisit(visitToBeAdded) {
        this.VisitsAndProceduresRepository.createAsync(visitToBeAdded.uid, visitToBeAdded, (err, visitCreated) => {
            if (err) {
                return console.error(err);
            }
            this.model.tp.hasNewVisits = true;
            this.TrialParticipantRepository.update(this.model.tp.uid, this.model.tp, () => {
            })
        })
    }

    _updateVisit(visitToBeUpdated) {
        this.VisitsAndProceduresRepository.filter(`id == ${visitToBeUpdated.id}`, 'ascending', 1, (err, visits) => {
            if (err || visits.length === 0) {
                return;
            }
            this.VisitsAndProceduresRepository.update(visits[0].pk, visitToBeUpdated, () => {
            })
        })
    }


    async _handleAddToTrial(data) {
        this.saveNotification(data);
        let hcoIdentity = {
            did: data.did,
            domain: data.domain
        }
        await this._saveTrialParticipantInfo(hcoIdentity, data.message.useCaseSpecifics);
        await this.mountTrial(data.message.useCaseSpecifics.trialSSI);
    }

    _updateQuestion(data) {
        if (data.question) {
            this.QuestionsRepository.update(data.question.pk, data.question, () => {
            })
        }
    }

}
