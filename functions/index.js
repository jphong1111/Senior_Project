const Functions = require('firebase-functions');
const Admin = require("firebase-admin");
const Email = require("./handlers/emailHandler.js");
const PDF = require("./handlers/pdfHandler.js");
const Drive = require("./handlers/driveHandler.js");
const Util = require("./util.js");
const axios = require('axios');
const cheerio = require('cheerio');

Admin.initializeApp();
const db = Admin.database();
const eventDB = db.ref("database/events");
const clientDB = db.ref("database/clients");
const venueDB = db.ref("database/venues");
const footballGamesDB = db.ref("database/footballGames");

const VALID_TYPES = ["artist_confirmation", "invoice", "booking_list", "calendar"];

/*
 * Firebase function that checks each venue's prefences are 0800 CST every day to see if 
 * today is the documentation send out day. If so, generate, sends, and saves all of the 
 * necessary documentation.
 */
exports.docSendOut = Functions.pubsub.schedule("every day 08:00")
    .timeZone("America/Chicago")
    .onRun((content) => {
        return new Promise((resolve, reject) => {let today = new Date();
            let nextMonthDate = new Date();
            nextMonthDate.setMonth(today.getMonth() + 2); // Increment by two: one to map is 1:January, not 0:January and one to go to the next month
            let nextMonthString = `${nextMonthDate.getFullYear()}-${nextMonthDate.getMonth()}`;
        
            // For each venue, check to see if today is the documentation send out day
            venueDB.once("value").then(snapshot => {
                let venues = Util.objectToArray(snapshot.val());
                return Promise.all(venues.map(venue => {
                    let jobs = []; 
        
                    // If today is the artist confirmation send out day for the venue, generate and send them
                    if (venue.artistConfirmationSendOut === today.getDate().toString()) {
                        jobs.push(() => genSendSaveAll({
                            type: "artist_confirmation",
                            venueID: venue.id,
                            month: nextMonthDate.getMonth(),
                            year: nextMonthDate.getFullYear()
                        }).then(() => {
                            console.log(`[*] Confirmations sent out for venue [${venue.id}], year-month [${nextMonthString}]`);
                        }).catch(err => {
                            console.log(`[!] ERROR sending out confirmations for venue [${venue.id}], year-month [${nextMonthString}]:`);
                            console.log(err);
                        }));
                    }
        
                    // If today is the artist invoice send out day for the venue, generate and send them
                    if (venue.artistInvoiceSendOut === today.getDate().toString()) {
                        console.log(`[*] venue for invoices: ${venue.name}`);
                        jobs.push(() => genSendSaveAll({
                            type: "invoice",
                            venueID: venue.id,
                            month: nextMonthDate.getMonth(),
                            year: nextMonthDate.getFullYear()
                        }).then(() => {
                            console.log(`[*] Invoices sent out for venue [${venue.id}], year-month [${nextMonthString}]`);
                        }).catch(err => {
                            console.log(`[!] ERROR sending out invoices for venue [${venue.id}], year-month [${nextMonthString}]:`);
                            console.log(err);
                        }));
                    }
                    
                    // If today is the monthly booking list send out day for the venue, generate and send it
                    if (venue.monthlyBookingListSendOut === today.getDate().toString()) {
                        jobs.push(() => genSendSaveOne({
                            type: "booking_list",
                            venueID: venue.id,
                            month: nextMonthDate.getMonth(),
                            year: nextMonthDate.getFullYear()
                        }).then(() => {
                            console.log(`[*] Booking list sent out for venue [${venue.id}], year-month [${nextMonthString}]`);
                        }).catch(err => {
                            console.log(`[!] ERROR sending out booking list for venue [${venue.id}], year-month [${nextMonthString}]:`);
                            console.log(err);
                        }));
                    }
        
                    // If today is the monthly calendar send out day for the venue, generate and send it
                    if (venue.monthlyCalendarSendOut === today.getDate().toString()) {
                        jobs.push(() => genSendSaveOne({
                            type: "calendar",
                            venueID: venue.id,
                            month: nextMonthDate.getMonth(),
                            year: nextMonthDate.getFullYear()
                        }).then(() => {
                            console.log(`[*] Calendar sent out for venue [${venue.id}], year-month [${nextMonthString}]`);
                        }).catch(err => {
                            console.log(`[!] ERROR sending out calendar for venue [${venue.id}], year-month [${nextMonthString}]:`);
                            console.log(err);
                        }));
                    }
    
                    if (jobs.length) {
                        return Util.staggerPromises(jobs, 3000, 1);
                    }
                    else {
                        return [];
                    }
                }));
            }).then(completedJobs => {
                resolve(completedJobs);
            }).catch(err => {
                reject(err);
            });
        });
    });


