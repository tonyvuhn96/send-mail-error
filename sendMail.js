const express = require("express");
let app = express();
const fs = require('fs');
const moment = require('moment');
const admZip = require('adm-zip');
require('dotenv').config();
const schedule = require("node-schedule");

let AWS = require("aws-sdk");
const ID = process.env.AWS_S3_ID;
const SECRET = process.env.AWS_S3_SECRET;
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
const FILE_PERMISSION = "public-read";

const s3 = new AWS.S3({
  accessKeyId: ID,
  secretAccessKey: SECRET,
});

const ses_config = {
  accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  region: process.env.AWS_SES_REGION,
  apiVersion: process.env.AWS_SES_API_VERSION,
};
AWS.config.update(ses_config);
const base64ToName = Buffer.from("Exam24h").toString("base64");
const finalToName = `=?UTF-8?B?${base64ToName}?= <no-reply@exam24h.com>`;


const cron = schedule.scheduleJob("00 20 * * *", async () => {
  try {
    handleFile()
  } catch (err) {
    console.log(err);
  }
});

cron;

const handleFile = () => {
  let currentDate = moment().format("YYYY_MM_DD");
  let currentDateFile = "error_" + currentDate;
  fs.copyFile('./error.log', "./" + currentDateFile, (err) => {
    if (err) throw err;
    fs.writeFile('./error.log', '', function(){
    });
    const file = new admZip("", undefined);
    file.addLocalFile(`./${currentDateFile}`, `./${currentDateFile}.zip`);
    fs.writeFileSync(`./${currentDateFile}.zip`, file.toBuffer());
    file.writeZip(`./${currentDateFile}.zip`, (error) => {
      uploadFile(`./${currentDateFile}.zip`, `${currentDateFile}.zip`)
    });
  });
}

const uploadFile = (filePath, fileName) => {
  // Read content from the file
  const fileContent = fs.readFileSync(filePath);

  // Setting up S3 upload parameters
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ACL: FILE_PERMISSION,
    CORSConfiguration: {
      CORSRules: {
        AllowedHeader: "*",
        AllowedMethod: "GET",
        AllowedOrigin: "*",
        MaxAgeSeconds: 3000,
      },
    },
  };
  // Uploading files to the bucket
  s3.upload(params, function(err, data) {
    let currentNewDate = moment().format("DD/MM/YYYY");
    if (err) {
      throw err;
    }
    if (data && data.Location) {
      let urlFile = data.Location;
      let contentMail = `Gửi báo cáo URL lỗi ngày ${currentNewDate}. Xem file tại: <a href="${urlFile}">${urlFile}</a>`;
      let titleMail = `Gửi báo cáo URL lỗi ngày ${currentNewDate}`;
      let mailObject = process.env.MAIL_LIST.split(",");

      if (mailObject && mailObject.length) {
        for (let mail of mailObject) {
          sendMail(mail, contentMail, titleMail);
        }
      }
    }
  });
};

const getParam = (email, content, title) => {
  let params = {
    Destination: {
      ToAddresses: [email],
    },
    Source: finalToName,
    Message: {
      Subject: {
        Charset: "UTF-8",
        Data: title,
      },
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: content
        },
      },
    },
  };
  return params;
}

const sendMail = (email, content, title) => {
  const sendPromise = new AWS.SES(ses_config).sendEmail(getParam(email, content, title)).promise();
  sendPromise.then((data) => {
  }).catch((err) => {
  });
};

let port = 3700;
app.listen(port, function () {
  console.log("Sitemap listen port: " + port);
});
