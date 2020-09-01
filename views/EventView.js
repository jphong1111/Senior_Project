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

@withMappedNavigationProps()
export default class EventView extends React.Component {
    static propTypes = {
        event: PropTypes.instanceOf(Event),
        defaultVenue: PropTypes.instanceOf(Venue),
        defaultDate: PropTypes.instanceOf(Date),
        onSave: PropTypes.func.isRequired,
        onDelete: PropTypes.func,
        database: PropTypes.instanceOf(Database)
    };

    constructor(props) {
        super(props);
        let event = this.props.event || new Event();
        this.isNew = !event.id;

        this.state = {
            clientID:  event.clientID || this.props.database.clients[0].id,
            clientName: event.clientName || "",
            venueID: this.isNew ? this.props.defaultVenue.id : event.venueID,
            price: event.price.toString() || "",
            date: this.isNew ? toDateString(this.props.defaultDate) : toDateString(event.start),
            startTime: toTimeString(event.start),
            endTime: toTimeString(event.end),
            customTime: false,
            didChangeCustomStart: false,
            didChangeCustomEnd: false,
            buttons: [],
            isClientDeleted: false,
            disableDocGeneration: false
        };

        this.state.buttons = this._generateRadioButtons();

        if (this.isNew) {
            // Set default time slots to be the first time slots for the current venue
            let venue = this.props.database.venues.find(element => element.id === this.state.venueID);
            let presetTimeSlots = venue.presetTimeSlots;
            if (presetTimeSlots.length) {
                presetTimeSlots = this.sortAndFilterTimeSlots(presetTimeSlots);
                this.state.startTime = presetTimeSlots[0].start;
                this.state.endTime = presetTimeSlots[0].end;
            }
        }
        else {
            if (!this.props.database.clients.find(client => client.id === this.state.clientID)) {
                this.state.isClientDeleted = true;
            }
        }
    }

    sortAndFilterTimeSlots(timeSlots) {

        // Filter null slots from preset time slots
        timeSlots = timeSlots.filter(timeSlot => {
            return timeSlot.start != "null" && timeSlot.end != "null";
        });
        
        // Sort preset time slots
        timeSlots = timeSlots.sort(function(el1, el2) {
            var hour1 = parseInt(el1.start.split(':')[0]);
            var hour2 = parseInt(el2.start.split(':')[0]);
            return hour1 - hour2;
        });

        return timeSlots;
    }

    _generateRadioButtons() {

        // Get the current Venue's preset time slot list
        var venue = this.props.database.venues.find(element => element.id === this.state.venueID);
        var presetTimeSlots = venue.presetTimeSlots;

        // Filter null values and sort time slots
        presetTimeSlots = this.sortAndFilterTimeSlots(presetTimeSlots);

        // Transform into an array of labels, each in the form of "1:00 PM - 11:00PM"
        var timeRanges = [];
        for (var i in presetTimeSlots) {
            var timeSlot = presetTimeSlots[i];
            var startAmPm = toAMPM(timeSlot.start);
            var endAmPm = toAMPM(timeSlot.end);
            timeRanges.push(startAmPm + " - " + endAmPm);
        }

        // Transform in to an array that has each label corresponding to an index in the timeRanges array
        // Example: [{'label': '1:00PM - 11:00PM', 'value': 0}]
        var buttons = [];
        for (var i = 0; i < timeRanges.length; i++) {
            buttons.push({label: timeRanges[i], value: i});
        }

        // Configure custom time slot button
        buttons.push({
            label: "Custom",
            value: "c"
        });

        // If editing the event, have the previously selected time slot checked. Else, check the first time slot by default
        let timeString = [toAMPM(this.state.startTime), toAMPM(this.state.endTime)].join(" - ");
        let matchingButton = buttons.find(button => {
            return button.label === timeString;
        });

        if (this.isNew) {
            buttons[0].checked = true;
            if (buttons[0].value === "c") {
                this.state.customTime = true;
            }
        }
        else {
            if (matchingButton) {
                matchingButton.checked = true;
            }
            else {
                buttons[buttons.length - 1].checked = true;
                this.state.customTime = true;
            }
        }
        return buttons;
    }