/*
 * Firebase function that calls the local genSendSaveOne function
 */
exports.generateSendSaveOne = Functions.https.onCall((data) => {
    return new Promise((resolve, reject) => {
        genSendSaveOne(data).then(result => {
                resolve(result);
        }).catch(err => {
                reject(err);
        });
    });
});

/*
 * Firebase functions that calls the local genSendSaveAll function
 */
exports.generateSendSaveAll = Functions.https.onCall((data)  => {
    return new Promise((resolve, reject) => {
        genSendSaveAll(data).then(result => {
                resolve(result);
        }).catch(result => {
                reject(result);
        });
    });
});

/*
 * Firebase function that scrapes espn.com for Auburn & Alabama football schedules
 * and stores them in the database. Games are stored with the following schema:
 * footballGames/<year>/<month>/<day>/<team>
 */
exports.footballGameRefresh = Functions.pubsub.schedule("every monday 08:00")
    .timeZone("America/Chicago")
    .onRun((content) => {
        return new Promise((resolve, reject) => {
            console.log("[*] Refreshing Auburn & Alabama football games");
            const teams = ["auburn", "alabama"];
            Promise.all(teams.map(team => {
                return new Promise((resolve, reject) => {
                    return retrieveGames(team).then(games => {
                        return writeGames(team, games);
                    }).then(games => {
                        resolve(games);
                    }).catch(err => {
                        reject(err);
                    });
                });
            })).then(() => {
                resolve();
            }).catch(err => {
                console.log(err);
                reject(err);
            });
        });
    });

/*
 * Generates, sends, and saves a particular type of document (either artist confirmation, booking list, 
 * invoice, or calendar). Artist confirmations and artist invoices correspond to a particular event,
 * whereas monthly booking lists and calendars correspond to a particular venue, month, and year. 
 * 
 * args for artist confirmations and invoices:
 * data -> an object with the following fields:
 *      type -> a string representing the type of document to gen send save
 *          Either "artist_confirmation" (VALID_TYPES[0]) or "invoice" (VALID_TYPES[1])
 *      eventID -> a string representing the identifier of the event 
 * 
 * args for monthly booking list and calendars:
 * data -> an object with the following fields:
 *      type -> a string representing the type of document to gen send save
 *          Either "booking_list" (VALID_TYPES[2]) or "calendar" (VALID_TYPES[3])
 *      venueID -> a string representing the identifier of the venue
 *      month -> an integer representing the month (1 = Jan, 2 = Feb, ..., 12 = Dec)
 *      year -> an intger representing the year
 */
const genSendSaveOne = function(data) {
    return new Promise((resolve, reject) => {

        const handleSuccess = () => resolve({success: true});
        const handleError = errorMessage => reject({error: errorMessage});

        if (!data) {
            handleError("generateSendSaveOne requires parameter data");
        }
        if (!data.type) {
            handleError("No document type was specified.");
        } 
        else if (!VALID_TYPES.includes(data.type)) {
            handleError("The document type provided is invalid.");
        }

        let type = data.type;
        switch (type) {
            case VALID_TYPES[0]: // artist_confirmation
                processEvent(data.eventID).then(processedData => {
                    return generateSendSaveConfirmation(processedData.event, processedData.client, processedData.venue)
                }).then(handleSuccess).catch(handleError);
                break;

            case VALID_TYPES[1]: // invoice
                processEvent(data.eventID).then(processedData => {
                    return generateSendSaveInvoice(processedData.event, processedData.client, processedData.venue)
                }).then(handleSuccess).catch(handleError);
                break;

            case VALID_TYPES[2]: // booking_list
                processEvents(data.venueID, data.month, data.year).then(processedData => {
                    return generateSendSaveBookingList(processedData.events, processedData.venue, processedData.month, processedData.year)
                }).then(handleSuccess).catch(handleError);
                break;

            case VALID_TYPES[3]: // calendar
                processEvents(data.venueID, data.month, data.year).then(processedData => {
                    return generateSendSaveCalendar(processedData.events, processedData.venue, processedData.month, processedData.year)
                }).then(handleSuccess).catch(handleError);
                break;
        }
    });
}

