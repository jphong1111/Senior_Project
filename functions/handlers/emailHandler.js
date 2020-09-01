const Functions = require('firebase-functions/lib/index');
const NodeMailer = require("nodemailer");
const Util = require("../util.js");

const env = Functions.config();
const gmail = NodeMailer.createTransport({
    service: "gmail",
    auth: {
        user: env.gmail.email,
        pass: env.gmail.password
    },
    pool: true,         // Don't have a separate connection per message
    maxConnections: 1,  // Only one connection to Gmail at a time
    maxMessages: 5,     // 5 emails per connection
    rateDelta: 5000,    // Within a 5 seconds limit...
    rateLimit: 1        // Only send one email
});

const sendEmail = function (data) {
    return new Promise((resolve, reject) => {

        if (!data.to) {
            reject("[!] Error sending email, no recipient specified");
        }

        data.from = "musicmattersbookings@gmail.com";
        gmail.sendMail(data)
        .then(() => {
            resolve(data.attachments[0].content); // Return PDF
        }).catch(err => {
            reject(err);
        });
    });
};
exports.sendEmail = sendEmail;

exports.sendArtistConfirmation = function (event, client, venue, pdf) {
    return new Promise((resolve, reject) => {
        let emailSubject = venue.name + " - Artist Confirmation";
        let emailBody = "Hello!\n\n" +
            "Attached is the confirmation for your performance" + " at " + venue.name + " at " + Util.toAMPM(event.start) + ".\n" +
            "Please don't hesitate to reply back to this email if you have any questions." +
            "\n\nThanks,\nMusic Matters Bookings";
        return sendEmail({
            to: client.email,
            subject: emailSubject,
            text: emailBody,
            attachments: [
                {
                    filename: "Confirmation " + event.date + ".pdf",
                    content: pdf
                }
            ]
        }).then(pdf => {
            resolve(pdf);
        }).catch(err => {
            reject(err);
        });
    });
};

exports.sendInvoice = function (event, client, venue, pdf) {
    return new Promise((resolve, reject) => {
        let emailSubject = client.stage + " - Invoice - " + Util.toUS(event.date);
        let emailBody = "To whom it may concern,\n\n" +
            "Attached is the invoice for " + client.stage + ", who is performing at " + venue.name + " on " + Util.toUSText(event.date) + ".\n" +
            "Please don't hesitate to reply back to this email if you have any questions." +
            "\n\nThanks,\nMusic Matters Bookings";
        return sendEmail({
            to: [venue.email, venue.emaillist],
            subject: emailSubject,
            text: emailBody,
            attachments: [
                {
                    filename: "Invoice " + event.date + ".pdf",
                    content: pdf
                }
            ]
        }).then(pdf => {
            resolve(pdf);
        }).catch(err => {
            reject(err);
        });
    });
};

exports.sendCalendar = function (month, year, venue, pdf) {
    return new Promise((resolve, reject) => {
        let monthText = Util.monthEnum(month - 1);
        let emailSubject = "Booking Calendar - " + monthText + " " + year;
        let emailBody = "To whom it may concern,\n\n" +
            "Attached is the booking calendar for " + monthText + " " + year + " for " + venue.name + ".\n" +
            "Please don't hesitate to reply back to this email if you have any questions." +
            "\n\nThanks,\nMusic Matters Bookings";
        return sendEmail({
            to: [venue.email, venue.emaillist],
            subject: emailSubject,
            text: emailBody,
            attachments: [
                {
                    filename: "Booking Calendar " + monthText + " " + year + ".pdf",
                    content: pdf
                }
            ]
        }).then(pdf => {
            resolve(pdf);
        }).catch(err => {
            reject(err);
        });
    });
};

exports.sendBookingList = function(month, year, venue, pdf) {
    return new Promise((resolve, reject) => {
        let monthText = Util.monthEnum(month - 1);
        let emailSubject = "Booking List - " + monthText + " " + year;
        let emailBody = "To whom it may concern,\n\n" +
            "Attached is the booking list for " + monthText + " " + year + " for " + venue.name + ".\n" +
            "Please don't hesitate to reply back to this email if you have any questions." +
            "\n\nThanks,\nMusic Matters Bookings";
        return sendEmail({
            to: [venue.email, venue.emaillist],
            subject: emailSubject,
            text: emailBody,
            attachments: [
                {
                    filename: "Booking List " + monthText + " " + year + ".pdf",
                    content: pdf
                }
            ]
        }).then(pdf => {
            resolve(pdf);
        }).catch(err => {
            reject(err);
        });
    });
};