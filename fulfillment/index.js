"use strict";

const functions = require("firebase-functions");
const { WebhookClient } = require("dialogflow-fulfillment");
const { Payload } = require('dialogflow-fulfillment');
const { Card, Suggestion } = require("dialogflow-fulfillment");
const mysql = require("mysql");

// custom variables
let phone = "";
let isOverwriteDailyReports = true;

process.env.DEBUG = "dialogflow:debug"; // enables lib debugging statements

// Connect to a Database
function connectToDatabase() {
  console.log("method: connectToDatabase()");
  const connection = mysql.createConnection({
    // *** For Unix Socket Connection: ***
    socketPath: `/cloudsql/safedito-chatbot-nqfoxb:us-central1:dito`,
    // *** For TCP/IP Connection: ***
    // host: "HOST",
    // ip: "PORT",
    user: "chatbot",
    password: "P@ssw0rd!",
    database: "safedito_db",
  });
  return new Promise((resolve, reject) => {
    connection.connect();
    resolve(connection);
  });
}

function saveHealthAssessment(connection, data) {
  console.log("method: saveHealthAssessment()");
  let updateQuery = "update daily_health_logs set isValid = 0 where CAST(timestamp as DATE) = CURDATE() and emp_id = '" + data.emp_id + "'; ";
  connection.query(updateQuery);
  // console.log("1 = " + updateQuery);
  // console.log("2 = " + data.emp_id);
  // console.log("3 = '" + data.emp_id + "'");
  let query = "insert into daily_health_logs set ?";
  console.log(query, data);
  return new Promise((resolve, reject) => {
    connection.query(query, data,
      (error, results, fields) => {
        resolve(results);
      }
    );
  });
}

function addDummyPayload(agent) {
  agent.add(new Payload(agent.UNSPECIFIED, {}));
}

function saveHealthAssessmentHandler(agent) {
  console.log("method: saveHealthAssessmentHandler()");
  // Work Condition | Symptoms
  let info = agent.parameters.workcondition + "; " + agent.parameters.details.toString();
  const data = {
    emp_id: agent.parameters.phone,
    isValid: 1,
    status: agent.parameters.healthstatus,
    details: info,
  };
  console.log(data);
  return connectToDatabase().then((connection) => {
    try {
      return saveHealthAssessment(connection, data).then((result) => {
        console.log(result);
        connection.end();
        agent.add("Query Successful " + result);
      });
    } catch (error) {
      agent.add("Exception encountered " + error);
    }
  });
}

function setPhoneHandler(agent) {
  console.log("method: setPhoneHandler()");
  // get dingtalk phone here if possible, for checking
  console.log(phone);
  if (!phone) {
    phone = agent.parameters.phone;
    console.log("Setting phone from parameter: " + phone);
  } else {
    console.log("Getting phone from session: " + phone);
  }

  agent.setFollowupEvent("daily-health-checkin-handler");
  addDummyPayload(agent);
  return;
}

function getPhoneHandler(agent) {
  console.log("method: getPhoneHandler()");
  // insert logic here: get dingtalk phone here if possible, for checking

  if (!phone) {
    phone = agent.parameters.phone;
  }
}

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(
  (request, response) => {
    const agent = new WebhookClient({ request, response });
    console.log("DF Request Headers: " + JSON.stringify(request.headers));
    console.log("DF Request Body: " + JSON.stringify(request.body));

    function dingtalkLoginHandler(agent) {
      const dingtalk = new DingtalkSdk({
        agentId: "735679653",
        appKey: "dingr19jpkc4vqqvvirp",
        appSecret:
          "NlNS3IHQCMWFTFXIB-X5S1ASYr8tUfLFwQNS3QAQUWescegpvMRNNf4Qy8-Azor8",
      });

      dingtalk
        .execute("/sns/getuserinfo_bycode", {
          body: { code: "11021" },
        })
        .catch((err) => {
          console.log("Error: ", err);
        })
        .then((res) => {
          console.log("Success: ", res);
        });
    }

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map();
    intentMap.set("dingtalk.login", dingtalkLoginHandler);

    // save health assessment logs
    intentMap.set("daily-health.checkin.work-condition", saveHealthAssessmentHandler);

    // search for user by phone & search for daily checkin
    intentMap.set("daily-health.checkin", getPhoneHandler);


    // intentMap.set("intro", yourFunctionHandler);
    // intentMap.set('your intent name here', googleAssistantHandler);
    agent.handleRequest(intentMap);
  }
);
