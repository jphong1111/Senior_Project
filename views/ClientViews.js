import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Button,
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native';
import { Client } from '../objects';
import Database from '../Database';
import { withMappedNavigationProps } from 'react-navigation-props-mapper';
import AppContainer from '../components/AppContainer';
import Styles from '../styles';
import styles from '../styles';
import _ from 'lodash';
import { SafeAreaView, ScrollView } from 'react-native';
import Constants from 'expo-constants';

@withMappedNavigationProps()
export class ManageClients extends React.Component {
  static propTypes = {
    onReturn: PropTypes.func,
    database: PropTypes.instanceOf(Database).isRequired,
  };

  constructor(props) {
    super(props);
  }

  _renderClient(client) {
    return (
      <View style={ClientStyles.entryContainer}>
        <Text style={ClientStyles.entryName}>{client.stageName}</Text>
        <View style={ClientStyles.entryButton}>
          <Button
            title='⚙️🔧'
            onPress={() =>
              this.props.navigation.navigate('Client', {
                client: client,
                onSave: (client) => {
                  this.props.database
                    .updateClient(client)
                    .catch((err) => console.log(err));
                  this.forceUpdate();
                },
                onDelete: (client) => {
                  this.props.database
                    .removeClient(client)
                    .catch((err) => console.log(err));
                  this.forceUpdate();
                },
              })
            }
          />
        </View>
      </View>
    );
  }

  render() {
    return (
      <AppContainer style={Styles.infoView}>
        <View style={Styles.contentContainer}>
          <FlatList
            style={Styles.listContainer}
            data={this.props.database.clients.map((client) => {
              return {
                key: client.id,
                data: client,
              };
            })}
            renderItem={(data) => this._renderClient(data.item.data)}
          />
        </View>

        <View style={Styles.buttonContainer}>
          <Button
            title='Add New Client'
            onPress={() =>
              this.props.navigation.navigate('Client', {
                onSave: (client) => {
                  this.props.database.addClient(client);
                  this.forceUpdate();
                },
              })
            }
          />
        </View>
      </AppContainer>
    );
  }
}

@withMappedNavigationProps()
export class ClientView extends React.Component {
  static propTypes = {
    client: PropTypes.instanceOf(Client),
    onSave: PropTypes.func.isRequired,
    onDelete: PropTypes.func,
  };

  constructor(props) {
    super(props);

    let client = this.props.client || new Client();
    this.isNew = !client.id;

    this.state = {
      stageName: client.stageName || '',
      email: client.email || '',
      performers: client.performers || [],
      splitCheck: client.splitCheck || false,
      bio: client.bio || '',
    };
  }

  _renderPerformer(performerData) {
    let name = performerData.name;
    let index = parseInt(performerData.key) - 1;

    return (
      <PerformerEntry
        name={name}
        onSave={(newName) => {
          let performers = this.state.performers;
          performers[index] = newName;
          this.setState({ performers: performers });
        }}
        onDelete={() => {
          let performers = this.state.performers;
          performers.splice(index, 1);
          this.setState({ performers: performers });
        }}
      />
    );
  }

  _validateData() {
    let emailRegex = new RegExp(`^[\\w\.]+@(\\w{2,}\.)+\\w+$`);

    if (this.state.stageName === '') {
      alert('The client must have a stage name.');
    } else if (this.state.performers.length === 0) {
      alert('There must be at least one performer.');
    } else if (this.state.email === '') {
      alert('The client must have an email address.');
    } else if (!emailRegex.test(this.state.email)) {
      alert('The given email address was not in the proper format.');
    } else {
      return true;
    }
    return false;
  }

