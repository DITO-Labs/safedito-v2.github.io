'use strict';

const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Payload} = require('dialogflow-fulfillment');
const mysql = require('mysql');
const nodemailer = require('nodemailer');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

// Custom Configurations and Variables
let emailQuery;

// Cached Global Variables
let query;
let phone;
let healthstatus;
let workcond;
let details;

// Lazy load
let rawDailyChart; const isRawDailyUpdated = false;

// Configuration for nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD
  }
});

// Configuration for MySQL Database (Google Cloud SQL)
const pool = mysql.createPool({
  connectionLimit: 100,
  // *** For Unix Socket Connection: ***
  socketPath: process.env.SQL_SOCKETPATH,
  // *** For TCP/IP Connection: ***
  // host: "HOST",
  // ip: "PORT",
  user: 'chatbot',
  password: process.env.SQL_PASSWORD,
  database: 'testdito_db'
});

function addDummyPayload(agent) {
  agent.add(new Payload(agent.UNSPECIFIED, {}));
}

function getAgentParameters(agent) {
  console.log('method: getAgentParameters()');

  // store temp values for null checking
  const tempQuery = agent.query;
  const tempPhone = agent.parameters.phone;
  const tempWorkCond = agent.parameters.workcondition;
  const tempHealthStatus = agent.parameters.healthstatus;
  const tempDetails = agent.parameters.details;
  console.log('Temporary Data: ', [tempQuery, tempPhone,
    tempWorkCond, tempHealthStatus, tempDetails]);

  // if passed correctly, assign to global; else, use cache
  query = (tempQuery) ? tempQuery : 'N/A';
  phone = (tempPhone) ? tempPhone : phone;
  healthstatus = (tempHealthStatus) ? tempHealthStatus : healthstatus;
  details = (tempDetails) ? JSON.stringify(tempDetails) : details;
  if (tempWorkCond == 'WFH') workcond = 1;
  else if (tempWorkCond == 'SF') workcond = 2;

  console.log('Cached Data: ', [phone, workcond, healthstatus, details]);

  return {
    emp_id: phone,
    isValid: 1,
    status: healthstatus,
    work_cond: workcond,
    details: details
  };
}

function insertDailyCheckHandler(agent) {
  console.log('method: insertDailyCheckHandler()');
  const sqlUpdateStr = 'UPDATE daily_health_logs SET isValid = 0 ' +
    'WHERE CAST(dlog_dt as DATE) = CURDATE() AND emp_id = ?';
  const sqlInsertStr = 'INSERT INTO daily_health_logs SET ? ';

  const data = getAgentParameters(agent);
  console.log(data);
  console.log(JSON.stringify(data));

  try {
    pool.getConnection((error, connection) => {
      if (error) {
        console.log('Error in connection - ' + error);
        throw error;
      }
      console.log('Executing Queries: ? | ?', [sqlUpdateStr, sqlInsertStr]);
      connection.beginTransaction((err) => {
        connection.query(sqlUpdateStr, data.emp_id, (err) => {
          if (err) {
            console.log('Error in connection - ' + err);
            throw err; // Query uncommitted, no rollback needed
          }
          connection.query(sqlInsertStr, data, (err) => {
            if (err) {
              console.log('SQL Exception - Rolling back SQL transaction');
              connection.rollback();
              throw err;
            }
            connection.commit();
            console.log('SQL Transaction committed');
          });
        });
      });
      connection.release();
    });
  } catch (error) {
    console.log('Handled error!' + error);
    agent.add('SQL Error' + error);
    return;
  }

  // decide next intent
  if (data.status == 1) agent.setFollowupEvent('response-good-wfh');
  else if (data.status == 2) agent.setFollowupEvent('response-unwell-wfh');
  else if (data.status == 3) agent.setFollowupEvent('send-email');
  console.log(data);
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
    html: 'Query: ' + query
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

function chartifyDataSql(chartQuery, chartKeys) {
  console.log('method: chartifyDataSql()');
  const chartValues = [];
  return new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) {
        console.log('Error in connection - ' + error);
        reject(error);
      }

      console.log('Executing Queries: ? | ?', chartQuery);
      connection.query(chartQuery, (error, result) => {
        if (error) {
          console.log('Error in executing query - ' + error);
          reject(error);
        }
        console.log('Resultset: ' + JSON.stringify(result));
        result.forEach((row) => {
          for (let i = 0; i < chartKeys.length; i++) {
            if (row.status == chartKeys[i]) {
              chartValues.push(row.total);
            }
          }
        });
      });
      connection.release();
      console.log('Query Successful: ' + chartValues);
      resolve(chartValues);
    });
  });
}

