import React from 'react';
import PropTypes from 'prop-types';
import {Alert, AlertIOS, Button, FlatList, StyleSheet, Text, TextInput, View, TouchableOpacity} from 'react-native';
import {Venue, Client} from '../objects';
import Database from "../Database";
import {withMappedNavigationProps} from "react-navigation-props-mapper";
import AppContainer from "../components/AppContainer";
import Styles from "../styles";
import _ from "lodash";
import { ScrollView } from 'react-native-gesture-handler';
import {KeyboardAvoidingView, Picker} from 'react-native';
import styles from '../styles';
import { toAMPM, objectToArray, toMonthString } from '../util';
import TimeInput from "../components/TimeInput";
import { ClientStyles } from "./ClientViews";
import Firebase from 'firebase';
import { Dimensions, Platform, PixelRatio } from 'react-native';

@withMappedNavigationProps()
export class ManageVenues extends React.Component {
    static propTypes = {
        database: PropTypes.instanceOf(Database).isRequired
    };

    constructor(props) {
        super(props);
    }

    _renderVenue(venue) {
        return(
            <View style={VenueStyles.entryContainer}>
                <TouchableOpacity style={VenueStyles.entryName} onPress={() => {
                    this.props.navigation.navigate("Month", {
                        selectedVenue: venue,
                        database: this.props.database
                    });
                }}>
                        <Text>{venue.name}</Text>
                </TouchableOpacity>
                <View style={VenueStyles.entryButton}>
                    <Button
                        title = "⚙️🔧"
                        onPress = {() => this.props.navigation.navigate("Venue", {
                            venue: venue,
                            database: this.props.database,
                            onSave: venue => {
                                this.props.database.updateVenue(venue).catch(err => console.log(err));
                                this.forceUpdate();
                            },
                            onDelete: venue => {
                                this.props.database.removeVenue(venue).catch(err => console.log(err));
                                this.forceUpdate();
                            }
                        })}
                    />
                </View>
            </View>
        );
    }

    render() {
        return (
            <AppContainer style={Styles.infoView}>
                <View style={Styles.contentContainer}>
                    <FlatList style={Styles.listContainer}
                        data={this.props.database.venues.map(venue => { return {
                            key: venue.id,
                            data: venue
                        }})}
                        renderItem = {data => this._renderVenue(data.item.data)}
                    />
                </View>

                <View style={Styles.buttonContainer}>
                    <Button
                        title = "View Clients"
                        onPress = {() => {
                            this.props.navigation.navigate("ClientManage", {
                                database: this.props.database
                            });
                        }}
                    />
                    <Button
                        title = "Add New Venue"
                        onPress = {() => this.props.navigation.navigate("Venue", {
                            database: this.props.database,
                            onSave: venue => {
                                this.props.database.addVenue(venue).then(venue => {
                                    this.forceUpdate();
                                });
                            }
                        })}
                    />
                    <Button
                      title = "Add New Administrator"
                      style={styles.wrapper}
                      onPress={() => Alert.prompt(
                        'Enter New Admin Account Info',
                        null,
                        [
                          {
                            text: 'Cancel',
                            onPress: () => console.log('Cancel Pressed'),
                            style: 'cancel',
                          },
                          {
                            text: 'OK',
                            onPress: (email, password) => console.log('OK Pressed, password: ' + email + password),
                          },
                        ],
                        'login-password',
                      )}>

                      <View style={styles.button}>
                        <Text>
                        login-password
                        </Text>
                      </View>

        </Button>
                </View>
            </AppContainer>
        );
    }
}

@withMappedNavigationProps()
export class VenueView extends React.Component {
    static propTypes = {
        venue: PropTypes.instanceOf(Venue),
        onSave: PropTypes.func.isRequired,
        onDelete: PropTypes.func,
        database: PropTypes.instanceOf(Database).isRequired
    };

