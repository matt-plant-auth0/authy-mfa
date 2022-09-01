const axios = require('axios');

/**
* Handler that will be called during the execution of a PostLogin flow.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onExecutePostLogin = async (event, api) => {
  if(event.transaction?.requested_scopes?.includes('create:transaction') && event.user.app_metadata._temp.authyPayload.details.Amount > 250){
    let authy_id = event.user.app_metadata.authyId;
    let authy_payload = event.user.app_metadata._temp.authyPayload;
    authy_payload.hidden_details.trnID = `${authy_payload.hidden_details.trnID}${Math.floor(new Date().getTime() / 1000)}`;
    console.log(`Triggering push notification for Authy user: ${authy_id} and transaction ${authy_payload.hidden_details.trnID}`);

    try {
      let approvalReqRes = await axios.post(`https://api.authy.com/onetouch/json/users/${authy_id}/approval_requests`, authy_payload, { 'headers': { 'X-Authy-API-Key': event.secrets.AUTHY_API_KEY }});
      console.log(approvalReqRes.data);
      if(approvalReqRes.data.success){
        let authyPushUUID = approvalReqRes.data.approval_request.uuid;
        let token = api.redirect.encodeToken({
          payload: {
            authyPushUUID: authyPushUUID
          },
          secret: event.secrets.JWT_SECRET
        });
        api.redirect.sendUserTo(`https://local.a0.gg:3000/authy-mfa`, {
          query: { token: token }
        });
      }else{

      }
    } catch(e) {
      console.log(e);
    }
  }
};


/**
* Handler that will be invoked when this action is resuming after an external redirect. If your
* onExecutePostLogin function does not perform a redirect, this function can be safely ignored.
*
* @param {Event} event - Details about the user and the context in which they are logging in.
* @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
*/
exports.onContinuePostLogin = async (event, api) => {
  let payload = api.redirect.validateToken({
    secret: event.secrets.JWT_SECRET,
    tokenParameterName: 'token'
  });

  console.log(`Continuing after Authy MFA for transaction: ${payload.trnID}`);

  switch(payload.status){
    case 'approved':
      api.authentication.recordMethod(`https://api.authy.com/${payload.trnID}`);
      api.accessToken.setCustomClaim('https://local.a0.gg/approved_transaction', payload.trnID);
      break;
    case 'expired':
      api.access.deny("Your approval notification has expired - please try again!");
      break;
    case 'denied':
      api.access.deny("You have denied this transaction!");
  }
};