/**
 * For generating charts, output is displayed on Image rich content
 *
 * @param {String} chartType Chart Type: pie, bar, etc.
 * @param {JSON} chartData Chart Label {'label1': pk1, 'label2': pk2, ...}
 * @param {String} chartQuery SQL Query
 * @return {String} Quickchart.io Graph Link
 */
function chartifyData(chartType, chartData, chartQuery) {
  console.log('method: chartifyData()');

  const chartTitle = Object.keys(chartData); // Get labels of the chart
  const chartKeys = Object.values(chartData); // Get primary keys of the chart
  console.log('Titles and Status: ', [chartTitle, chartKeys]);

  chartifyDataSql(chartQuery, chartKeys).then((chartValues) => {
    const chartOutput = {
      type: chartType, data: {
        datasets: [{data: chartValues}],
        labels: chartTitle
      }
    };
    console.log('QuickChart.io: ' + JSON.stringify(chartOutput));
    return 'https://quickchart.io/chart?bkg=white&c=' +
      encodeURIComponent(JSON.stringify(chartOutput));
  }).catch((error) => {
    console.log('Handled error!' + error);
    return null;
  });
}

function selectDailyChartHandler(agent) {
  console.log('method: selectDailyChartHandler()');

  // Generate Chart URL
  const ctx = {
    'name': 'generate-chart', 'lifespan': 1,
    'parameters': {'urlChart': rawDailyChart, 'today': new Date().toLocaleString()}
  };

  agent.setContext(ctx);
  agent.setFollowupEvent('daily-stats-out');
  return;
}

function weeklyChartHandler(agent) {
  console.log('method: weeklyChartHandler()');

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

function getRawDailyChart() {
  console.log('method: getRawDailyChart()');

  const data = {'good': 1, 'unwell': 2, 'anxious': 3};
  const query = `SELECT status, count(emp_id) as total FROM daily_health_logs` +
    ` WHERE isValid = 1 AND CAST(dlog_dt as DATE) = CURDATE() GROUP BY status;`;

  return new Promise((resolve, reject) => {

  });

  pool.getConnection((error, connection) => {
    if (error) {
      console.log('Error in connection - ' + error);
      reject(error);
    }

    console.log('Executing Queries: ? | ?', chartQuery);
    connection.query(chartQuery, (error, result) => {
      if (error) {
        console.log('Error in executing query - ' + error);
        reject(error);
      }
      console.log('Resultset: ' + JSON.stringify(result));
      result.forEach((row) => {
        for (let i = 0; i < chartKeys.length; i++) {
          if (row.status == chartKeys[i]) {
            chartValues.push(row.total);
          }
        }
      });
    });
    connection.release();
    console.log('Query Successful: ' + chartValues);
    resolve(chartValues);
  });
  // Generate Chart URL
  return chartifyData('pie', data, query);
}

function initializeChatbotHandler(agent) {
  // Lazy load the 'Raw' functions on background:
  if (!isRawDailyUpdated) rawDailyChart = getRawDailyChart();

  agent.setFollowupEvent('welcome-message');
  addDummyPayload(agent);
}

// Dialogflow intent mapping
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(
    (request, response) => {
      const agent = new WebhookClient({request, response});
      console.log('DF Request Headers: ' + JSON.stringify(request.headers));
      console.log('DF Request Body: ' + JSON.stringify(request.body));

      // Run the function handler based on the matched Dialogflow intent name
      const intentMap = new Map();
      intentMap.set('welcome-lazyload', initializeChatbotHandler);
      intentMap.set('daily-health.check-in.work-condition', insertDailyCheckHandler);
      intentMap.set('send-email', sendEmailHandler);
      intentMap.set('daily-health.checkin', getPhoneHandler);
      intentMap.set('daily-health.check-in.anxious-query', getQueryHandler);
      intentMap.set('reports.daily-stats', selectDailyChartHandler);
      intentMap.set('reports.weekly-stats', weeklyChartHandler);
      agent.handleRequest(intentMap);
    }
);