/*
 * Generates, sends, and saves all of the artist confirmations or artist invoices for a particular 
 * venue during a particular month and year. 
 * 
 * data is an object with the following fields:
 * type -> a string representing the type of document to generate, either "artist_confirmation" (VALID_TYPES[0])
 *      or "invoice" (VALID_TYPES[1])
 * venueID -> a string representing the identifier of the venue
 * month -> an integer representing the month (1 = Jan, 2 = Feb, ..., 12 = Dec)
 * year -> an intger representing the year
 */
const genSendSaveAll = function(data) {
    return new Promise((resolve, reject) => {

        const handleSuccess = () => resolve({success: true});
        const handleError = errorMessage => reject({error: errorMessage});

        processEvents(data.venueID, data.month, data.year).then(processedData => {
            let jobs = [];
            switch (data.type) {
                case VALID_TYPES[0]: // artist_confirmation
                    jobs = processedData.events.map(event => {
                        return () => generateSendSaveConfirmation(event, event.client, processedData.venue);
                    });
                    return Util.staggerPromises(jobs, 3000, 1).then(events => {
                        return venueDB.child(data.venueID).update({allConfirmationsLastSent: new Date().toString()});
                    });

                case VALID_TYPES[1]: // invoice
                    jobs = processedData.events.map(event => {
                        return () => generateSendSaveInvoice(event, event.client, processedData.venue);
                    });
                    return Util.staggerPromises(jobs, 3000, 1).then(events => {
                        return venueDB.child(data.venueID).update({allInvoicesLastSent: new Date().toString()});
                    });
            }
        }).then(() => {
            handleSuccess();
        }).catch(err => {
            handleError(err);
        });
    });
}

/*
 * Attaches the corresponding Client object to each of the Event objects in the list of events
 *
 * events -> a list of Event objects, representing all of the events at a particular venue on a particular month
 */
const attachClientData = function(events) {
    return Promise.all(events.map(event => {
        let clientID = event.client;
        return new Promise((resolve, reject) => {
            clientDB.child(clientID).once("value").then(clientData => {
                event.client = clientData.val();
                resolve(event);
            }).catch(err => {
                reject(err);
            });
        });
    }));
};

/*
 * Given a particular event ID, returns an object with the corresponding Event object, its Client object,
 * and its Venue object. 
 * 
 * eventID -> a string representing the unique identifier for the event to process
 */
const processEvent = function(eventID) {
    return new Promise((resolve, reject) => {
        let processedData = {};
        eventDB.child(eventID).once("value").then(eventData => {
            processedData.event = eventData.val();
            processedData.event.id = eventID;
            return venueDB.child(processedData.event.venue).once("value");
        }).then(venueData => {
            processedData.venue = venueData.val();
            processedData.venue.id = processedData.event.venue;
            return clientDB.child(processedData.event.client).once("value");
        }).then(clientData => {
            processedData.client = clientData.val();
            processedData.client.id = processedData.event.client;
            resolve(processedData);
        }).catch(err => {
            reject(err);
        });
    });
}

/*
 * Given a particular venue ID, month, and year, returns an object with the Venue object,
 * all of the Event objects for that particular month and year, and the month and year. 
 * The Event objects also have their Client objects attached as event.client. 
 * 
 * venueID -> a string representing the unique identifier of the venue of the events that
 *      are being processed
 * month -> an integer representing the month (1 = Jan, 2 = Feb, ..., 12 = Dec)
 * year -> an intger representing the year
 */
const processEvents = function(venueID, month, year) {
    return new Promise((resolve, reject) => {
        let processedData = {
            month: month,
            year: year
        };
        let monthString = Util.toMonthString(month, year);
        eventDB.orderByChild("month").equalTo(monthString).once("value").then(eventsData => {
            let events = [];
            eventsData.forEach(child => {
                let event = child.val();
                event.id = child.key;
                events.push(event);
            });
            let thisVenuesEvents = events.filter(event => event.venue === venueID);
            return attachClientData(thisVenuesEvents);
        }).then(events => {
            processedData.events = events;
            return venueDB.child(venueID).once("value");
        }).then(venueData => {
            processedData.venue = venueData.val();
            processedData.venue.id = venueData.key;
            resolve(processedData);
        }).catch(err => {
            reject(err);
        });
    });
}

