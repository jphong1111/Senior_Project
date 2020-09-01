import {toTimeString, toDateString, toDateTime, dayInMS, toMonthString} from "./util";

/*
 * id: an ID object that identifies this instance of Client
 * performers: an array of strings that represent the names of the performers
 * stageName: a string representing the stage name of the client
 * email: a string representing the email address of the client
 * splitCheck: a boolean representing whether to do split checks (what does this mean? who knows)
 * bio: a string representing the bio of the client
 */
export class Client {
    constructor(_data, _id) {
        if (!_id) _id = null;
        if (!_data) _data = {};
        this.id = _id;

        this.performers = _data.performers;
        this.stageName = _data.stage;
        this.email = _data.email;
        this.splitCheck = _data.splitCheck;
        this.bio = _data.bio || "";
    }

    update(data) {
        this.performers = data.performers || this.performers;
        this.stageName = data.stageName || this.stageName;
        this.email = data.email || this.email;
        this.splitCheck = data.splitCheck || false;
        this.bio = data.bio || this.bio;
    }

    toData() {
        return {
            performers: this.performers || [],
            stage: this.stageName || "",
            email: this.email || "",
            splitCheck: this.splitCheck || false,
            bio: this.bio || ""
        };
    }
}

/*
 * id: an ID object that identifies this instance of Venue
 * date: a Date object representing the date of the event (posted to database as string "YYYY-MM-DD")
 * month: a Date object representing the date of the event (posted to database as string "YYYY-MM")
 * start: a Date object representing the start time of the event (posted to database as string "HH-mm")
 * end: a Date object representing the end time  of the event (posted to database as string "HH-mm")
 * client: an ID object representing the identifer of the client booked for the venue
 * clientName: a string representing the stage name of the event's client. This string is only set when the 
 *  client is deleted so the calendar can still show the event with the proper client, even though the client
 *  no long exists in the database. 
 * venue: an ID object representing the identifier of the venue that event will take place at
 * price: a floating point representing the amount of money the musician will be paid
 */
export class Event {
    constructor(_data, _id) {
        if (!_id) _id = null;
        if (!_data) _data = {
            price: 0.00,
            date: toDateString(new Date()),
            month: toMonthString(new Date())
        };

        this.id = _id;
        this.clientID = _data.client;
        this.clientName = _data.clientName;
        this.venueID = _data.venue;
        this.price = parseFloat(_data.price || 0);
        this.confirmationLastSent = _data.confirmationLastSent || "";
        this.invoiceLastSent = _data.invoiceLastSent || "";

        this.start = toDateTime({
            date: _data.date,
            time: _data.start
        });

        this.end = toDateTime({
            date: _data.date,
            time: _data.end
        });

        if (this.end < this.start) {
            this.end.setTime(this.end.getTime() + dayInMS);
        }
    }

    update(data) {
        if (!data) return;
        this.clientID = data.clientID || this.clientID;
        this.clientName = data.clientName || this.clientName;
        this.venueID = data.venueID || this.venueID;
        this.price = parseFloat(data.price || this.price);
        this.confirmationLastSent = data.confirmationLastSent || this.confirmationLastSent;
        this.invoiceLastSent = data.invoiceLastSent || this.invoiceLastSent;

        if (data.start) this.start = data.start;
        if (data.end) this.end = data.end;

        if (data.date) {
            this.month = toMonthString(toDateTime(data.date));
            let splits = data.date.split("-");
            this.start.setFullYear(splits[0], splits[1] -1, splits[2]);
            this.end.setFullYear(splits[0], splits[1] - 1, splits[2]);
        }
        if (data.startTime) {
            let splits = data.startTime.split(":");
            this.start.setHours(splits[0], splits[1]);
        }
        if (data.endTime) {
            let splits = data.endTime.split(":");
            this.end.setHours(splits[0], splits[1]);
        }

        if (this.end < this.start) {
            this.end.setDate(this.end.getDate() + 1);
        }
    }

    toData() {
        return {
            date: toDateString(this.start),   // YYYY-MM-DD
            month: toMonthString(this.start), // YYYY-MM
            start: toTimeString(this.start),  // HH:mm
            end: toTimeString(this.end),      // HH:mm
            client: this.clientID || "",
            clientName: this.clientName || "",
            venue: this.venueID || "",
            price: this.price || 0,
            confirmationLastSent: this.confirmationLastSent || "",
            invoiceLastSent: this.invoiceLastSent || ""
        };
    }

