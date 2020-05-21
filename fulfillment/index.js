'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Payload} = require('dialogflow-fulfillment');
const mysql = require('mysql');
const nodemailer = require('nodemailer');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

// Custom Configurations and Variables
let emailQuery; let phone; let healthstatus; let workcond; let rawData = '';
let goodTotal = 0; let unwellTotal = 0; let anxiousTotal = 0;

// Configuration for nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'safedito.noreply@gmail.com',
    pass: '227E4B5C82249B624C40BA7E424432C4'
  }
});

// Configuration for MySQL Database (Google Cloud SQL)
function connectToDatabase() {
  console.log('method: connectToDatabase()');
  const connection = mysql.createConnection({
    // *** For Unix Socket Connection: ***
    socketPath: `/cloudsql/safedito-chatbot-nqfoxb:us-central1:dito`,
    // *** For TCP/IP Connection: ***
    // host: "HOST",
    // ip: "PORT",
    user: 'chatbot',
    password: 'P@ssw0rd!',
    database: 'safedito_db'
  });
  return new Promise((resolve, reject) => {
    connection.connect();
    resolve(connection);
  });
}

function saveHealthAssessment(connection, data) {
  console.log('method: saveHealthAssessment()');
  // TO DO: Make this transactional, rollback if a query is failed
  const updateQuery = 'update daily_health_logs set isValid = 0 where CAST(timestamp as DATE) = CURDATE() and emp_id = \'' + data.emp_id + '\'; ';
  console.log('Executing SQL query: ' + updateQuery);
  connection.query(updateQuery);
  const query = 'insert into daily_health_logs set ?';
  console.log('Executing SQL query: ' + query, data);
  return new Promise((resolve, reject) => {
    connection.query(query, data,
        (error, results, fields) => {
          resolve(results);
        }
    );
  });
}

function getDailyStatistics(connection) {
  console.log('method: getDailyStatistics()');

  // Get data from sql
  const query = `SELECT status, count(emp_id) as total FROM daily_health_logs WHERE isValid = 1 AND CAST(timestamp as DATE) = CURDATE() GROUP BY status;`;

  console.log('Executing SQL query: ' + query);
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results, fields) => {
      console.log(results);
      resolve(results);
    });
  });
}

function getWeeklyStatistics(connection) {
  console.log('method: getWeeklyStatistics()');

  // Get data from sql
  const query = `SELECT status, count(emp_id) as total FROM daily_health_logs WHERE isValid = 1 AND CAST(timestamp as DATE) = CURDATE() GROUP BY status;`;

  console.log('Executing SQL query: ' + query);
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results, fields) => {
      console.log(results);
      resolve(results);
    });
  });
}

function addDummyPayload(agent) {
  agent.add(new Payload(agent.UNSPECIFIED, {}));
}

function saveHealthAssessmentHandler(agent) {
  console.log('method: saveHealthAssessmentHandler()');
  console.log('saved data: ' + workcond + ' | ' + healthstatus + ' | ' + phone);
  workcond = (workcond) ? workcond : agent.parameters.workcondition;
  healthstatus = (healthstatus) ? healthstatus : agent.parameters.healthstatus;
  phone = (phone) ? phone : agent.parameters.phone;
  let info = '';

  console.log(agent.parameters);
  // Decide which followup event before database query
  if (healthstatus == 1) { // 1. Feeling Good
    info = workcond;
    if (workcond == 'SF') {
      agent.setFollowupEvent('response-good-sf');
    } else {
      agent.setFollowupEvent('response-good-wfh');
    }
  } else if (healthstatus == 2) { // 2. Feeling Unwell
    info = workcond + ' | ' + agent.parameters.details.toString();
    if (workcond == 'SF') {
      agent.setFollowupEvent('response-unwell-sf');
    } else {
      agent.setFollowupEvent('response-unwell-wfh');
    }
  } else if (healthstatus == 3) { // 3. Feeling Anxious
    info = workcond + ' | ' + emailQuery;
    agent.setFollowupEvent('send-email');
  }
  addDummyPayload(agent);

  // collect data
  const data = {
    emp_id: phone,
    isValid: 1,
    status: healthstatus,
    details: info
  };
  console.log('Data: ' + JSON.stringify(data));

  // finally, log transaction to database:
  return connectToDatabase().then((connection) => {
    try {
      return saveHealthAssessment(connection, data).then((result) => {
        connection.end();
      });
    } catch (error) {
      agent.add('Exception encountered ' + error);
    } finally {
      workcond = healthstatus = phone = '';
    }
  });
}

function setPhoneHandler(agent) {
  console.log('method: setPhoneHandler()');
  // get dingtalk phone here if possible, for checking
  console.log(phone);
  if (!phone) {
    phone = agent.parameters.phone;
    console.log('Setting phone from parameter: ' + phone);
  } else {
    console.log('Getting phone from session: ' + phone);
  }

  agent.setFollowupEvent('daily-health-checkin-handler');
  addDummyPayload(agent);
  return;
}