/*
 * Generates an artist confirmation PDF for a particular event, emails the PDF, and saves the PDF
 * to Google Drive. 
 * 
 * event -> an Event object representing the event whose confirmation to generate, send, & save
 * client -> a Client object representing the client who will be performing at the event
 * venue -> a Venue object representing the venue where the event will be performed
 */
const generateSendSaveConfirmation = function(event, client, venue) {
    return new Promise((resolve, reject) => {
        const pdf1 = PDF.generateArtistConfirmation(event, client, venue);
        const pdf2 = PDF.generateArtistConfirmation(event, client, venue);
        return Promise.all([
            Email.sendArtistConfirmation(event, client, venue, pdf1),
            Drive.uploadArtistConfirmation(event, client, venue, pdf2)
        ]).then(pdfs => {
            return eventDB.child(event.id).update({confirmationLastSent: new Date().toString()});
        }).then(ref => {
            resolve(event);
        }).catch(err => {
            reject(err);
        });
    });
}

/*
 * Generates an artist invoice PDF for a particular event, emails the PDF, and saves the PDF
 * to Google Drive. 
 * 
 * event -> an Event object representing the event whose invoice to generate, send, & save
 * client -> a Client object representing the client who will be performing at the event
 * venue -> a Venue object representing the venue where the event will be performed
 */
const generateSendSaveInvoice = function(event, client, venue) {
    return new Promise((resolve, reject) => {
        const pdf1 = PDF.generateInvoice(event, client, venue);
        const pdf2 = PDF.generateInvoice(event, client, venue);
        return Promise.all([
            Email.sendInvoice(event, client, venue, pdf1),
            Drive.uploadInvoice(event, client, venue, pdf2)
        ]).then(pdfs => {
            return eventDB.child(event.id).update({invoiceLastSent: new Date().toString()});
        }).then(ref => {
            resolve(event);
        }).catch(err => {
            reject(err);
        });
    });
}

/*
 * Generates a booking list PDF for a particular venue and month/year, emails the PDF, and saves
 * the PDF to Google Drive. 
 * 
 * events -> an array of Event objects representing the events at the venue on the particular 
 *      month/year
 * venue -> a Venue object representing the venue where the events will be performed
 * month -> an integer representing the month (1 = Jan, 2 = Feb, ..., 12 = Dec)
 * year -> an intger representing the year
 */
const generateSendSaveBookingList = function(events, venue, month, year) {
    return new Promise((resolve, reject) => {
        const pdf1 = PDF.generateBookingList(month, year, events, venue);
        const pdf2 = PDF.generateBookingList(month, year, events, venue);
        return Promise.all([
            Email.sendBookingList(month, year, venue, pdf1), 
            Drive.uploadBookingList(month, year, venue, pdf2)
        ]).then(pdfs => {
            return venueDB.child(venue.id).update({bookingListLastSent: new Date().toString()});
        }).then(ref => {
            resolve(events);
        }).catch(err => {
            reject(err);
        });
    });
}

/*
 * Generates a calendar PDF for a particular venue and month/year, emails the PDF, and saves
 * the PDF to Google Drive. 
 * 
 * events -> an array of Event objects representing the events at the venue on the particular 
 *      month/year
 * venue -> a Venue object representing the venue where the events will be performed
 * month -> an integer representing the month (1 = Jan, 2 = Feb, ..., 12 = Dec)
 * year -> an intger representing the year
 */
const generateSendSaveCalendar = function(events, venue, month, year) {
    return new Promise((resolve, reject) => {
        const pdf1 = PDF.generateCalendar(month, year, events);
        const pdf2 = PDF.generateCalendar(month, year, events);
        return Promise.all([
            Email.sendCalendar(month, year, venue, pdf1),
            Drive.uploadCalendar(month, year, venue, pdf2)
        ]).then(pdfs => {
            return venueDB.child(venue.id).update({calendarLastSent: new Date().toString()});
        }).then(ref => {
            resolve(events);
        }).catch(err => {
            reject(err);
        });
    });
}

/*
 * Retrieves football schedules a football team. Currently only Auburn and Alabama
 * are included. 
 * 
 * team is a string representing the name of the team whose schedule to scrape from
 *  espn.com, all lowercase
 */
