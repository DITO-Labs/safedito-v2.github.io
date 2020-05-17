# SafeDITO Chatbot (Employee Assistance)

## Main Features
* Daily / Weekly Health Check-in with Reporting Capabilities
* Capability to be integrated to a Website or Messaging Applications such as Alibaba's DingTalk, Facebook Messenger, etc.
* Huge Database of Knowledge, Info Graphics and Frequently Asked Questions (FAQs) from trusted sources:
    * DITO Human Resources (HR) Team
    * [World Health Organization (WHO)](https://www.who.int/news-room/q-a-detail/q-a-coronaviruses)
    * [Deparnment of Health (DOH)](https://www.doh.gov.ph/COVID-19/FAQs)
    * [Centers for Disease Control (CDC)](https://www.cdc.gov/coronavirus/2019-ncov/faq.html)
    * [University of the Philippines' Covid-19 Web Portal](https://endcov.ph/dashboard/)
    * [Metropolitan Manila Development Authority (MMDA)](http://www.mmda.gov.ph/20-faq/288-disaster-awareness-faq.html)
    * [National Disaster Risk Reduction and Management Council(NDRRMC)](www.ndrrmc.gov.ph)


## Supported Topics:
(*Author Note: This needs to be improved*)
* COVID-19
* Info Graphics for Earthquake, Fire, Typhoon and Tsunami
* Employee Assistance Program
* Employee Wellbeing


## Flow Chart Summary:
![SafeDITO v2 Flowchart](/images/flowchart.png)


## Live Demo

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;https://safedito-v2.github.io


## Tech Stack
* HTML5 / JavaScript / Bootstrap 4
* DialogFlow / Cloud Functions / BigQuery API


## Getting Started
1. Clone this repository
    
    `git clone https://github.com/SafeDITO/safedito.github.io.git`

2. Compress the following directories:
    * agent -> agent.zip
    * fulfillment -> fulfillment.zip

3. Import the agents / fulfillments to Google DialogFlow.

4. Configure Google Cloud Function and Google APIs.

5. Add DialogFlow's Messenger Widget Code to a website (e.g. `index.html` on this repo)


## Author / License
`SafeDITO` (April 2020) by DITO Telecommunity Technology Team under [Creative Commons Zero v1.0 Universal](https://github.com/GoogleCloudPlatform/covid19-rapid-response-demo/blob/master/agent-template/LICENSE)


## TO DO:
1. Improve the content and UI/UX in `index.html`
2. Improve knowledgebase, intents and conversation skills

## Infographics
Aside from mentioned sources above, we used some infographics that are publicly available in the web. Below are the sources of this graphics:
1. chatbot-banner.svg (https://www.nellinfotech.com/chatbot-products)
2. emergency-hotlines.jpg (https://news.mb.com.ph)