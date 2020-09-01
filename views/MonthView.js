import React from 'react';
import {randomColor, toDateString, toDateTime, toMonthString, blackColor} from "../util";
import Styles from "../styles";
import {CalendarList} from "react-native-calendars";
import _ from "lodash";
import Dropdown from "../components/Dropdown";
import AppContainer from "../components/AppContainer";
import MoreButton from "../components/MoreButton";
import {Venue} from "../objects";
import Database from "../Database";
import PropTypes from 'prop-types';
import {Button, View, Alert} from 'react-native';
import {withMappedNavigationProps} from "react-navigation-props-mapper";

@withMappedNavigationProps()
class MonthView extends React.Component {
    static propTypes = {
        selectedVenue: PropTypes.instanceOf(Venue).isRequired,
        database: PropTypes.instanceOf(Database).isRequired
    };

    constructor(props) {
        super(props);

        let currentDate = new Date();
        this.state = {
            selectedMonth: currentDate.getMonth(),
            selectedYear: currentDate.getFullYear(),
            disableSendingEmails: false,
            markedDates: this._generateMarkedDates(),
            activeMonth: {}
        };

        // Refreshes the monthly view whenever the user goes "back" to it from the day view
        this.props.navigation.addListener('didFocus', () => {
            this.setState({
                markedDates: this._generateMarkedDates()
            });
            this.forceUpdate();
        });
    }

    _generateMarkedDates() {

        // Generate marked dates for events
        let colors = {};
        this.props.database.clients.forEach(client => {
            colors[client.id] = {
                key: client.id,
                color: randomColor(client.id).hex
            };
        });

        let thisVenuesEvents = this.props.database.events.filter(event => event.venueID === this.props.selectedVenue.id);
        let markedDates = {};
        thisVenuesEvents.forEach(event => {
            let eventDate = toDateString(event.start);

            if (!markedDates[eventDate]) {
                markedDates[eventDate] = {dots: []};
            }

            if (this.props.database.clients.find(client => client.id === event.clientID)) {
                markedDates[eventDate].dots.push(colors[event.clientID]);
            }
            else {
                markedDates[eventDate].dots.push({key: -1, color: "#000000"});
            }
        });

        // Generate marked dates for football games
        this.props.database.footballGames.auburn.forEach(game => {
            if (!markedDates[game.date]) {
                markedDates[game.date] = {dots: []};
            }
            markedDates[game.date].dots.push({
                key: `${game.date}-auburn`,
                color: "#8B4513"
            });
        });
        this.props.database.footballGames.alabama.forEach(game => {
            if (!markedDates[game.date]) {
                markedDates[game.date] = {dots: []};
            }
            markedDates[game.date].dots.push({
                key: `${game.date}-alabama`,
                color: "#8B4513"
            });
        });

        // Generate marked dates for holidays
        this.props.database.holidays.forEach(holiday => {
            const dateString = holiday.date.split(' ')[0];
            if (!markedDates[dateString]) {
                markedDates[dateString] = {dots: []};
            }
            markedDates[dateString].dots.push({
                color: "#556B2F"
            });
        });

        return markedDates;
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
                        selectedValue = {this.props.selectedVenue.id}
                        onValueChange = {venueID => {
                            if (venueID !== null) {
                                this.setState({selectedValue: this.props.database.venues.find(venue => venue.id === venueID)});
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
                <CalendarList style={Styles.monthView}
                    horizontal = {true}
                    pagingEnabled = {true}
                    hideArrows = {true}
                    markingType = "multi-dot"
                    markedDates = {this.state.markedDates}
                    onDayPress = {day => {
                        this.props.navigation.navigate("Day", {
                            onGoBack: () => this.forceUpdate(),
                            selectedDate: toDateTime({date: day.dateString}),
                            selectedVenue: this.props.selectedVenue,
                            database: this.props.database
                        });
                    }}
                    onVisibleMonthsChange = {months => {
                        this.state.activeMonth = new Date(months[0].year, months[0].month - 1, 1);
                    }}
                />
                <View style={Styles.buttonContainer}>
                    <Button
                        title = "Generate Forms"
                        disabled = {this.state.disableSendingEmails}
                        onPress = {() => {
                            this.props.navigation.navigate("Documentation", {
                                database: this.props.database,
                                venue: this.props.selectedVenue,
                                date: this.state.activeMonth
                            });
                        }}
                    />
                </View>
            </AppContainer>
        );
    }
}

export default MonthView;