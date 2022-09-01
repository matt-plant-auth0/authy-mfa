require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const axios = require("axios");
const authConfig = require("./src/auth_config.json");
const jwtGen = require("jsonwebtoken");
const https = require('https');
const fs = require('fs');

const app = express();

const port = process.env.API_PORT || 3001;
const appPort = process.env.SERVER_PORT || 3000;
const appOrigin = authConfig.appOrigin || `https://local.a0.gg:${appPort}`;

if (
  !authConfig.domain ||
  !authConfig.audience ||
  authConfig.audience === "YOUR_API_IDENTIFIER"
) {
  console.log(
    "Exiting: Please make sure that auth_config.json is in place and populated with valid domain and audience values"
  );

  process.exit();
}

app.use(morgan("dev"));
app.use(helmet());
app.use(cors({ origin: appOrigin }));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${authConfig.domain}/.well-known/jwks.json`,
  }),

  audience: authConfig.audience,
  issuer: `https://${authConfig.domain}/`,
  algorithms: ["RS256"],
});

app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!",
  });
});

app.get("/api/validate-mfa-jwt/:token", (req, res) => {
  try{
    var decoded = jwtGen.verify(req.params.token, 'S3cr3t!');
    console.log(decoded);
    res.send({decodedToken: decoded});
  } catch(err) {
    console.log(err);
    res.status(500).send(err);
  }
});

app.get("/api/poll-authy/:authyPushId", async (req, res) => {
  try{
    var authyResponse = await axios.get(`https://api.authy.com/onetouch/json/approval_requests/${req.params.authyPushId}`, { 'headers': { 'X-Authy-API-Key': process.env.AUTHY_API_KEY } });
    console.log(authyResponse);
    if(authyResponse.data.success){
      var response = { status: authyResponse.data.approval_request.status };
      if(authyResponse.data.approval_request.status !== 'pending'){
        var decoded = jwtGen.verify(req.query.token, 'S3cr3t!');
        var token = jwtGen.sign({ sub: decoded.sub, iss: 'local.a0.gg', state: req.query.state, status: authyResponse.data.approval_request.status, trnID: authyResponse.data.approval_request.hidden_details.trnID }, 'S3cr3t!', { expiresIn: 900 });
        response.token = token;
      }
      res.send(response);
    }else{
      res.status(500).send(authyResponse.data);
    }
  } catch(err) {
    console.log(err);
    res.status(500).send(err);
  }
});

https.createServer({
  key: fs.readFileSync('privkey1.pem'),
  cert: fs.readFileSync('cert1.pem')
}, app).listen(port, () => console.log(`API Server listening on port ${port}`));