function getPhoneHandler(agent) {
  console.log('method: getPhoneHandler()');
  // insert logic here: get dingtalk phone here if possible, for checking

  if (!phone) {
    phone = agent.parameters.phone;
  }
}

function getQueryHandler(agent) {
  console.log('method: getQueryHandler()');
  healthstatus = agent.parameters.healthstatus;
  console.log('healthstatus: ' + healthstatus);
  phone = (phone) ? phone : agent.parameters.phone;
  console.log('phone: ' + phone);
  emailQuery = agent.query;
  console.log('emailQuery: ' + emailQuery);
  agent.setFollowupEvent('set-anxious-workcondition');
  addDummyPayload(agent);
}

function sendEmailHandler(agent) {
  console.log('method: sendEmailHandler()');

  const mailOptions = {
    from: 'SafeDITO Chatbot', // sender address
    to: 'johnpaulomataac@gmail.com', // list of receivers
    subject: 'SafeDITO: Feeling Anxious - ' + phone, // Subject line
    html: 'Query: ' + emailQuery
  };

  console.log(mailOptions);
  transporter.sendMail(mailOptions, function(err, info) {
    if (err) {
      agent.add('Unable to send email - ' + err);
      console.log(err);
      return;
    }
  });
  agent.setFollowupEvent('send-email-confirmation');
  addDummyPayload(agent);
}

function dailyChartHandler(agent) {
  console.log('method: dailyChartHandler()');

  console.log('Before Total(s): ', goodTotal, unwellTotal, anxiousTotal);

  // first, get table from database:
  connectToDatabase().then((connection) => {
    try {
      getDailyStatistics(connection).then((result) => {
        connection.end();
        rawData = JSON.stringify(result);
        result.forEach(function(row) {
          if (row.status == 1) goodTotal = (row.total) ? row.total : 0;
          else if (row.status == 2) unwellTotal = (row.total) ? row.total : 0;
          else if (row.status == 3) anxiousTotal = (row.total) ? row.total : 0;
        });
        console.log('Results: ' + rawData);
      });
    } catch (error) {
      agent.add('Exception encountered ' + error);
    }
  });

  console.log('Query completed: ' + rawData);
  console.log('After Total(s): ', goodTotal, unwellTotal, anxiousTotal);

  const dataChart = {
    type: 'pie', data: {
      datasets: [{data: [goodTotal, unwellTotal, anxiousTotal]}],
      labels: ['Good', 'Unwell', 'Anxious ']
    }
  };
  const quickChart = 'https://quickchart.io/chart?bkg=white&c=' +
    encodeURIComponent(JSON.stringify(dataChart));

  console.log('QuickChart.io: ' + quickChart);
  const ctx = {
    'name': 'generate-chart', 'lifespan': 1,
    'parameters': {'urlChart': quickChart, 'today': new Date().toLocaleString()}
  };

  agent.setContext(ctx);
  agent.setFollowupEvent('daily-stats-out');
}

function weeklyChartHandler(agent) {
  console.log('method: weeklyChartHandler()');

  console.log('Before Total(s): ', goodTotal, unwellTotal, anxiousTotal);

  const dataChart = {
    type: 'bar', data: {
      datasets: [{data: [18, 27, 30, 15, 12]}],
      labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    }
  };
  const quickChart = 'https://quickchart.io/chart?bkg=white&c=' +
    encodeURIComponent(JSON.stringify(dataChart));

  console.log('QuickChart.io: ' + quickChart);
  const ctx = {
    'name': 'generate-chart', 'lifespan': 1,
    'parameters': {'urlChart': quickChart, 'today': new Date().toLocaleString()}
  };

  agent.setContext(ctx);
  agent.setFollowupEvent('weekly-stats-out');
}

// Dialogflow intent mapping
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(
    (request, response) => {
      const agent = new WebhookClient({request, response});
      console.log('DF Request Headers: ' + JSON.stringify(request.headers));
      console.log('DF Request Body: ' + JSON.stringify(request.body));

      // Run the proper function handler based on the matched Dialogflow intent name
      const intentMap = new Map();
      intentMap.set('daily-health.check-in.work-condition', saveHealthAssessmentHandler);
      intentMap.set('send-email', sendEmailHandler);
      intentMap.set('daily-health.checkin', getPhoneHandler);
      intentMap.set('daily-health.check-in.anxious-query', getQueryHandler);
      intentMap.set('reports.daily-stats', dailyChartHandler);
      intentMap.set('reports.weekly-stats', weeklyChartHandler);
      agent.handleRequest(intentMap);
    }
);
