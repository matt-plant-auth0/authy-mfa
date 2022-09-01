import React, { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardBody, CardTitle, CardText, Alert, Button, Container, Spinner } from "reactstrap";
import * as Cookies from 'es-cookie';
import { getConfig } from "../config";
import { useHistory } from 'react-router-dom';

import Loading from "../components/Loading";

export const AuthyMFAComponent = (props) => {
  const params = new URLSearchParams(window.location.search);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('pending');
  const [newToken, setNewToken] = useState(null);
  const [isRunning, setIsRunning] = useState(true);
  const config = getConfig();

  useEffect(() => {
    async function decodeToken() {
      try {
        if(params.has('token')){
          let tokenRes = await fetch(`https://local.a0.gg:3001/api/validate-mfa-jwt/${params.get('token')}`);
          let tokenResJson = await tokenRes.json();
          console.log(tokenResJson);
          setToken(tokenResJson.decodedToken);
        }else{
          setError({ message: 'Missing or invalid token!' });
        }
      } catch (err) {
        console.log(err);
        setError(err);
        setIsRunning(false);
      }
    }
    decodeToken();
  }, []);

  function useInterval(callback, delay) {
    const savedCallback = useRef();
  
    // Remember the latest callback.
    useEffect(() => {
      savedCallback.current = callback;
    }, [callback]);
  
    // Set up the interval.
    useEffect(() => {
      function tick() {
        savedCallback.current();
      }
      if (delay !== null) {
        let id = setInterval(tick, delay);
        return () => clearInterval(id);
      }
    }, [delay]);
  }

  useInterval(async () => {
    // Your custom logic here
    try {
      if(token){
        let authyPushId = token.authyPushUUID;
        let authyRes = await fetch(`https://local.a0.gg:3001/api/poll-authy/${authyPushId}?token=${params.get('token')}&state=${params.get('state')}`);
        let authyResJson = await authyRes.json();
        console.log(`Authy Push notification status: ${authyResJson.status}`);
        setStatus(authyResJson.status);
        if(authyResJson.status !== 'pending'){
          setNewToken(authyResJson.token);
          setIsRunning(false);
        }
      }
    } catch (err) {
      console.log(err);
      setError(err);
      setIsRunning(false);
    }
  }, isRunning ? 1000 : null);

  const continueAuth = (e) => {
    e.preventDefault();
    
    window.location.href(`https://${config.domain}/continue?state=${params.get('state')}&token=${token}`);
  }

  return (
    <Container className="mb-5">
      <Card>
        <CardHeader>
          Transaction Approval Required
        </CardHeader>
        <CardBody>
          <CardTitle tag="h5">
            Please check your phone
          </CardTitle>
          <CardText>
            You need to approve this transaction due to the amount, so please check the Authy app on your phone to continue<br></br>
          </CardText>
          <Button
            color="primary"
          >
            No notifiction? Click here!
          </Button>
        </CardBody>
      </Card>
      {status === 'approved' && (
        <Alert>
          You have approved this transaction - {' '}
          <a
            className="alert-link"
            href={`https://${config.domain}/continue?state=${params.get('state')}&token=${newToken}`}
          >
            click here to continue!
          </a>
        </Alert>
      )}
      {status === 'denied' && (
        <Alert color="danger">
          You have denied this transaction - {' '}
          <a
            className="alert-link"
            href={`https://${config.domain}/continue?state=${params.get('state')}&token=${newToken}`}
          >
            click here to continue!
          </a>
        </Alert>
      )}
      {status === 'expired' && (
        <Alert color="danger">
          Your notification has expired - {' '}
          <a
            className="alert-link"
            href={`https://${config.domain}/continue?state=${params.get('state')}&token=${newToken}`}
          >
            click here to continue!
          </a>
        </Alert>
      )}
      {error && (
        <Alert color="danger">
          Oops! An error occured: {' '}
          <pre>{error.message}</pre>
        </Alert>
      )}
    </Container>
  );
};

export default AuthyMFAComponent;
