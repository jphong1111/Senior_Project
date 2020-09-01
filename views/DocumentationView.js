import React from 'react';
import PropTypes from 'prop-types';
import {Event, Venue} from "../objects";
import {Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View} from "react-native";
import {RadioGroup} from "react-native-btr";
import DateTimePicker from "react-native-modal-datetime-picker/src/index";
import Styles from "../styles";
import {toAMPM, toDateString, toDateTime, toMilitaryTime, toTimeString, toUS} from "../util";
import Database from "../Database";
import {withMappedNavigationProps} from "react-navigation-props-mapper";
import Dropdown from "../components/Dropdown";
import TimeInput from "../components/TimeInput";
import AppContainer from "../components/AppContainer";
import { Dimensions, Platform, PixelRatio } from 'react-native';

@withMappedNavigationProps()
export default class DocumentationView extends React.Component {
    static propTypes = {
        database: PropTypes.instanceOf(Database),
        event: PropTypes.instanceOf(Event),
        venue: PropTypes.instanceOf(Venue).isRequired,
        date: PropTypes.instanceOf(Date)
    };

    constructor(props) {
        super(props);
        this.state = {
            from: "",
            disableSendingConfirmation: false,
            disableSendingInvoice: false,
            disableSendingBookingList: false,
            disableSendingCalendar: false,
            disableSendingAllConfirmations: false,
            disableSendingAllInvoices: false,
            banners: {
                confirmations: "",
                invoices: "",
                bookinglist: "",
                calendar: ""
            },
            display: {
                confirmation: "",
                invoice: "",
                bookinglist: "",
                calendar: "",
                allConfirmations: "",
                allInvoices: "",
            },
            sendOutDays: {
                confirmations: "",
                invoices: "",
                bookinglist: "",
                calendar: "",
                allConfirmations: "",
                allInvoices: ""
            },
            months: [
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
        };

        // Set current, next, and last month & year
        let date = new Date();
        let day = date.getDate();
        this.state.yearOfThisMonth = this.props.date.getFullYear();
        this.state.thisMonth = this.props.date.getMonth();

        date.setMonth(this.props.date.getMonth() + 1);
        this.state.nextMonth = date.getMonth();
        this.state.yearOfNextMonth = date.getFullYear();

        date = new Date();
        date.setMonth(this.props.date.getMonth() - 1);
        this.state.lastMonth = date.getMonth();
        this.state.yearofLastMonth = date.getFullYear();

        // Set documentation send out days for this month, which will have all occured last month
        this.state.sendOutDays.confirmations = new Date(this.state.yearofLastMonth, this.state.lastMonth, parseInt(this.props.venue.artistConfirmationSendOut));
        this.state.sendOutDays.invoices = new Date(this.state.yearofLastMonth, this.state.lastMonth, this.props.venue.artistInvoiceSendOut);
        this.state.sendOutDays.bookinglist = new Date(this.state.yearofLastMonth, this.state.lastMonth, this.props.venue.monthlyBookingListSendOut);
        this.state.sendOutDays.calendar = new Date(this.state.yearofLastMonth, this.state.lastMonth, this.props.venue.monthlyCalendarSendOut);
        
        // Set banners to display each type of documentation
        this.state.banners.confirmations = this.state.months[this.state.thisMonth] + " " + this.state.yearOfThisMonth + "'s Confirmations";
        this.state.banners.invoices = this.state.months[this.state.thisMonth] + " " + this.state.yearOfThisMonth + "'s Invoices";
        this.state.banners.bookinglist = this.state.months[this.state.thisMonth] + " " + this.state.yearOfThisMonth + "'s Booking List";
        this.state.banners.calendar = this.state.months[this.state.thisMonth] + " " + this.state.yearOfThisMonth + "'s Calendar";

        // If you got here from EventView, set the displays accordingly
        if (this.props.event) {
            this.state.from = "EventView";
            this.state.display.confirmation = this.generateArtistConfirmationDisplay();
            this.state.display.invoice = this.generateArtistInvoiceDisplay();
            this.state.display.allConfirmations = <View style={Styles.hide}></View>
            this.state.display.allInvoices = <View style={Styles.hide}></View>
        }

        // If you got here from the MonthView, set the displays accordingly
        else {
            this.state.from = "MonthView";
            this.state.display.confirmation = <View style={Styles.hide}></View>
            this.state.display.invoice = <View style={Styles.hide}></View>
            this.state.display.allConfirmations = this.generateAllConfirmationsDisplay();
            this.state.display.allInvoices = this.generateAllInvoicesDisplay();
        }
        this.state.display.bookinglist = this.generateBookingListDisplay();
        this.state.display.calendar = this.generateCalendarDisplay();
    }

    generateArtistConfirmationDisplay() {
        let date = new Date();

        // Retrieve most recent event from database
        let event = this.props.database.events.find(event => event.id === this.props.event.id);

        // If the confirmation for this event hasn't been sent out yet and the confirmation send out date hasn't occured yet, banner should read "Scheduled for: "
        if (event.confirmationLastSent && date < this.state.sendOutDays.confirmations) {
            return (
            // <View>
                <Text style={DocumentationStyles.entryInfo}>
                    {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.artistConfirmationSendOut + ", " + this.state.yearofLastMonth}
                </Text>);
            // </View>);
        }

        // Else if the confirmation has been sent manually but the confirmation send out day hasn't occured yet, banner should read "Last Sent: & Scheduled for: "
        else if (event.confirmationLastSent && date < this.state.sendOutDays.confirmations) {
            let lastSentDate = new Date(event.confirmationLastSent);
            return (
            <View style={DocumentationStyles.entryInfo}>
                <Text>
                {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                </Text>
                <Text>
                {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.artistConfirmationSendOut + ", " + this.state.yearofLastMonth}
                </Text>);
            </View>)
        }

        // Else, the confirmation send out day has occured so the confirmation has guaranteed to be sent, banner should read "Last Sent: "
        else {
            let lastSentDate = new Date(event.confirmationLastSent);
            return (
            // <View>
                <Text style={DocumentationStyles.entryInfo}>
                {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                </Text>);
            // </View>)
        }
    }
    
    generateArtistInvoiceDisplay() {
        let date = new Date();

        // Retrieve most recent event from database
        let event = this.props.database.events.find(event => event.id === this.props.event.id);

        // If the invoice for this event hasn't been sent out yet and the invoice send out date hasn't occured yet, banner should read "Scheduled for: "
        if (event.invoiceLastSent && date < this.state.sendOutDays.invoices) {
            return (
            <View style={DocumentationStyles.entryInfo}>
                <Text>
                {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.artistInvoiceSendOut + ", " + this.state.yearofLastMonth}
                </Text>
            </View>);
        }

        // Else if the invoice has been sent manually but the invoice send out day hasn't occured yet, banner should read "Last Sent: & Scheduled for: "
        else if (event.invoiceLastSent && date < this.state.sendOutDays.invoices) {
            let lastSentDate = new Date(event.invoiceLastSent);
            return (
            <View style={DocumentationStyles.entryInfo}>
                <Text>
                {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                </Text>
                <Text>
                {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.artistInvoiceSendOut + ", " + this.state.yearofLastMonth}
                </Text>
            </View>)
        }

        // Else, the invoice send out day has occured so the invoice has guaranteed to be sent, banner should read "Last Sent: "
        else {
            // let lastSentDate = new Date(event.invoiceLastSent);
            // return (
            // // <View>
            //     <Text style={DocumentationStyles.entryInfo}>
            //     {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
            //     </Text>);
            // // </View>)
            let lastSentDate = new Date(event.invoiceLastSent);
            return (
            <View style={DocumentationStyles.entryInfo}>
                <Text>
                {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                </Text>
                <Text>
                {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.artistInvoiceSendOut + ", " + this.state.yearofLastMonth}
                </Text>
            </View>)
        }
    }
    
    generateAllConfirmationsDisplay() {
        let date = new Date();

        // Retrieve most recent venue from database
        let venue = this.props.database.venues.find(venue => venue.id === this.props.venue.id);

        // If the confirmations for this venue haven't been sent out yet and the confirmation send out date hasn't occured yet, banner should read "Scheduled for: "
        if (venue.allConfirmationsLastSent && date < this.state.sendOutDays.confirmations) {
            return (
                <View>
                    <Text style = {DocumentationStyles.setFontSizeMini}>
                    {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.artistConfirmationSendOut + ", " + this.state.yearofLastMonth}
                    </Text>
                </View>);
        }

        // Else if the confirmations have been sent manually but the invoice send out day hasn't occured yet, banner should read "Last Sent: & Scheduled for: "
        else if (venue.allConfirmationsLastSent && date < this.state.sendOutDays.confirmations) {
            let lastSentDate = new Date(venue.allConfirmationsLastSent);
            return (
                <View>
                    <Text style = {DocumentationStyles.setFontSizeMini}>
                    {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                    </Text>
                    <Text style = {DocumentationStyles.setFontSizeMini}>
                    {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.artistConfirmationSendOut + ", " + this.state.yearofLastMonth}
                    </Text>
                </View>);
        }

        // Else, the confirmation send out day has occured so the confirmations are guaranteed to be sent, banner should read "Last Sent: "
        else {
            let lastSentDate = new Date(venue.allConfirmationsLastSent);
            return (
                <View>
                    <Text style = {DocumentationStyles.setFontSizeMini}>
                    {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                    </Text>
                </View>);
        }
    }

    generateAllInvoicesDisplay() {
        let date = new Date();

        // Retrieve most recent venue from database
        let venue = this.props.database.venues.find(venue => venue.id === this.props.venue.id);

        // If the invoices for this venue haven't been sent out yet and the invoice send out date hasn't occured yet, banner should read "Scheduled for: "
        if (venue.allInvoicesLastSent && date < this.state.sendOutDays.invoices) {
            return (
                <View style={DocumentationStyles.entryInfo}>
                    <Text>
                    {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.artistInvoiceSendOut + ", " + this.state.yearofLastMonth}
                    </Text>
                </View>);
        }

        // Else if the invoices have been sent manually but the invoice send out day hasn't occured yet, banner should read "Last Sent: & Scheduled for: "
        else if (venue.allInvoicesLastSent && date < this.state.sendOutDays.invoices) {
            let lastSentDate = new Date(venue.allInvoicesLastSent);
            return (
                <View style={DocumentationStyles.entryInfo}>
                    <Text>
                    {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                    </Text>
                    <Text>
                    {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.artistInvoiceSendOut + ", " + this.state.yearofLastMonth}
                    </Text>
                </View>);
        }

        // Else, the invoice send out day has occured so the invoices are guaranteed to be sent, banner should read "Last Sent: "
        else {
            let lastSentDate = new Date(venue.allInvoicesLastSent);
            return (
                <View style={DocumentationStyles.entryInfo}>
                    <Text>
                    {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                    </Text>
                </View>);
        }
    }

    generateBookingListDisplay() {
        let date = new Date();

        // Retrieve most recent venue from database
        let venue = this.props.database.venues.find(venue => venue.id === this.props.venue.id);

        // If the booking list for this venue hasn't been sent out yet and the booking list send out date hasn't occured yet, banner should read "Scheduled for: "
        if (!venue.bookingListLastSent && date < this.state.sendOutDays.bookinglist) {
            return (
            <View>
                <Text style = {DocumentationStyles.setFontSizeMini}>
                {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.monthlyBookingListSendOut + ", " + this.state.yearofLastMonth}
                </Text>
            </View>);
        }

        // Else if the booking list has been sent manually but the booking list send out day hasn't occured yet, banner should read "Last Sent: & Scheduled for: "
        // else if (this.props.venue.bookingListastSent && date < this.state.sendOutDays.bookinglist) {
        else if (venue.bookingListLastSent && date < this.state.sendOutDays.bookinglist) {
            let lastSentDate = new Date(venue.bookingListLastSent);
            return (
            <View>
                <Text style = {DocumentationStyles.setFontSizeMini}>
                {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                </Text>
                <Text style = {DocumentationStyles.setFontSizeMini}>
                {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.monthlyBookingListSendOut + ", " + this.state.yearofLastMonth}
                </Text>
            </View>)
        }

        // Else, the booking list send out day has occured so the booking list has guaranteed to be sent, banner should read "Last Sent: "
        else {
            let lastSentDate = new Date(venue.bookingListLastSent);
            return (
            <View>
                <Text style = {DocumentationStyles.setFontSizeMini}>
                {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                </Text>
            </View>)
        }
    }

    generateCalendarDisplay() {
        let date = new Date();

        // Retrieve most recent venue from database
        let venue = this.props.database.venues.find(venue => venue.id === this.props.venue.id);
        console.log("[!] venue");
        console.log(venue);

        // If the calendar for this venue hasn't been sent out yet and the calendar send out date hasn't occured yet, banner should read "Scheduled for: "
        if (venue.calendarLastSent && date < this.state.sendOutDays.calendar) {
            return (
            <View>
                <Text style = {DocumentationStyles.setFontSizeMini}>
                {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.monthlyCalendarSendOut + ", " + this.state.yearofLastMonth}
                </Text>
            </View>);
        }

        // Else if the calendar has been sent manually but the calendar send out day hasn't occured yet, banner should read "Last Sent: & Scheduled for: "
        else if (venue.calendarLastSent && date < this.state.sendOutDays.calendar) {
            let lastSentDate = new Date(venue.calendarLastSent);
            return (
            <View>
                <Text style = {DocumentationStyles.setFontSizeMini}>
                {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                </Text>
                <Text style = {DocumentationStyles.setFontSizeMini}>
                {"Scheduled for: " + this.state.months[this.state.lastMonth] + " " + this.props.venue.monthlyCalendarSendOut + ", " + this.state.yearofLastMonth}
                </Text>
            </View>)
        }

        // Else, the calendar send out day has occured so the calendar has guaranteed to be sent, banner should read "Last Sent: "
        else {
            let lastSentDate = new Date(venue.calendarLastSent);
            return (
            <View>
                <Text style = {DocumentationStyles.setFontSizeMini}>
                {"Last sent: " + this.state.months[lastSentDate.getMonth()] + " " + lastSentDate.getDate() + ", " + lastSentDate.getFullYear()}
                </Text>
            </View>)
        }
    }

    render() {
        return (
            <AppContainer style={Styles.infoView}>
                <View style={Styles.contentContainer}>
                    <Text style={Styles.infoTitle}>Documentation</Text>
                </View>
                <View style={this.state.from === "EventView" ? DocumentationStyles.entryContainer : Styles.hide}>
                    {/* <View> */}
                        <Text style={DocumentationStyles.entryName}>Artist Confirmation</Text>
                        {/* {this.state.display.confirmation}
                    </View> */}
                    <View style={DocumentationStyles.entryButton}>
                        <Button
                            title = "Send"
                            disabled = {this.state.disableSendingConfirmation}
                            onPress = {() => {
                                Alert.alert(
                                    "Confirmation", 
                                    "Are you sure you want to send out this artist confirmation?",
                                    [
                                        {
                                            text: "Cancel"
                                        },
                                        {
                                            text: "OK", 
                                            onPress: () => {
                                                this.props.database.generateSendSaveOne({
                                                    type: "artist_confirmation",
                                                    eventID: this.props.event.id
                                                }).then(() => {
                                                    alert("Artist confirmation successfully sent!");
                                                }).catch((err) => {
                                                    alert("An error occurred while sending the artist confirmation.\n" + err);
                                                }).finally(() => {
                                                    this.setState({
                                                        disableSendingConfirmation: false,
                                                        // display: {
                                                        //     confirmation: this.generateArtistConfirmationDisplay(),
                                                        //     invoice: this.state.display.invoice,
                                                        //     bookinglist: this.state.bookinglist,
                                                        //     calendar: this.state.display.calendar,
                                                        //     allConfirmations: this.state.display.allConfirmations,
                                                        //     allInvoices: this.state.display.allInvoices
                                                        // }
                                                    });
                                                });
                
                                                alert("The artist confirmation is being generated, saved to the Google Drive, and emailed out." +
                                                " Please wait until this has complete before requesting again." +
                                                " This may take up to a minute to complete.");
                
                                                this.setState({
                                                    disableSendingConfirmation: true
                                                });
                                            }
                                        }
                                    ],
                                    {cancelable: true}
                                );
                            }}
                        />
                    </View>
                </View>
                <View style={this.state.from === "EventView" ? DocumentationStyles.entryContainer : Styles.hide}>
                    {/* <View> */}
                        <Text style={DocumentationStyles.entryName}>Artist Invoice</Text>
                        {/* {this.state.display.invoice} */}
                    {/* </View> */}
                    <View style={DocumentationStyles.entryButton}>
                        <Button
                            title = "Send"
                            disabled = {this.state.disableSendingInvoice}
                            onPress = {() => {
                                Alert.alert(
                                    "Confirmation",
                                    "Are you sure you want to send this artist invoice?",
                                    [
                                        {
                                            text: "Cancel"
                                        },
                                        {
                                            text: "OK",
                                            onPress: () => {
                                                this.props.database.generateSendSaveOne({
                                                    type: "invoice",
                                                    eventID: this.props.event.id
                                                }).then(() => {
                                                    alert("Artist invoice successfully sent!");
                                                }).catch((err) => {
                                                    alert("An error occurred while sending the artist invoice.\n" + err);
                                                }).finally(() => {
                                                    this.setState({
                                                        disableSendingInvoice: false,
                                                        // display: {
                                                        //     confirmation: this.state.display.confirmation,
                                                        //     invoice: this.generateArtistInvoiceDisplay(),
                                                        //     bookinglist: this.state.display.bookinglist,
                                                        //     calendar: this.state.display.calendar,
                                                        //     allConfirmations: this.state.display.allConfirmations,
                                                        //     allInvoices: this.state.display.allInvoices
                                                        // }
                                                    });
                                                });
                                                
                                                alert("The artist invoice is being generated, saved to the Google Drive, and emailed out." +
                                                " Please wait until this has complete before requesting again." +
                                                " This may take up to a minute to complete.");
                
                                                this.setState({
                                                    disableSendingInvoice: true
                                                });
                                            }
                                        }
                                    ],
                                    {cancelable: true}
                                );
                            }}
                        />
                    </View>
                </View>
                <View style={DocumentationStyles.entryContainer}>
                    <Text style={DocumentationStyles.entryName}>{this.state.banners.confirmations}</Text>
                    {/* {this.state.display.allConfirmations} */}
                    <View style={DocumentationStyles.entryButton}>
                        <Button
                            title = "Send"
                            disabled = {this.state.disableSendingAllConfirmations}
                            onPress = {() => {


                                Alert.alert(
                                    "Confirmation",
                                    "Are you sure you want to send all confirmations for the selected month?",
                                    [
                                        {
                                            text: "Cancel"
                                        },
                                        {
                                            text: "OK",
                                            onPress: () => {
                                                this.props.database.generateSendSaveAll({
                                                    type: "artist_confirmation",
                                                    venueID: this.props.venue.id,
                                                    month: this.props.date.getMonth() + 1,
                                                    year: this.props.date.getFullYear()
                                                }).then((result) => {
                                                    alert("All artist confirmations successfully sent!");
                                                }).catch((result) => {
                                                    if (!result.include("deadline-exceeded")) { // supress the deadline-exceeded error
                                                        alert("An error occurred while sending one of the artist confirmations.\n" + result);
                                                    }
                                                    else {
                                                        alert("All artist confirmations successfully sent!");
                                                    }
                                                }).finally(() => {
                                                    this.setState({
                                                        disableSendingAllConfirmations: false,
                                                        // display: {
                                                        //     confirmation: this.state.display.confirmation,
                                                        //     invoice: this.state.display.invoice,
                                                        //     bookinglist: this.state.display.bookinglist,
                                                        //     calendar: this.state.display.calendar,
                                                        //     allConfirmations: this.generateAllConfirmationsDisplay(),
                                                        //     allInvoices: this.state.display.allInvoices
                                                        // }
                                                    });
                                                });
                                                
                                                alert("All of the artist confirmations are being generated, saved to the Google Drive, and emailed out." +
                                                " Please wait until this has complete before requesting again." +
                                                " This may take up to a minute to complete.");
                
                                                this.setState({
                                                    disableSendingAllConfirmations: true
                                                });
                                            }
                                        }
                                    ],
                                    {cancelable: true}
                                );
                            }}
                        />
                    </View>
                </View>
                    <View style={DocumentationStyles.entryContainer}>
                        <Text style = {DocumentationStyles.entryName}>{this.state.banners.invoices}</Text>
                        {/* {this.state.display.allInvoices} */}
                        <View style={DocumentationStyles.entryButton}>
                        <Button
                            title = "Send"
                            disabled = {this.state.disableSendingAllInvoices}
                            onPress = {() => {

                                
                                Alert.alert(
                                    "Confirmation",
                                    "Are you sure you want to send the artist invoices for the selected month?",
                                    [
                                        {
                                            text: "Cancel"
                                        },
                                        {
                                            text: "OK",
                                            onPress: () => {
                                                this.props.database.generateSendSaveAll({
                                                    type: "invoice",
                                                    venueID: this.props.venue.id,
                                                    month: this.props.date.getMonth() + 1,
                                                    year: this.props.date.getFullYear()
                                                }).then(() => {
                                                    alert("All artist invoices successfully sent!");
                                                }).catch((result) => {
                                                    if (!result.include("deadline-exceeded")) { // supress the deadline-exceeded error
                                                        alert("An error occurred while sending one of the artist invoices.\n" + result);
                                                    }
                                                    else {
                                                        alert("All artist invoices successfully sent!");
                                                    }
                                                }).finally(() => {
                                                    this.setState({
                                                        disableSendingAllInvoices: false,
                                                        // display: {
                                                        //     confirmation: this.state.display.confirmation,
                                                        //     invoice: this.state.display.invoice,
                                                        //     bookinglist: this.state.display.bookinglist,
                                                        //     calendar: this.state.display.calendar,
                                                        //     allConfirmations: this.state.display.allConfirmations,
                                                        //     allInvoices: this.generateAllInvoicesDisplay()
                                                        // }
                                                    });
                                                });
                                                
                                                alert("All of the artist invoices are being generated, saved to the Google Drive, and emailed out." +
                                                " Please wait until this has complete before requesting again." +
                                                " This may take up to a minute to complete.");
                
                                                this.setState({
                                                    disableSendingAllInvoices: true
                                                });
                                            }
                                        }
                                    ],
                                    {cancelable: true}
                                );
                            }}
                        />
                    </View>
                </View>
                <View style={DocumentationStyles.entryContainer}>
                        <Text style = {DocumentationStyles.entryName}>{this.state.banners.bookinglist}</Text>
                        {/* {this.state.display.bookinglist} */}
                        <View style={DocumentationStyles.entryButton}>
                        <Button
                            title = "Send"
                            disabled = {this.state.disableSendingBookingList}
                            onPress = {() => {

                                
                                Alert.alert(
                                    "Confirmation",
                                    "Are you sure you want to send the booking list for the selected month?",
                                    [
                                        {
                                            text: "Cancel"
                                        },
                                        {
                                            text: "OK",
                                            onPress: () => {
                                                this.props.database.generateSendSaveOne({
                                                    type: "booking_list",
                                                    venueID: this.props.venue.id,
                                                    month: this.props.date.getMonth() + 1,
                                                    year: this.props.date.getFullYear()
                                                }).then(() => {
                                                    alert("Booking list successfully sent!");
                                                }).catch((err) => {
                                                    alert("An error occurred while sending the booking list.\n" + err);
                                                }).finally(() => {
                                                    this.setState({
                                                        disableSendingBookingList: false,
                                                        // display: {
                                                        //     confirmation: this.state.display.confirmation,
                                                        //     invoice: this.state.display.invoice,
                                                        //     bookinglist: this.generateBookingListDisplay(),
                                                        //     calendar: this.state.display.calendar,
                                                        //     allConfirmations: this.state.display.allConfirmations,
                                                        //     allInvoices: this.state.display.allInvoices
                                                        // }
                                                    });
                                                });
                                                
                                                alert("The booking list is being generated, saved to the Google Drive, and emailed out." +
                                                " Please wait until this has complete before requesting again." +
                                                " This may take up to a minute to complete.");
                
                                                this.setState({
                                                    disableSendingBookingList: true
                                                });
                                            }
                                        }
                                    ],
                                    {cancelable: true}
                                );
                            }}
                        />
                    </View>
                    </View>
                    <View style={DocumentationStyles.entryContainer}>
                        <Text style = {DocumentationStyles.entryName}>{this.state.banners.calendar}</Text>
                        {/* {this.state.display.calendar} */}
                        <View style={DocumentationStyles.entryButton}>
                        <Button
                            title = "Send"
                            disabled = {this.state.disableSendingCalendar}
                            onPress = {() => {

                                
                                Alert.alert(
                                    "Confirmation",
                                    "Are you sure you want to send the calendar for the selected month?",
                                    [
                                        {
                                            text: "Cancel"
                                        },
                                        {
                                            text: "OK",
                                            onPress: () => {
                                                this.props.database.generateSendSaveOne({
                                                    type: "calendar",
                                                    venueID: this.props.venue.id,
                                                    month: this.props.date.getMonth() + 1,
                                                    year: this.props.date.getFullYear()
                                                }).then(() => {
                                                    alert("Calendar successfully sent!");
                                                }).catch((err) => {
                                                    alert("An error occurred while sending the calendar.\n" + err);
                                                }).finally(() => {
                                                    this.setState({
                                                        disableSendingCalendar: false,
                                                        // display: {
                                                        //     confirmation: this.state.display.confirmation,
                                                        //     invoice: this.state.display.invoice,
                                                        //     bookinglist: this.state.display.bookinglist,
                                                        //     calendar: this.generateCalendarDisplay(),
                                                        //     allConfirmations: this.state.display.allConfirmations,
                                                        //     allInvoices: this.state.display.allInvoices
                                                        // }
                                                    });
                                                });
                                                
                                                alert("The calendar is being generated, saved to the Google Drive, and emailed out." +
                                                " Please wait until this has complete before requesting again." +
                                                " This may take up to a minute to complete.");
                
                                                this.setState({
                                                    disableSendingCalendar: true
                                                });
                                            }
                                        }
                                    ],
                                    {cancelable: true}
                                );
                            }}
                        />
                    </View>
                </View>
            <View style={DocumentationStyles.emptyContainer}>
                </View>
            </AppContainer>
        );
    }
}


const {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
} = Dimensions.get('window');

// based on iphone 5s's scale
const scale = SCREEN_WIDTH / 320;

export function normalize(size) {
  const newSize = size * scale 
  if (Platform.OS === 'ios') {
    return Math.round(PixelRatio.roundToNearestPixel(newSize))
  } else {
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2
  }
}

export function giveProperSize(size) {
    if (size > 600)
        {
            return 0.66
        }
    else
        {
            return 2
        }
    
}
                
                
export const DocumentationStyles = StyleSheet.create({
    entryContainer: {
        // backgroundColor: "#fff",
        // display: "flex",
        // flex: giveProperSize(SCREEN_HEIGHT),
        // flexDirection: "column",
        // fontSize: normalize(24),
        // padding: 4,
        // margin: 12,
        // borderWidth: 1,
        // borderRadius: 10,
        // borderColor: "#ccc",
        // alignItems: "flex-start",
        // textAlign: "left",
        // height: 64,
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "row",
        flex: 1,
        padding: 7,
        marginBottom: 5,
        borderWidth: 1,
        borderRadius: 10,
        borderColor: "#ccc",
        alignItems: "center",
        justifyContent: "space-between",
        marginRight: 15,
        marginLeft: 15
    },
    entryName: {
        // flexGrow: 3,
        // flexBasis: 60,
        // fontSize: 20,
        // color: "pink"
        flexGrow: 3,
        flexBasis: 60,
        fontSize: 20
    },
    entryInfo: {
        flexGrow: 3,
        // flexBasis: 60,
        flexBasis: 10,
        fontSize: normalize(15),
        color: "#808080",
    },
    entryButton: {
        backgroundColor: "#f8f8f8",
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 10,
        flexGrow: 1,
        flexBasis: 40,
        margin: 5,
        color: "#4682B4",
        fontWeight: "200"
    },
    setFontSize: {
        fontSize: normalize(14)
    },
    setFontSizeMini: {
        fontSize: normalize(11)
    },
    emptyContainer: {
        backgroundColor: "#fff",
        display: "flex",
        flex: 5,
        flexDirection: "column",
        //font-size: 18px,
        padding: 4,
        margin: 12,
        //borderWidth: 1,
        //borderRadius: 10,
        //borderColor: "#ccc",
        alignItems: "flex-start",
        textAlign: "left",
        height: 64
        //justifyContent: "center"
    },
    sendButton: {
        backgroundColor: "#f8f8f8",
        //display: "flex",
        flexDirection: "row",
        //padding: 20,
        //margin: 10,
        borderWidth: 1,
        borderRadius: 10,
        borderColor: "#ccc",
        alignItems: "center",
        textAlign: "center",
        justifyContent: "center",
        //left: 12,
        position: "relative",
        bottom: normalize(26),
        left: normalize(208),
        height: normalize(32),
        width: normalize(74)
        
    }
});

