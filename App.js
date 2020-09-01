import React from 'react';
import {ActivityIndicator, Button, View, YellowBox, Alert} from 'react-native';
import DayView from "./views/DayView";
import EventView from "./views/EventView";
import MonthView from "./views/MonthView";
import {ManageVenues, VenueView} from "./views/VenueViews";
import {ClientView, ManageClients} from "./views/ClientViews";
import Database from "./Database";
import Styles from "./styles";
import {createAppContainer, createStackNavigator, createSwitchNavigator} from "react-navigation";
import {CalendarList} from "react-native-calendars";
import {randomColor, toDateString, toDateTime, toMonthString} from "./util";
import _ from "lodash";
import LoginView from "./views/LoginView";
import {withMappedNavigationProps} from "react-navigation-props-mapper";
import Dropdown from "./components/Dropdown";
import AppContainer from "./components/AppContainer";
import MoreButton from "./components/MoreButton";
import { Client, Event, Venue } from "./objects";
import DocumentationView from './views/DocumentationView';

// Firebase's implementation utilizes long timers,
// which React Native doesn't like and throws a warning,
// so this is here to ignore that.
YellowBox.ignoreWarnings(['Setting a timer']);

//stores all clients/events/venues loaded from the database, to prevent unnecessary db calls
let loadedData = {
    clients: null,
    events: null,
    venues: null,
    viewedMonths: null
};

let db = null;

@withMappedNavigationProps()
class LoadingScreen extends React.Component {
    componentWillMount() {
        db = new Database();

        Promise.all([db.getClients(), db.getCurrentMonthAndUpcomingEvents(), db.getVenues()]).then(values => {
            this.props.navigation.navigate("VenueManage", {
                database: db
            });

        }).catch(err => console.log(err));
    }

    render() {
        return(
            <AppContainer>
                <ActivityIndicator size="large"/>
            </AppContainer>
        );
    }
}

const AppStack = createStackNavigator({
    Month: MonthView,
    Day: DayView,
    Event: EventView,
    Venue: VenueView,
    VenueManage: ManageVenues,
    Client: ClientView,
    ClientManage: ManageClients,
    Documentation: DocumentationView
}, {
    initialRouteName: "VenueManage",
    headerMode: "none",
    cardOverlayEnabled: true,
});

export default createAppContainer(createSwitchNavigator({
    Login: LoginView,
    Loading: LoadingScreen,
    App: AppStack
}, {
    initialRouteName: "Login",
    headerMode: "none"
}));