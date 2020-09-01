import Firebase from 'firebase';
import { Client, Event, Venue } from "./objects";
import {toMonthString, objectToArray} from "./util";
import _ from "lodash";
require("firebase/functions");

export default class Database {
    constructor() {
        this.db = Firebase.database();
        this.func = Firebase.functions();

        this.clientDB = this.db.ref("database/clients");
        this.eventDB = this.db.ref("database/events");
        this.venueDB = this.db.ref("database/venues");
        this.footballGamesDB = this.db.ref("database/footballGames");

        /*
         * Set Firebase listener on database/venues
         * If anything changes in the database/venues tree,
         * update this.venues
         * AKA, this.venues holds the most recent venues
         */
        this.venueDB.on('value', snapshot => {
            var _venues = snapshot.val();
            let venueList = [];
            for (let venueID in _venues) {
                if (_venues.hasOwnProperty(venueID)) {
                    let venueObj = new Venue(_venues[venueID], venueID);
                    venueList.push(venueObj);
                }
            }
            this.venues = _.sortBy(venueList, "name");
        });
        
        /* Set firebase listener on database/clients
         * If anything changes in the database/clients tree,
         * update this.clients
         * AKA, this.clients holds the most recently-updated clients
         */
        this.clientDB.on('value', snapshot => {
            let _clients = snapshot.val();
            let clientList = [];
            for (let clientID in _clients) {
                if (_clients.hasOwnProperty(clientID)) {
                    let clientObj = new Client(_clients[clientID], clientID);
                    clientList.push(clientObj);
                }
            }
            this.clients = _.sortBy(clientList, "stageName");
        });

        /* Set firebase listener on database/events
         * If anything changes in the database/events tree,
         * update this.events
         * AKA, this.events holds the most recently-updated events
         */
        this.eventDB.on('value', snapshot => {
            let _events = snapshot.val();
            let eventList = [];
            for (let eventID in _events) {
                if (_events.hasOwnProperty(eventID)) {
                    let eventObj = new Event(_events[eventID], eventID);
                    eventList.push(eventObj);
                }
            }
            this.events = _.sortBy(eventList, "date");
        });

        /*
         * Set Firebase listener on database/footballGames
         * If anything changes in the database/footballGames tree,
         * update this.footballGames
         * AKA, this.venues holds the most recent venues
         */
        this.footballGamesDB.on('value', snapshot => {
            this.footballGames = {
                auburn: [],
                alabama: []
            };
            this.games = snapshot.val();
            for (let year in this.games) {
                for (let month in this.games[year]) {
                    for (let day in this.games[year][month]) {
                        if (this.games[year][month][day].auburn) {
                            this.footballGames.auburn.push(this.games[year][month][day].auburn);
                        }
                        if (this.games[year][month][day].alabama) {
                            this.footballGames.alabama.push(this.games[year][month][day].alabama);
                        }
                    }
                }
            }
        });

        this.getHolidays()
        .then(holidays => this.holidays = holidays)
        .catch(err => {
            console.log("[!] Error getting holidays: ");
            console.log(err);
        });

        this.generateSendSaveOne = this.func.httpsCallable("generateSendSaveOne");
        this.generateSendSaveAll = this.func.httpsCallable("generateSendSaveAll");
    }

    // load information on all clients
    getClients() {
        return new Promise((res, rej) => {
            this.clientDB.once("value").then(data => {
                let _clients = data.val();
                let foundClients = [];

                for (let clientID in _clients) {
                    if (_clients.hasOwnProperty(clientID)) {
                        let clientObj = new Client(_clients[clientID], clientID);
                        foundClients.push(clientObj);
                    }
                }

                let sortedClients = _.sortBy(foundClients,"stageName");
                res(sortedClients);
            }).catch(err => rej(err));
        });
    }

    // Load all events for the current month and onwards.
    // Assumption: Limited, since events should not be scheduled more than a few months in advance.
    getCurrentMonthAndUpcomingEvents(options) {
        if (!options) {
            options = Date.now();
        }

        let archiveDate = new Date(options);

        let currentMonth = toMonthString(archiveDate);

        return new Promise((res, rej) => {
            Firebase.database().ref('database/events').orderByChild('month').startAt(currentMonth).once("value").then(data => {
                let _events = data.val();
                let foundEvents = [];
                for (let eventID in _events) {
                    if (_events.hasOwnProperty(eventID)) {
                        let eventObj = new Event(_events[eventID], eventID);
                        foundEvents.push(eventObj);
                    }
                }
                res(foundEvents);
            }).catch(err => rej(err));
        });
    }

