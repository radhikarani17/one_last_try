import React from 'react'
import { Route, Switch, Redirect } from 'react-router-dom'
import { Provider } from 'react-redux'
import { ConnectedRouter } from 'react-router-redux'

import App from '../App/Layout'

import LoginPage from '../Pages/Login'
import RegisterPage from '../Pages/Account/Register'
import ProfilePage from '../Pages/Account/Profile'
import ChangePassword from '../Pages/Account/ChangePassword'

import Landing from '../Pages/Landing'
import LicensingRegister from '../Pages/Licensing/Register'
import LicensingLogin from '../Pages/Licensing/Login'
import LicensingKeys from '../Pages/Licensing/Keys'

import Auth from '../Auth'
import { logout as logoutLicensing } from '../Auth/licensing'
import PrivateRoute from './PrivateRoute'
import store, { history } from '../store'
import ServerSettings from '../Pages/ServerSettings'
import Workspace from '../Pages/Workspace'

export const makeMainRoutes = () => {
  const auth = new Auth()

  return (
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <Switch>
          <Route
            path="/landing"
            render={props => {
              return <Landing />
            }}
          />
          <Route path="/login" render={props => <LoginPage auth={auth} {...props} />} />
          <Route path="/register" render={props => <RegisterPage auth={auth} {...props} />} />

          <Route
            path="/changePassword"
            render={props => {
              return <ChangePassword auth={auth} {...props} />
            }}
          />
          <PrivateRoute path="/" auth={auth} component={App}>
            <Switch>
              <Route exact path="/profile" render={props => <ProfilePage {...props} />} />
              <Route
                exact
                from="/teams/:teamId"
                render={({ match }) => {
                  return <Redirect to={`/teams/${match.params.teamId}/bots`} />
                }}
              />
              <Route
                exact
                path="/licensing/logout"
                render={() => {
                  logoutLicensing()
                  return <Redirect to={{ pathname: '/licensing' }} />
                }}
              />
              <Route path="/workspace" component={Workspace} />
              <Route exact path="/settings" component={ServerSettings} />

              <Route exact path="/licensing" component={LicensingKeys} />
              <Route exact path="/licensing/register" render={props => <LicensingRegister {...props} />} />
              <Route exact path="/licensing/login" render={props => <LicensingLogin {...props} />} />
              <Redirect from="/" to="/workspace" />
            </Switch>
          </PrivateRoute>
        </Switch>
      </ConnectedRouter>
    </Provider>
  )
}