    _handleDocumentSending(includeMonthDocs) {
        let docQueries = [];

        // Request for this event's confirmation to be generated & sent
        docQueries.push(this.props.database.sendForm({
            type: "artist_confirmation",
            event: this.props.event.id
        }));

        // Request for this event's invoice to be generated & sent
        docQueries.push(this.props.database.sendForm({
            type: "invoice",
            event: this.props.event.id
        }));

        
        if (includeMonthDocs) {

            // Request for next month's calendar and booking list (why next month?) to be generated & sent
            docQueries.push(this.props.database.sendForm({
                type: "booking_list",
                venue: this.props.event.venueID,
                month: this.props.event.start.getMonth() + 1,
                year: this.props.event.start.getFullYear()
            }));
            docQueries.push(this.props.database.sendForm({
                type: "calendar",
                venue: this.props.event.venueID,
                month: this.props.event.start.getMonth() + 1,
                year: this.props.event.start.getFullYear()
            }));
        }

        // Resolved once all requests to generate and send documentation are resolved
        Promise.all(docQueries).then(() => {
            alert("Emails successfully sent!");
        }).catch(err => {
            alert("An error occurred while sending the emails.\n" + err);
            console.error(err);
        }).finally(() => {
            this.setState({
                disableDocGeneration: false
            });
        });

        alert("Emails have now begun sending." +
            " Please wait until all emails have been sent before requesting more." +
            " This may take up to a minute to complete."
        );

        this.setState({
            disableDocGeneration: true
        });
    }