    // Load all of the events for a given month.
    getMonthEvents(options) {
        if (!options) {
            options = Date.now();
        }

        let archiveDate = new Date(options);

        let archiveMonth = toMonthString(archiveDate);

        return new Promise((res, rej) => {
            Firebase.database().ref('database/events').orderByChild('month').equalTo(archiveMonth).once("value").then(data => {
                let _events = data.val();
                let foundEvents = [];
                for (let eventID in _events) {
                    if (_events.hasOwnProperty(eventID)) {
                        let eventObj = new Event(_events[eventID], eventID);
                        foundEvents.push(eventObj);
                    }
                }
                res(foundEvents);
            }).catch(err => rej(err));
        });
    }

    getVenues() {
        return new Promise((res, rej) => {
            this.venueDB.once("value").then(data => {
                let _venues = data.val();
                let venueList = [];

                for (let venueID in _venues) {
                    if (_venues.hasOwnProperty(venueID)) {
                        let venueObj = new Venue(_venues[venueID], venueID);
                        venueList.push(venueObj);
                    }
                }

                let sortedVenues = _.sortBy(venueList, "name");
                res(sortedVenues);
            }).catch(err => rej(err));
        });
    }

    addClient(_client) {
        return new Promise((res, rej) => {
           let clientRef = this.clientDB.push(_client.toData());
           _client.id = clientRef.key;
           res();
        });
    }

    updateClient(_client) {
       let clientRef = this.clientDB.child(_client.id);
       return clientRef.update(_client.toData());
    }

    /*
     * Removes a Client by its ID from the Client tree of the database. Any events displayed
     * with this client will still exist in the calendar.
     */
    removeClient(client) {
        let thisClientsEvents = this.events.filter(event => event.clientID === client.id);
        thisClientsEvents.forEach(event => {
            event.clientName = client.stageName;
            this.updateEvent(event);
        }); 
        return this.clientDB.child(client.id).remove();
    }

    addEvent(_event) {
        return new Promise((res, rej) => {
            let eventRef = this.eventDB.push(_event.toData());
            _event.id = eventRef.key;
            res()
        });
    }

    updateEvent(_event) {
        let eventRef = this.eventDB.child(_event.id);
        return eventRef.update(_event.toData());
    }

    removeEvent(_event) {
        let eventRef = this.eventDB.child(_event.id);
        return eventRef.remove();
    }

    addVenue(_venue) {
        return new Promise((res, rej) => {
            let venueRef = this.venueDB.push(_venue.toData());
            _venue.id = venueRef.key;
            res(_venue);
        });
    }

    updateVenue(_venue) {
        let venueRef = this.venueDB.child(_venue.id);
        return venueRef.update(_venue.toData());
    }

    /*
     * Removes a Venue by its ID from the Venue tree of the database. Also
     * removes any Events at this Venue from the Event tree of the database. 
     */
    removeVenue(venue) {
        let thisVenuesEvents = this.events.filter(event => event.venueID === venue.id);
        thisVenuesEvents.forEach(event => {
                this.eventDB.child(event.id).remove();
        });
        return this.venueDB.child(venue.id).remove();
    }

    sendForms(venue, date) {
        return new Promise((res, rej) => {
            this.sendAllForms({
                venue: venue.id,
                month: date.getMonth() + 1,
                year: date.getFullYear()
            }).then(response => {
                if (response.error) {
                    rej(response.error);
                } else {
                    res();
                }
            }).catch(err => rej(err.message));
        });
    }

    generateDocument(data) {
        return new Promise((res, rej) => {
            this.sendForm(data).then(response => {
                if (response.error) {
                    rej(response.error);
                } else {
                    res();
                }
            }).catch(err => rej(err.message));
        });
    }

    getHolidays() {
        return new Promise((res, rej) => {
            try {
                let Holidays = require('date-holidays');
                let hd = new Holidays();
                hd.init('US');
                let holidays = [];
                years = [
                    new Date(new Date().setFullYear(new Date().getFullYear() - 1)).getFullYear(),
                    new Date().getFullYear(),
                    new Date(new Date().setFullYear(new Date().getFullYear() + 1)).getFullYear()
                ];
                years.forEach(year => {
                    hd.getHolidays(year)
                    .filter(holiday => holiday.type === "public")
                    .forEach(holiday => holidays.push(holiday));
                });
                res(holidays);
            }
            catch (e) {
                rej(e);
            }
        });
    }
}