  render() {
    return (
      <AppContainer style={Styles.infoView}>
        <View style={Styles.contentContainer}>
          <ScrollView style={ClientStyles.scrollView}>
            <KeyboardAvoidingView
              style={styles.container}
              behavior='padding'
              enabled
            >
              <Text style={Styles.infoTitle}>
                {this.isNew ? 'Create New Client' : 'Update Client'}
              </Text>

              {/* Client Name Input */}
              <View style={Styles.inputRow}>
                <Text style={Styles.inputTitle}>Name</Text>
                <TextInput
                  style={Styles.inputBox}
                  value={this.state.stageName}
                  onChangeText={(value) => this.setState({ stageName: value })}
                />
              </View>

              {/* Contact Email Input */}
              <View style={Styles.inputRow}>
                <Text style={Styles.inputTitle}>Email</Text>
                <TextInput
                  style={Styles.inputBox}
                  value={this.state.email}
                  onChangeText={(value) => this.setState({ email: value })}
                />
              </View>

              {/* Performer Names Input */}
              <Text style={ClientStyles.performerTitle}>Performers</Text>
              <FlatList
                style={Styles.listContainer}
                data={this.state.performers.map((name, i) => {
                  return {
                    key: (i + 1).toString(),
                    name: name,
                  };
                })}
                renderItem={(data) => this._renderPerformer(data.item)}
              />
              <PerformerButton
                onSave={(performerName) => {
                  let performers = this.state.performers;
                  performers.push(performerName);
                  this.setState({ performers: performers });
                }}
              />

              {/* Option for splitting checks among performers
                    <Text style={ClientStyles.promptText}>Separate Checks For Each Performer?</Text>
                    <Switch
                        value = {this.state.splitCheck}
                        onValueChange = {(value) => {
                            this.setState({splitCheck: value});
                        }}
                    /> */}

              {/* Bio Input */}
              <Text style={Styles.inputTitle}>Bio</Text>
              <View style={Styles.inputRow}>
                <TextInput
                  style={Styles.bioBox}
                  multiline={true}
                  value={this.state.bio}
                  onChangeText={(value) => this.setState({ bio: value })}
                />
              </View>
            </KeyboardAvoidingView>
          </ScrollView>
        </View>

        <View style={Styles.buttonContainer}>
          {/* Save Button */}
          <Button
            title={this.isNew ? 'Create Client' : 'Save Client'}
            onPress={() => {
              if (this._validateData()) {
                let client = this.props.client || new Client();
                client.update(this.state);

                this.props.navigation.goBack();
                this.props.onSave(client);
              }
            }}
          />

          {/* Delete Button */}
          {this.isNew ? null : (
            <Button
              title='Delete Client'
              color='red'
              onPress={() => {
                Alert.alert(
                  'Confirmation',
                  'Are you sure you want to delete this client?',
                  [
                    {
                      text: 'Cancel',
                    },
                    {
                      text: 'OK',
                      onPress: () => {
                        this.props.navigation.goBack();
                        this.props.onDelete(this.props.client);
                      },
                    },
                  ],
                  { cancelable: true }
                );
              }}
            />
          )}
        </View>
      </AppContainer>
    );
  }
}

class PerformerEntry extends React.Component {
  static propTypes = {
    name: PropTypes.string,
    onSave: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
  };

  static defaultProps = {
    name: '',
  };

  constructor(props) {
    super(props);
    this.state = {
      name: this.props.name,
      isEditing: !this.props.name,
    };
  }

  render() {
    if (this.state.isEditing) {
      return (
        <View style={ClientStyles.entryContainer}>
          <TextInput
            style={ClientStyles.performerInput}
            value={this.state.name}
            onChangeText={(value) => {
              this.setState({ name: value });
            }}
          />
          <View style={ClientStyles.entryButton}>
            <Button
              title='✔️'
              color='#fff'
              onPress={() => {
                this.setState({ isEditing: false });

                let name = this.state.name;
                if (name.trim() === '') {
                  this.props.onDelete();
                } else {
                  this.props.onSave(this.state.name);
                }
              }}
            />
          </View>
          <View style={ClientStyles.entryButton}>
            <Button
              title='❌'
              color='#fff'
              onPress={() => {
                this.props.onDelete();
                this.setState({ isEditing: false });
              }}
            />
          </View>
        </View>
      );
    } else {
      return (
        <View style={ClientStyles.entryContainer}>
          <Text style={[ClientStyles.entryName, ClientStyles.performerName]}>
            {this.props.name}
          </Text>
          <View style={ClientStyles.entryButton}>
            <Button
              title='✏️'
              color='#fff'
              onPress={() => {
                this.setState({ isEditing: true });
              }}
            />
          </View>
          <View style={ClientStyles.entryButton}>
            <Button title='❌' color='#fff' onPress={this.props.onDelete} />
          </View>
        </View>
      );
    }
  }
}

export class PerformerButton extends React.Component {
  static propTypes = {
    onSave: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
    };
  }

  render() {
    if (this.state.isOpen) {
      return (
        <PerformerEntry
          onSave={(name) => {
            this.props.onSave(name);
            this.setState({ isOpen: false });
          }}
          onDelete={() => this.setState({ isOpen: false })}
        />
      );
    } else {
      return (
        <TouchableOpacity>
          <Button title='➕' onPress={() => this.setState({ isOpen: true })} />
        </TouchableOpacity>
      );
    }
  }
}

export const ClientStyles = StyleSheet.create({
  entryContainer: {
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'row',
    padding: 7,
    margin: 3,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  entryName: {
    flexGrow: 3,
    flexBasis: 0,
    fontSize: 15,
  },
  performerName: {
    flexGrow: 5,
  },
  performerInput: {
    flexGrow: 6,
    flexBasis: 0,
    backgroundColor: '#fff',
    marginRight: 10,
    paddingLeft: 5,
  },
  entryButton: {
    flexGrow: 1,
    flexBasis: 0,
    flexShrink: 0,
    marginRight: 5,
  },
  performerTitle: {
    fontSize: 20,
    marginBottom: 5,
  },
  promptText: {
    fontSize: 15,
    marginTop: 10,
    marginBottom: 10,
  },
  scrollView: {
    flexGrow: 1,
    width: '100%',
  },
});