    isEqual(other) {
        return this.id === other.id &&
               this.clientID === other.clientID &&
               this.venueID === other.venueID &&
               this.start.getTime() === other.start.getTime() &&
               this.end.getTime() === other.start.getTime();
    }
}

/*
 * id: an ID object that identifies this instance of Venue
 * name: string representing the name of the venue
 * contactEmail: string representing the email address of the venue
 * address: object with the following fields:
 *    street1: string
 *    street2: string
 *    city: string
 *    state: string (2-letter notation, i.e. AL)
 *    zip: string (5 character notation, i.e. 36830)
 * presetTimeSlots: array of objects with the following fields:
 *    start: string representing the start time of the preset time slot (HH-mm notation)
 *    end: string representing the end time of the preset time slot (HH-mm notation)
 * artistConfirmationSendOut:
 *    day: integer representing the day of the month of the send out (must be <= 28)
 * artistInvoiceSendOut:
 *    day: integer representing the day of the month of the send out (must be <= 28)
 * monthlyBookingListSendOut:
 *    day: integer representing the day of the month of the send out (must be <= 28)
 */
export class Venue {
    constructor(_data, _id) {
        if (!_data) _data = {};
        this.id = _id || null;
        this.name = _data.name || "";
        this.contactEmail = _data.email || "";
        this.address = _data.address || {
            street1: _data.street1 || "",
            street2: _data.street2 || "",
            city: _data.city || "",
            state: _data.state || "",
            zip: _data.zip || ""
        };
        this.presetTimeSlots = _data.presetTimeSlots || [];
        this.artistConfirmationSendOut = _data.artistConfirmationSendOut || 1;
        this.artistInvoiceSendOut = _data.artistInvoiceSendOut || 1;
        this.monthlyBookingListSendOut = _data.monthlyBookingListSendOut || 1;
        this.monthlyCalendarSendOut = _data.monthlyCalendarSendOut || 1;
        this.allConfirmationsLastSent = _data.allConfirmationsLastSent || "";
        this.allInvoicesLastSent = _data.allInvoicesLastSent || "";
        this.bookingListLastSent = _data.bookingListLastSent || "";
        this.calendarLastSent = _data.calendarLastSent || "";
        this.emaillist = _data.emaillist || []; 
    }

    update(data) {
        this.name = data.name || this.name;
        this.contactEmail = data.email || this.contactEmail;

        this.address = {
            street1: data.street1 || this.address.street1,
            street2: data.street2 || this.address.street2,
            city: data.city || this.address.city,
            state: data.state || this.address.state,
            zip: (data.zip || this.address.zip).toString()
        };
        this.presetTimeSlots = data.presetTimeSlots || this.presetTimeSlots;
        this.artistConfirmationSendOut = data.artistConfirmationSendOut || this.artistConfirmationSendOut;
        this.artistInvoiceSendOut = data.artistInvoiceSendOut || this.artistInvoiceSendOut;
        this.monthlyBookingListSendOut = data.monthlyBookingListSendOut || this.monthlyBookingListSendOut;
        this.monthlyCalendarSendOut = data.monthlyCalendarSendOut || this.monthlyCalendarSendOut;

        this.allConfirmationsLastSent = data.allConfirmationsLastSent || this.allConfirmationsLastSent;
        this.allInvoicesLastSent = data.allInvoicesLastSent || this.allInvoicesLastSent;
        this.bookingListLastSent = data.bookingListLastSent || this.bookingListLastSent;
        this.calendarLastSent = data.calendarLastSent || this.calendarLastSent;
        this.emaillist = data.emaillist || this.emaillist;
    }

    toData() {
        return {
            name: this.name,
            email: this.contactEmail,
            address: this.address,
            presetTimeSlots: this.presetTimeSlots || [],
            artistConfirmationSendOut: this.artistConfirmationSendOut || 1,
            artistInvoiceSendOut: this.artistInvoiceSendOut || 1,
            monthlyBookingListSendOut: this.monthlyBookingListSendOut || 1,
            monthlyCalendarSendOut: this.monthlyCalendarSendOut || 1,
            allConfirmationsLastSent: this.allConfirmationsLastSent || "",
            allInvoicesLastSent: this.allInvoicesLastSent || "",
            bookingListLastSent: this.bookingListLastSent || "",
            calendarLastSent: this.calendarLastSent || "",
            emaillist: this.emaillist || [] 
        };
    }
}