    constructor(props) {
        super(props);

        let venue = this.props.venue || new Venue();
        this.isNew = !venue.id;
        this.state = {
            id: venue.id || "",
            name: venue.name || "",
            email: venue.contactEmail || "",
            street1: venue.address.street1 || "",
            street2: venue.address.street2 || "",
            city: venue.address.city || "",
            state: venue.address.state || "",
            zip: venue.address.zip || "",
            presetTimeSlots: venue.presetTimeSlots || [],
            artistConfirmationSendOut: venue.artistConfirmationSendOut.toString() || "",
            artistInvoiceSendOut: venue.artistInvoiceSendOut.toString() || "",
            monthlyBookingListSendOut: venue.monthlyBookingListSendOut.toString() || "",
            monthlyCalendarSendOut: venue.monthlyCalendarSendOut.toString() || "",
            emaillist: venue.emaillist || []
        };
    }

    _renderEmailList(emaillistData) {
        let name = emaillistData.name;
        let index = parseInt(emaillistData.key) - 1;

        return (
            <EmailListEntry
                name = {name}
                onSave = {newName => {
                    let emaillist = this.state.emaillist;
                    emaillist[index] = newName;
                    this.setState({emaillist: emaillist});
                }}
                onDelete = {() => {
                    let emaillist = this.state.emaillist;
                    emaillist.splice(index, 1);
                    this.setState({emaillist: emaillist});
                }}
            />
        );
    }


    _validateData() {

        // Venue is invalid it has the same name as an existing venue
        let matchingVenue = this.props.database.venues.find(venue => {
            if (this.isNew) {
                return venue.name === this.state.name;
            }
            else {
                return venue.name === this.state.name && venue.id !== this.state.id;
            }
        })
        if (matchingVenue) {
            alert("There is already a venue with that name.");
            return false;
        }

        // Venue is invalid if its name is blank
        if (this.state.name === "") {
            alert("The venue must have a name.");
            return false;
        }

        // Venue is invalid if the contact email is blank
        if (this.state.email === "") {
            alert("The venue must have an email address.");
            return false;
        }

        // Venue is invalid if the contact email is improperly formatted
        let emailRegex = new RegExp(`^[\\w\.]+@(\\w{2,}\.)+\\w+$`);
        if (!emailRegex.test(this.state.email)) {
            alert("The given email address was not in the proper format.");
            return false;
        }

        // Venue is invalid if any of the monthly send out days are greater than 28 or less than 1
        if (this.state.artistConfirmationSendOut < 1 || this.state.artistConfirmationSendOut > 28) {
            alert("The artist booking confirmation send out day of the month must be from 1 to 28");
            return false;
        }
        if (this.state.artistInvoiceSendOut < 1 || this.state.artistInvoiceSendOut > 28) {
            alert("The artist invoice send out day of the month must be from 1 to 28");
            return false;
        }
        if (this.state.monthlyBookingListSendOut < 1 || this.state.monthlyBookingListSendOut > 28) {
            alert("The monthly booking list send out day of the month must be from 1 to 28");
            return false;
        }
        if (this.state.monthlyCalendarSendOut < 1 || this.state.monthlyCalendarSendOut > 28) {
            alert("The monthly calendar send out day of the month must be from 1 to 28");
            return false;
        }
        return true;
    }

    _renderTimeSlot(data) {
        let timeSlot = data.timeSlot;
        let index = parseInt(data.key);
        return (
            <TimeSlotEntry
                timeSlot = {timeSlot}
                onSave = {newTimeSlot => {
                    let presetTimeSlots = [...this.state.presetTimeSlots];
                    presetTimeSlots[index] = {start: newTimeSlot.start, end: newTimeSlot.end};
                    this.setState({presetTimeSlots: presetTimeSlots});
                }}
                onDelete = {() => {
                    let presetTimeSlots = [...this.state.presetTimeSlots];
                    presetTimeSlots.splice(index, 1);
                    this.setState({presetTimeSlots: presetTimeSlots});
                }}
            />
        );
    }

