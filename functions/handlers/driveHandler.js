const {google} = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const Functions = require("firebase-functions");

const env = Functions.config();
const {client_id, client_secret, redirect_uris} = env.drive.web;
const oAuthClient = new OAuth2(client_id, client_secret, redirect_uris[0]);
oAuthClient.setCredentials({
    refresh_token: env.drive.refresh_token
});

const Drive = google.drive({
    version: "v3",
    auth: oAuthClient
});

const months = [
    'January', 
    'February', 
    'March', 
    'April', 
    'May', 
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
]

const getMatchingFolder = function (options) {
    let queryParams = [];
    queryParams.push("mimeType='application/vnd.google-apps.folder'");

    if (options.id) {
        queryParams.push("id = '" + options.id + "'");
    }

    if (options.name) {
        queryParams.push("name = '" + options.name + "'");
    }

    if (options.parents) {
        options.parents.forEach(id => {
            queryParams.push("'" + id + "'" + " in parents");
        });
    }

    if (!options.searchTrash) {
        queryParams.push("not trashed");
    }

    return new Promise((res, rej) => {
        Drive.files.list({
            q: queryParams.join(" and ")
        }).then(response => {
            if (response.data.files.length < 1) {
                createFolder(options.name, options).then(response => {
                    res(response.data);
                }).catch(rej);
            } else {
                res(response.data.files[0]);
            }
        }).catch(rej);
    });
};

const getNestedFolders = function(venueName, year, month, day) {
    const documentationRootID = '1vmZCHaiUFBashZ_mwOkUabYU14fGZVSb';
    return new Promise((resolve, reject) => {
        return getMatchingFolder({
            name: venueName,
            parents: [documentationRootID]
        }).then(folder => {
            return getMatchingFolder({
                name: year,
                parents: [folder.id]
            });
        }).then(folder => {
            return getMatchingFolder({
                name: months[parseInt(month) - 1],
                parents: [folder.id]
            });
        }).then(folder => {
            if (day) {
                return getMatchingFolder({
                    name: day,
                    parents: [folder.id]
                });
            }
            else {
                return folder;
            }
        }).then(folder => {
            resolve(folder);
        }).catch(err => {
            reject(err);
        });
    });
}

const createFolder = function (name, options) {
    let folderInfo = {
        name: name,
        mimeType: "application/vnd.google-apps.folder"
    };

    if (options.parents) {
        folderInfo.parents = options.parents;
    }

    return Drive.files.create({
        resource: folderInfo
    });
};

const uploadPDF = function (name, pdf, options) {
    return new Promise((resolve, reject) => {
        let fileInfo = {
            name: name,
            mimeType: "application/pdf"
        };
    
        if (options.parents) {
            fileInfo.parents = options.parents;
        }
        return Drive.files.create({
            resource: fileInfo,
            media: {
                mimeType: "application/pdf",
                body: pdf
            }
        }).then(res => {
            resolve(pdf);
        }).catch(err => {
            reject(err);
        });
        
    });
};

exports.uploadArtistConfirmation = function (event, client, venue, pdf) {
    return new Promise((resolve, reject) => {
        const year = event.date.split('-')[0];
        const month = event.date.split('-')[1];
        const day = event.date.split('-')[2];
        return getNestedFolders(venue.name, year, month, day).then(folder => {
            let fileName = [venue.name, event.date, `${event.start}-${event.end}`, client.stage].join("/") + " - Confirmation.pdf";
            return uploadPDF(fileName, pdf, {
                parents: [folder.id]
            });
        }).then(pdf => {
            resolve(pdf);
        }).catch(err => {
            reject(err);
        });
    });
};

exports.uploadInvoice = function (event, client, venue, pdf) {
    return new Promise((resolve, reject) => {
        const year = event.date.split('-')[0];
        const month = event.date.split('-')[1];
        const day = event.date.split('-')[2];
        return getNestedFolders(venue.name, year, month, day).then(folder => {
            let fileName = [venue.name, event.date, `${event.start}-${event.end}`, client.stage].join("/") + " - Invoice.pdf";
            return uploadPDF(fileName, pdf, {
                parents: [folder.id]
            });
        }).then(pdf => {
            resolve(pdf);
        }).catch(err => {
            reject(err);
        });
    });
};

exports.uploadBookingList = function (month, year, venue, pdf) {
    return new Promise((resolve, reject) => {
        return getNestedFolders(venue.name, year, month, '').then(folder => {
            let fileName = [venue.name, `${year}-${month}`].join("/") + " - Booking List.pdf";
            return uploadPDF(fileName, pdf, {
                parents: [folder.id]
            });
        }).then(pdf => {
            resolve(pdf);
        }).catch(err => {
            reject(err);
        });
    });
};

exports.uploadCalendar = function (month, year, venue, pdf) {
    return new Promise((resolve, reject) => {
        return getNestedFolders(venue.name, year, month, '').then(folder => {
            let fileName = [venue.name, `${year}-${month}`].join("/") + " - Calendar.pdf";
            return uploadPDF(fileName, pdf, {
                parents: [folder.id]
            });
        }).then(pdf => {
            resolve(pdf);
        }).catch(err => {
            reject(err);
        });
    });
};
