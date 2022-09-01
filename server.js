const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const { join } = require("path");
const https = require('https');
const fs = require('fs');

const app = express();

const port = process.env.SERVER_PORT || 3000;

app.use(morgan("dev"));
app.use(helmet());
app.use(express.static(join(__dirname, "build")));

https.createServer({
    key: fs.readFileSync('privkey1.pem'),
    cert: fs.readFileSync('cert1.pem')
  }, app).listen(port, () => console.log(`Server listening on port ${port}`));