    render() {
        return (
            <AppContainer style={Styles.infoView}>
                <View style={Styles.contentContainer}>
                    {/* NEW CODE - Kaitlin - Added ScrollView to show all settings, and Keyboard to show all input boxes */}
                    <ScrollView style={VenueStyles.scrollView}>
                        <KeyboardAvoidingView style={styles.container} behavior="padding" enabled>
                            <Text style={Styles.infoTitle}>
                                {this.isNew ? "Create New Venue" : "Update Venue"}
                            </Text>

                            {/* Venue Name Input */}
                            <View style={Styles.inputRow}>
                                <Text style={Styles.inputTitle}>Name</Text>
                                <TextInput style={Styles.inputBox}
                                        value = {this.state.name}
                                        onChangeText = {value => this.setState({name: value})}
                                />
                            </View>

                            {/* Contact Email Input */}
                            <View style={Styles.inputRow}>
                                <Text style={Styles.inputTitle}>Email</Text>
                                <TextInput style={Styles.inputBox}
                                        value = {this.state.email}
                                        onChangeText = {value => this.setState({email: value})}
                                />
                            </View>

                            {/* Street Address 1 Input */}
                            <View style={Styles.inputRow}>
                                <Text style={Styles.inputTitle}>Street 1</Text>
                                <TextInput style={Styles.inputBox}
                                        value = {this.state.street1}
                                        onChangeText = {value => this.setState({street1: value})}
                                />
                            </View>

                            {/* Street Address 2 Input */}
                            <View style={Styles.inputRow}>
                                <Text style={Styles.inputTitle}>Street 2</Text>
                                <TextInput style={Styles.inputBox}
                                        value = {this.state.street2}
                                        onChangeText = {value => this.setState({street2: value})}
                                />
                            </View>

                            {/* City Input */}
                            <View style={Styles.inputRow}>
                                <Text style={Styles.inputTitle}>City</Text>
                                <TextInput style={Styles.inputBox}
                                        value = {this.state.city}
                                        onChangeText = {value => this.setState({city: value})}
                                />
                            </View>

                            {/* State Input */}
                            <View style={Styles.inputRow}>
                                <View style={[Styles.inputRow, VenueStyles.stateContainer]}>
                                    <Text style={[Styles.inputTitle, VenueStyles.stateTitle]}>State</Text>
                                    <TextInput style={[Styles.inputBox, VenueStyles.stateInput]}
                                            value = {this.state.state}
                                            onChangeText = {value => this.setState({state: value})}
                                    />
                                </View>

                                {/* ZIP Input */}
                                <View style={[Styles.inputRow, VenueStyles.zipContainer]}>
                                    <Text style={Styles.inputTitle}>ZIP</Text>
                                    <TextInput style={Styles.inputBox}
                                            value = {this.state.zip}
                                            onChangeText = {value => this.setState({zip: value})}
                                    />
                                </View>
                            </View>

                            {/*NEW CODE - Kaitlin - New UI for Venue Settings*/}
                            {/*Monthly Send Out Day Title*/}
                            <Text style={Styles.infoSubtitle}>Monthly Send Out Days</Text>

                            {/* Artist Confirmation */}
                            <View style={Styles.inputRow}>
                                <Text style={[Styles.inputTitle, VenueStyles.dayTitle]}>Artist Confirmation</Text>
                                <TextInput style={Styles.inputBox}
                                        keyboardType='numeric'
                                        returnKeyType='done'
                                        value = {this.state.artistConfirmationSendOut}
                                        onChangeText = {value => this.setState({artistConfirmationSendOut: value})}
                                />
                            </View>

                            {/* Artist Invoice */}
                            <View style={Styles.inputRow}>
                                <Text style={[Styles.inputTitle, VenueStyles.dayTitle]}>Artist Invoice</Text>
                                <TextInput style={Styles.inputBox}
                                        keyboardType='numeric'
                                        returnKeyType='done'
                                        value = {this.state.artistInvoiceSendOut}
                                        onChangeText = {value => this.setState({artistInvoiceSendOut: value})}
                                />
                            </View>

                            {/* Monthly Booking List */}
                            <View style={Styles.inputRow}>
                                <Text style={[Styles.inputTitle, VenueStyles.dayTitle]}>Monthly Booking List</Text>
                                <TextInput style={Styles.inputBox}
                                        keyboardType='numeric'
                                        returnKeyType='done'
                                        value = {this.state.monthlyBookingListSendOut}
                                        onChangeText = {value => this.setState({monthlyBookingListSendOut: value})}
                                />
                            </View>

                            {/* Monthly Calendar */}
                            <View style={Styles.inputRow}>
                                <Text style={[Styles.inputTitle, VenueStyles.dayTitle]}>Monthly Calendar</Text>
                                <TextInput style={Styles.inputBox}
                                        keyboardType='numeric'
                                        returnKeyType='done'
                                        value = {this.state.monthlyCalendarSendOut}
                                        onChangeText = {value => this.setState({monthlyCalendarSendOut: value})}
                                />
                            </View>

                            {/* Preset Time Slots Input */}
                            <Text style={Styles.infoSubtitle}>Preset Time Slots</Text>
                            <FlatList style={Styles.listContainer}
                                data = {this.state.presetTimeSlots.map((timeSlot, i) => {
                                    return {
                                        key: i.toString(),
                                        timeSlot: timeSlot
                                    };
                                })}
                                renderItem = {data => this._renderTimeSlot(data.item)}
                            />
                            <TimeSlotButton
                                onSave = {newTimeSlot => {
                                    let presetTimeSlots = this.state.presetTimeSlots;
                                    presetTimeSlots.push(newTimeSlot);
                                    this.setState({presetTimeSlots: presetTimeSlots});
                                }}
                                onDelete = {timeSlot => {
                                    // empty becauase if this isn't here the code breaks -- wish I knew why -- Hunter
                                }}
                            />


                            {/*NEW CODE - Sam - EMAIL LISTS*/}
                            {/*Email Lists Title*/}
                            <Text style={Styles.infoSubtitle}>Additional Venue Emails</Text>

                            <FlatList style={Styles.listContainer}
                                data = {this.state.emaillist.map((name, i) => {
                                    return {
                                        key: (i + 1).toString(),
                                        name: name
                                    };
                                })}
                                renderItem = {data => this._renderEmailList(data.item)}
                            />
                            <EmailListButton
                                onSave = {emailListName => {
                                    let emaillist = this.state.emaillist;
                                    emaillist.push(emailListName);
                                    this.setState({emaillist: emaillist});
                                }}
                            />


                        </KeyboardAvoidingView>
                    </ScrollView>
                </View>

                <View style={Styles.buttonContainer}>
                    {/* Save Button */}
                    <Button
                        title = {this.isNew ? "Create Venue" : "Save Venue"}
                        onPress = {() => {
                            if (this._validateData()) {
                                let venue;
                                if (this.isNew) {
                                    venue = new Venue(this.state);
                                }
                                else {
                                    venue = this.props.venue;
                                    venue.update(this.state);
                                }
                                this.props.navigation.goBack();
                                this.props.onSave(venue);
                            }
                        }}
                    />

                    {/* Delete Button */}
                    { this.isNew ? null :
                        <Button
                            title = "Delete Venue"
                            color = "red"
                            onPress = {() => {
                                Alert.alert("Confirmation",
                                    "Are you sure you want to delete this venue?",
                                    [
                                        {
                                            text: "Cancel"
                                        },
                                        {
                                            text: "OK",
                                            onPress: () => {
                                                this.props.navigation.goBack();
                                                this.props.onDelete(this.props.venue);
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

class TimeSlotEntry extends React.Component {
    static propTypes = {
        timeSlot: PropTypes.object,
        onSave: PropTypes.func.isRequired,
        onDelete: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);
        this.state = {
            timeSlot: this.props.timeSlot || {start: "15:00", end: "17:00"},
            isEditing: !this.props.timeSlot
        };
    }

    render() {
        if (this.state.isEditing) {
            return (
                <View>
                    <View style={Styles.inputRow}>
                        <View style={Styles.customStartTimeContainer}>
                            <View style={Styles.inputRow}>
                                <TimeInput
                                    value = {this.state.timeSlot.start}
                                    onValueChange = {startTime => {
                                        this.setState({timeSlot: {start: startTime, end: this.state.timeSlot.end}});
                                    }}
                                    />
                            </View>
                        </View>
                        <View style={Styles.customEndTimeContainer}>
                            <View style={Styles.inputRow}>
                                <Text style={Styles.customTimeTitle}> to </Text>
                                <TimeInput
                                    value = {this.state.timeSlot.end}
                                    onValueChange = {endTime => {
                                        this.setState({timeSlot: {start: this.state.timeSlot.start, end: endTime}});
                                    }}
                                />
                            </View>
                        </View>
                        <View style={ClientStyles.entryButton}>
                            <Button
                                title = "✔️"
                                color = "#fff"
                                onPress = {() => {
                                    this.setState({isEditing: false});

                                    if (this.state.timeSlot.start.trim() === "" || this.state.timeSlot.end.trim() === "") {
                                        this.props.onDelete(this.state.timeSlot);
                                    } else {
                                        this.props.onSave(this.state.timeSlot);
                                    }
                                }}
                            />
                        </View>
                        <View style={ClientStyles.entryButton}>
                            <Button
                                title = "❌"
                                color = "#fff"
                                onPress = {() => {
                                    this.props.onDelete(this.state.timeSlot);
                                    this.setState({isEditing: false})
                                }}
                            />
                        </View>
                    </View>
                </View>
            );
        } else {
            return (
                <View style={ClientStyles.entryContainer}>
                    <Text style={[ClientStyles.entryName, ClientStyles.performerName]}>{toAMPM(this.props.timeSlot.start) + " to " + toAMPM(this.props.timeSlot.end)}</Text>
                    <View style={ClientStyles.entryButton}>
                        <Button
                            title = "✏️"
                            color = "#fff"
                            onPress = {() => {
                                this.setState({isEditing: true});
                            }}
                        />
                    </View>
                    <View style={ClientStyles.entryButton}>
                        <Button
                            title = "❌"
                            color = "#fff"
                            onPress = {() => {
                                this.props.onDelete(this.state.timeSlot);
                            }}
                        />
                    </View>
                </View>
            );
        }
    }
}
class TimeSlotButton extends React.Component {
    static propTypes = {
        onSave: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);
        this.state = {
            isOpen: false
        };
    }

    render() {
        if (this.state.isOpen) {
            return (
                <TimeSlotEntry
                    onSave = {newTimeSlot => {
                        this.props.onSave(newTimeSlot);
                        this.setState({isOpen: false});
                    }}
                    onDelete = {timeSlot => {
                        this.props.onDelete(timeSlot);
                        this.setState({isOpen: false});
                    }}
                />
            );
        } else {
            return (
                <TouchableOpacity>
                    <Button
                        title="➕"
                        onPress = {() => this.setState({isOpen: true})}
                    />
                </TouchableOpacity>
            );
        }
    }
}

class EmailListEntry extends React.Component {
    static propTypes = {
        name: PropTypes.string,
        onSave: PropTypes.func.isRequired,
        onDelete: PropTypes.func.isRequired
    };

    static defaultProps = {
        name: ""
    };

    constructor(props) {
        super(props);
        this.state = {
            name: this.props.name,
            isEditing: !this.props.name
        };
    }

    render() {
        if (this.state.isEditing) {
            return (
                <View style={ClientStyles.entryContainer}>
                    <TextInput style={ClientStyles.performerInput}
                        value = {this.state.name}
                        onChangeText = {value => {
                            this.setState({name: value});
                        }}
                    />
                    <View style={ClientStyles.entryButton}>
                        <Button
                            title = "✔️"
                            color = "#fff"
                            onPress = {() => {
                                this.setState({isEditing: false});

                                let name = this.state.name;
                                if (name.trim() === "") {
                                    this.props.onDelete();
                                } else {
                                    this.props.onSave(this.state.name);
                                }
                            }}
                        />
                    </View>
                        <View style={ClientStyles.entryButton}>
                            <Button
                                title = "❌"
                                color = "#fff"
                                onPress = {() => {
                                    this.props.onDelete();
                                    this.setState({isEditing: false})
                                }}
                            />
                        </View>
                </View>
            );
        } else {
            return (
                <View style={ClientStyles.entryContainer}>
                    <Text style={[ClientStyles.entryName, ClientStyles.performerName]}>{this.props.name}</Text>
                    <View style={ClientStyles.entryButton}>
                        <Button
                            title = "✏️"
                            color = "#fff"
                            onPress = {() => {
                                this.setState({isEditing: true});
                            }}
                        />
                    </View>
                    <View style={ClientStyles.entryButton}>
                        <Button
                            title = "❌"
                            color = "#fff"
                            onPress = {this.props.onDelete}
                        />
                    </View>
                </View>
            );
        }
    }
}

export class EmailListButton extends React.Component {
    static propTypes = {
        onSave: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);
        this.state = {
            isOpen: false
        };
    }

    render() {
        if (this.state.isOpen) {
            return (
                <EmailListEntry
                    onSave = { name => {
                        this.props.onSave(name);
                        this.setState({isOpen: false});
                    }}
                    onDelete = {() => this.setState({isOpen: false})}
                />
            );
        } else {
            return (
                <TouchableOpacity>
                    <Button
                        title="➕"
                        onPress = {() => this.setState({isOpen: true})}
                    />
                </TouchableOpacity>
            );
        }
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


const VenueStyles = StyleSheet.create({
    entryContainer: {
        //width: "100%",
        //backgroundColor: "#eee",
        //display: "flex",
        //flexDirection: "row",
        //padding: 10,
        //borderBottomWidth: 1,
        //borderColor: "#ccc",
        //alignItems: "center",
        //justifyContent: "space-between"
        //fontSize: normalize(24),
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "row",
        padding: 7,
        margin: 3,
        borderWidth: 1,
        borderRadius: 10,
        borderColor: "#ccc",
        alignItems: "center"


    },
    entryName: {
        flexGrow: 3,
        flexBasis: 60,
        fontSize: 25
    },
    entryButton: {
        flexGrow: 1,
        flexBasis: 40
    },
    stateContainer: {
        flexGrow: 1,
        flexBasis: 0,
        marginRight: 10
    },
    stateTitle: {
        flexGrow: 2
    },
    stateInput: {
        flexGrow: 1
    },
    zipContainer: {
        flexGrow: 2,
        flexBasis: 0
    },
    /* NEW CODE - Kaitlin - Monthly Send Out/Preset Time Slots/ScrollView Styles*/
    dayContainer: {
        flexGrow: 2,
        flexBasis: 0,
        marginRight: 8
    },
    dayTitle: {
        flexGrow: 6,
        fontSize: 18
    },
    timeContainer: {
        flexGrow: 1,
        flexBasis: 0
    },
    timeTitle: {
        fontSize: 18,
        flexGrow: 1,
        marginRight: 3
    },
    timeInput: {
        flexGrow: 4
    },
    scrollView: {
        flexGrow: 1,
        width: "100%"
    },
    timeSlotTitle: {
        flexGrow: 1,
        fontSize: 18
    }
});