    render() {
        return (
            <AppContainer style={Styles.infoView}>
                <View style={Styles.contentContainer}>
                    <Text style={Styles.infoTitle}>
                        {this.isNew ? "Create New Booking" : "Manage Booking"}
                    </Text>

                    {/* Client Selector */}
                    <View style={this.state.isClientDeleted ? Styles.hide : Styles.inputRow}>
                        <Text style={Styles.inputTitle}>Client</Text>
                        <Dropdown style={Styles.pickerBox}
                            options = {this.props.database.clients.map(client => {
                                return {
                                    label: client.stageName,
                                    value: client.id
                                };
                            })}
                            selectedValue = {this.state.clientID}
                            onValueChange = {value => this.setState({clientID: value})}
                        />
                    </View>
                    <View style={this.state.isClientDeleted ? Styles.inputRow : Styles.hide}>
                        <Text style={Styles.inputTitle}>Client</Text>
                        <Text style={Styles.inputTitle}>{this.state.clientName}</Text>
                    </View>

                    {/* Date Selector */}
                    <View style={Styles.dateContainer}>
                        <Text style={Styles.inputTitle}>Date</Text>
                        <DateInput style={Styles.inputBox}
                            value={toUS(this.state.date)}
                            onValueChange={value => this.setState({date: value})}
                        />
                    </View>

                    {/* Time Selector*/}
                    <View style={Styles.inputRow}>
                        <Text style={Styles.inputTitle}>Time</Text>
                        <RadioGroup style={Styles.datetimeContainer}
                            key = {this.state.date}
                            selectedIndex = {0}
                            radioButtons = {this._generateRadioButtons()}
                            onPress = {buttons => {
                                let selected = buttons.find(b => b.checked);
                                if (selected.value === "c") {
                                    this.setState({customTime: true});
                                } else {
                                    let splits = selected.label.split("-");
                                    this.setState({
                                        startTime: toMilitaryTime(splits[0].trim()),
                                        endTime: toMilitaryTime(splits[1].trim()),
                                        customTime: false
                                    });
                                }
                                this.setState({
                                    buttons: buttons
                                });
                            }}
                        />
                    </View>
                    <View style={this.state.customTime ? Styles.customTimeContainer : Styles.hide}>
                        <View style={Styles.inputRow}>
                            <Text style={Styles.customTimeTitle}>Start Time</Text>
                            <TimeInput
                                value = {this.isNew ? "5:00 PM" : this.state.startTime}
                                onValueChange = {time => this.setState({startTime: time, didChangeCustomStart: true})}
                            />
                        </View>
                    </View>
                    <View style={this.state.customTime ? Styles.customTimeContainer : Styles.hide}>
                        <View style={Styles.inputRow}>
                            <Text style={Styles.customTimeTitle}>End Time</Text>
                            <TimeInput
                                value = {this.isNew ? "7:00 PM" : this.state.endTime}
                                onValueChange = {time => this.setState({endTime: time, didChangeCustomEnd: true})}
                            />
                        </View>
                    </View>

                    {/* Price Input */}
                    <View style={Styles.inputRow}>
                        <Text style={Styles.inputTitle}>Price</Text>
                        <TextInput style={Styles.inputBox}
                            keyboardType = "numeric"
                            returnKeyType = "done"
                            value = {this.state.price}
                            onChangeText = {value => {
                                if (new RegExp(`^\\d*(\\.\\d{0,2})?$`).test(value)) {
                                    this.setState({price: value});
                                } else {
                                    alert("Please only enter monetary values.");
                                    this.setState({price: this.state.price});
                                }
                            }}
                        />
                    </View>
                </View>

                <View style={Styles.buttonContainer}>
                    {this.isNew ? null :
                        <Button
                            title = "Generate Forms"
                            disabled = {this.state.disableDocGeneration}
                            color = "green"
                            onPress = {() => {
                                this.props.navigation.navigate("Documentation", {
                                    database: this.props.database,
                                    event: this.props.event,
                                    venue: this.props.defaultVenue,
                                    date: this.props.defaultDate
                                });
                            }}
                        />
                    }

                    {this.isNew ? null : <View style={Styles.buttonBuffer}/>}

                    {/* Create/Update Button */}
                    <Button
                        title = {this.isNew ? "Create Booking" : "Save Booking"}
                        onPress = {() => {
                            if (!this.state.clientID) {
                                alert("Please choose a valid client", "Error");
                            }
                            else {
                                let event = this.props.event || new Event();
    
                                var buttons = this.state.buttons;
                                var checkedButton = buttons.find(element => element.checked);
                                if (this.state.customTime) {
                                    if (this.isNew) {
                                        if (!this.state.didChangeCustomStart) {
                                            this.state.startTime = "17:00";
                                        }
                                        if (!this.state.didChangeCustomEnd) {
                                            this.state.endTime = "19:00";
                                        }
                                    }
                                }
                                else {
                                    var splits = checkedButton.label.split("-");
                                    this.setState({
                                        startTime: toMilitaryTime(splits[0].trim()),
                                        endTime: toMilitaryTime(splits[1].trim()),
                                        customTime: false
                                    });
                                }   
                                event.update(this.state);
                                this.props.navigation.goBack();
                                this.props.onSave(event);
                            }
                        }}
                    />

                    {this.isNew ? null : <View style={Styles.buttonBuffer}/>}

                    { /* Delete Button */
                        this.isNew ? null :
                            <Button
                                title = "Delete Booking"
                                color = "red"
                                onPress = {() => {
                                    Alert.alert("Confirmation",
                                        "Are you sure you want to delete this booking?",
                                        [
                                            {
                                                text: "Cancel"
                                            },
                                            {
                                                text: "OK",
                                                onPress: () => {
                                                    this.props.navigation.goBack();
                                                    this.props.onDelete(this.props.event);
                                                }
                                            }
                                        ],
                                        {cancelable: true}
                                    );
                                }}
                            />
                    }
                </View>
            </AppContainer>
        );
    }
}

//helper class to input date since the datepicker is bizarrely complex
class DateInput extends React.Component {
    static propTypes = {
        onValueChange: PropTypes.func.isRequired,
        value: PropTypes.string
    };

    static defaultProps = {
        value: toUS(toDateString(new Date()))
    };

    constructor(props) {
        super(props);

        this.state = {
            value: toDateTime({date: this.props.value}),
            open: false
        };
    }

    render() {
        return (
            <View style={Styles.datetimeContainer}>
                <TouchableOpacity style={Styles.inputBox}
                    onPress = {() => this.setState({open: true})}
                >
                    <Text>{toUS(toDateString(this.state.value))}</Text>
                </TouchableOpacity>
                <DateTimePicker
                    date = {this.state.value}
                    mode = "date"
                    isVisible = {this.state.open}
                    onConfirm = {date => {
                        this.setState({
                            value: date,
                            open: false
                        });
                        this.props.onValueChange(toDateString(date));
                    }}
                    onCancel = {() => this.setState({open: false})}
                />
            </View>
        );
    }
}

const EventStyles = StyleSheet.create({
    moreContainer: {
        width: "10%"
    }
});

