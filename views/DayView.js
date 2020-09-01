import {Button, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import PropTypes from "prop-types";
import {Agenda} from "react-native-calendars";
import React from "react";
import _ from "lodash";
import {withMappedNavigationProps} from "react-navigation-props-mapper";
import {dayInMS, randomColor, toAMPM, toDateString, toDateTime, toTimeString, blackColor} from "../util";
import {Client, Event, Venue} from "../objects";
import Database from "../Database";
import Styles from "../styles";
import Dropdown from "../components/Dropdown";
import AppContainer from "../components/AppContainer";
import MoreButton from "../components/MoreButton";

console.disableYellowBox = true;
@withMappedNavigationProps()
export default class DayView extends React.Component {
    static propTypes = {
        selectedDate: PropTypes.instanceOf(Date).isRequired,
        selectedVenue: PropTypes.instanceOf(Venue).isRequired,
        database: PropTypes.instanceOf(Database).isRequired,
    };

    constructor(props) {
        super(props);
        
        this.state = {
            selectedVenue: this.props.selectedVenue,
            selectedDate: this.props.selectedDate
        };
    }

    shouldComponentUpdate() {
        return true;
    }

    _generateDateStorage() {
        let dateEvents = {};

        // Initialize date properties for object
        // _.range(-13, 16).forEach(mult => {
        _.range(-30, 31).forEach(mult => {
            let date = new Date(this.props.selectedDate.getTime());
            date.setTime(date.getTime() + mult * dayInMS);

            dateEvents[toDateString(date)] = [];
        });

        // Insert events into object
        let filteredEvents = this.props.database.events.filter(event => event.venueID === this.state.selectedVenue.id);
        filteredEvents.forEach(event => {
            let eventDate = toDateString(event.start);
            if (dateEvents[eventDate]) {
                dateEvents[eventDate].push(event);
            }
        });

        // Insert football games into the events object
        const date = new Date(this.props.selectedDate.getTime());
        const year = date.getFullYear().toString();
        const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : (date.getMonth() + 1).toString();
        const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate().toString();
        if (
            year in this.props.database.games &&
            month in this.props.database.games[year] &&
            day in this.props.database.games[year][month]
        ) {
            const gameDay = this.props.database.games[year][month][day];
            if ("auburn" in gameDay) {
                gameDay.auburn.team = "auburn";
                dateEvents[gameDay.auburn.date].push(gameDay.auburn);
            }
            if ("alabama" in gameDay) {
                gameDay.alabama.team = "alabama";
                dateEvents[gameDay.alabama.date].push(gameDay.alabama);
            }
        }

        // If today is a holiday, insert into the events object
        this.props.database.holidays
        .filter(holiday => holiday.end.toDateString() === this.props.selectedDate.toDateString())
        .forEach(holiday => {
            const dateString = holiday.date.split(' ')[0];
            dateEvents[dateString].push(holiday);
        });

        // Sort events within object
        for (let date in dateEvents) {
            if (dateEvents.hasOwnProperty(date)) {
                dateEvents[date].sort((eventA, eventB) => eventA.start < eventB.start ? -1 : 1);
            }
        }

        return dateEvents;
    }

    render() {
        return (
            <AppContainer>
                <View style={Styles.calendarHeader}>
                    <Dropdown style={Styles.calendarDropdown}
                                options = {this.props.database.venues.map(venue => {
                                  return {
                                      label: venue.name,
                                      value: venue.id
                                  };
                              })}
                              selectedValue = {this.state.selectedVenue.id}
                              onValueChange = {venueID => {
                                  if (venueID !== null) {
                                      this.setState({selectedVenue: this.props.database.venues.find(venue => venue.id === venueID)})
                                  }
                              }}
                    />
                    <MoreButton
                        onPress={() => this.props.navigation.navigate("VenueManage", {
                            database: this.props.database,
                            onReturn: venues => {
                                console.log(venues);
                            }
                        })}
                    />
                </View>
                <Agenda
                    hideKnob = {true}
                    selected = {toDateString(this.props.selectedDate)}
                    onDayPress = {day => {
                        this.setState({selectedDate: toDateTime({date: day.dateString})})
                    }}
                    items = {this._generateDateStorage()}
                    rowHasChanged = {(eventA, eventB) => { 
                        if (eventA.clientID || eventA.clientName) {
                            !eventA.isEqual(eventB)
                        }
                    }}
                    renderItem = {(event, first) => {
                        return (
                            <EventBox
                                event = {event}
                                first = {first}
                                client = {this.props.database.clients.find(client => client.id === event.clientID)}
                                onPress = {() => {
                                    if (event.clientID) {
                                        this.props.navigation.navigate("Event", {
                                            event: event,
                                            database: this.props.database,
                                            defaultVenue: this.props.selectedVenue,
                                            defaultDate: this.props.selectedDate,
                                            onSave: event => {
                                                this.props.database.updateEvent(event);
                                                this.forceUpdate();
                                            },
                                            onDelete: event => {
                                                this.props.database.removeEvent(event);
                                                this.forceUpdate();
                                            }
                                        });
                                    }
                                    else {
                                        console.log(event);
                                    }
                                }}
                            />
                        );
                    }}
                    renderEmptyDate = {() => {
                        return (<View />);
                    }}
                />
                <View style={DayViewStyles.buttonContainer}>
                    <Button
                        title = "Add New Event"
                        color = "green"
                        onPress = {() => this.props.navigation.navigate("Event", {
                            database: this.props.database,
                            defaultVenue: this.state.selectedVenue,
                            defaultDate: this.state.selectedDate,
                            onSave: event => {
                                this.props.database.addEvent(event);
                                this.forceUpdate();
                                
                            }
                        })}
                    />
                </View>
            </AppContainer>
        );
    }
}

class EventBox extends React.Component {
    static propTypes = {
        event: PropTypes.instanceOf(Event),
        client: PropTypes.instanceOf(Client),
        onPress: PropTypes.func,
        first: PropTypes.bool
    };

    constructor(props) {
        super(props);
    }

    _getTimeString() {
        let start = toAMPM(toTimeString(this.props.event.start));
        let end = toAMPM(toTimeString(this.props.event.end));

        return [start, end].join(" - ");
    }

    _getInitials() {
        let splits = this.state.clientName.split(" ");
        if (splits.length < 2) {
            return splits[0][0];
        } else {
            return splits[0][0] + splits[splits.length - 1][0];
        }
    }

    render() {

        // Render a normal event
        if (this.props.event.clientID || this.props.event.clientName) {
            if (!this.props.client) {
                this.state = {
                    clientName: this.props.event.clientName,
                    clientColor: blackColor()
                };
            }
            else {
                this.state = {
                    clientName: this.props.client.stageName,
                    clientColor: randomColor(this.props.client.id)
                };
            }
    
            return (
                <TouchableOpacity
                    style={[DayViewStyles.eventContainer, this.props.first ? DayViewStyles.firstEventContainer : null]}
                    onPress = {this.props.onPress}
                >
                    <View style={DayViewStyles.eventInfo}>
                        {/* Time */}
                        <Text style={DayViewStyles.eventInfoText}>{this._getTimeString()}</Text>
    
                        {/* Performer */}
                        <Text style={DayViewStyles.eventInfoText}>{this.state.clientName}</Text>
                    </View>
                    <View style={DayViewStyles.eventIconContainer}>
    
                        {/* Circle with Initials */}
                        <View style={[DayViewStyles.eventIcon, {backgroundColor: this.state.clientColor.hex}]}>
                            <Text style={[DayViewStyles.eventIconText, {color: this.state.clientColor.isDark ? "#fff" : "#000"}]}>
                                {this._getInitials()}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        // Render a football game
        else if (this.props.event.opponent) {  
            return (
                <TouchableOpacity
                    style={[DayViewStyles.eventContainer, this.props.first ? DayViewStyles.firstEventContainer : null]}
                >
                    <View style={DayViewStyles.eventInfo}>
                        {/* Time */}
                        <Text style={DayViewStyles.eventInfoText}>{this.props.event.time}</Text>
    
                        {/* Performer */}
                        <Text style={DayViewStyles.eventInfoText}>{`${this.props.event.team[0].toUpperCase()+ this.props.event.team.slice(1)} ${this.props.event.location === 'home' || this.props.event.location === 'neutral' ? 'vs' : 'at'} ${this.props.event. opponent}`}</Text>
                    </View>
                    <View style={DayViewStyles.eventIconContainer}>
    
                        {/* Circle with Initials */}
                        <View style={[DayViewStyles.eventIcon, {backgroundColor: this.props.event.team === "auburn" ? "#000080" : "#990000"}]}>
                            <Text style={[DayViewStyles.eventIconText, {color: "#fff"}]}>
                                {this.props.event.team === "auburn" ? "AU" : "UA"}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        // Render holiday
        else {
            return (
                <TouchableOpacity
                    style={[DayViewStyles.eventContainer, this.props.first ? DayViewStyles.firstEventContainer : null]}
                >
                    <View style={DayViewStyles.eventInfo}>
    
                        {/* Name of holiday */}
                        <Text style={DayViewStyles.eventInfoText}>{this.props.event.name}</Text>
                    </View>
                    <View style={DayViewStyles.eventIconContainer}>
    
                        {/* Circle with Initials */}
                        <View style={[DayViewStyles.eventIcon, {backgroundColor: "#556B2F"}]}>
                            <Text style={[DayViewStyles.eventIconText, {color: "#fff"}]}>
                                {this.props.event.name.split(' ').map(word => word[0]).join('')}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }
    }
}

const DayViewStyles = StyleSheet.create({
    eventContainer: {
        backgroundColor: "#fff",
        padding: 10,
        display: "flex",
        flexDirection: "row",
        borderRadius: 5,
        marginRight: 7.5,
        marginBottom: 10
    },
    firstEventContainer: {
        marginTop: 10
    },
    eventInfo: {
        flexGrow: 4,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignContent: "space-between"
    },
    eventInfoText: {
        fontSize: 18
    },
    eventIconContainer: {
        flexShrink: 0
    },
    eventIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        fontSize: 25,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
    },
    eventIconText: {
        fontSize: 25
    },
    buttonContainer: {
        padding: 5
    }
});