const retrieveGames = function(team) {
    const teamIDs = {
        auburn: "2",
        alabama: "333"
    };
    return new Promise((resolve, reject) => {
        const dateRegex = /[A-Z][a-z]{2}\,\ [A-Z][a-z]{2}\ ([1-9]||[1-2][0-9]||3[0-1])/i
        const url = `https://www.espn.com/college-football/team/schedule/_/id/${teamIDs[team]}`
        axios.get(url)
            .then(response => {
                let games = [];
                const $ = cheerio.load(response.data);
                $('.Table__TR.Table__TR--sm.Table__even').each((i, elem) => {
                    const children = elem.children;
                    const date = $(children[0]).text();
                    const opponent = $(children[1]).text();
                    const time = $(children[2]).text();
                    if (date.search(dateRegex) !== -1 && opponent !== "Opponent") {
                        games.push({
                            date: parseDate(date),
                            opponent: parseOpponent(opponent).opponent,
                            location: parseOpponent(opponent).location,
                            time: parseTime(time)
                        })
                    }
                });
                resolve(games);
            }).catch(err => {
                reject(err);
            })
    });
}

/*
 * Writes football games to the database for a specific team.
 * 
 * team is a string representing the name of the team whose schedule to scrape from
 *  espn.com, all lowercase
 * games is an array of game objects, of the form:
 *  date: YYYY-MM-DD, a string
 *  opponent: a string representing the name of the opponent the team is playing
 *  location: "away", "home", or "neutral"
 *  time: a string representing kickoff (CST). For example: "2:30 PM"
 */
const writeGames = function(team, games) {
    return new Promise((resolve, reject) => {
        Promise.all(games
            .filter(game => {
                const year = game.date.split('-')[0];
                const month = game.date.split('-')[1];
                const day = game.date.split('-')[2];
                return new Date() < new Date(year, parseInt(month) - 1, day);
            })
            .map(game => {
                const year = game.date.split('-')[0];
                const month = game.date.split('-')[1];
                const day = game.date.split('-')[2];
                footballGamesDB.child(year).child(month).child(day).child(team).set(game);
            }))
        .then(() => {
            resolve();
        }).catch(err => {
            reject(err);
        });
    });
}

/*
 * Parses the name of the opponent and the location from data scraped from
 * espn.com
 */
const parseOpponent = function(opponentString) {
    const elems = opponentString.trim().split(' ');
    const rankedRegex = /(vs|@) ([1-9]|1[0-9]|2[0-5]) [A-Z][a-z]+/i
    let opponentIndex, site;
    if (opponentString.search(rankedRegex) !== -1) {
        opponentIndex = 2;
    }
    else {
        opponentIndex = 1;
    }
    if (elems[elems.length - 1] === '*') {
        site = "neutral";
        elems.pop();
    }
    else if (elems[0] === 'vs') {
        site = 'home';
    }
    else {
        site = 'away';
    }
    return {
        opponent: elems.slice(opponentIndex, elems.length).join(' '),
        location: site
    }
}

/*
 * Parses the date from data scraped from espn.com
 */
const parseDate = function(dateString) {
    months = {
        Jan: 1,
        Feb: 2,
        Mar: 3,
        Apr: 4,
        May: 5,
        Jun: 6,
        Jul: 7,
        Aug: 8,
        Sep: 9, 
        Oct: 10,
        Nov: 11,
        Dec: 12
    }
    const elems = dateString.trim().split(' ');
    const year = new Date().getFullYear();
    const month = parseInt(months[elems[1]]) < 10 ? `0${months[elems[1]]}` : months[elems[1]];
    const day = parseInt(elems[2]) < 10 ? `0${elems[2]}` : elems[2];
    return [year, month, day].join('-');
}

/*
 * Parses the time from data scraped from espn.com
 */
const parseTime = function(timeString) {
    const timeRegex = /([1-9]|1[0-2]):([0-5][0-9]) (A|P)M/i;
    if (timeString.search(timeRegex) !== -1) {
        let hourInEST = parseInt(timeString.split(':')[0]);
        let minutes= timeString.split(':')[1].split(' ')[0];
        let amPM = timeString.split(' ')[1];
        let hourInCST = (hourInEST - 1) % 12;
        if (hourInCST === 11) {
            amPM = (amPM === "AM") ? "PM" : "AM";
        }
        return `${hourInCST}:${minutes} ${amPM}`;
    }
    if (timeString.trim() === "TBD") {
        return timeString;
    }
    return "past";
}