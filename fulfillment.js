// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const BIGQUERY = require("@google-cloud/bigquery");

const BIGQUERY_CLIENT = new BIGQUERY({
projectId: "team-9-nbc" 
});

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
 
  function welcome(agent) {
    agent.add(`Welcome to my agent!`);
  }
 
  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }
  
   function acronymConverter(agent) {
    const text = agent.parameters.acronyms;
    var text2 = "";
    if ("SCA" == text) {text2 = "Scanning And Archiving";}
    else {
    agent.add("I'm sorry, can you try again?");}
    
    if (text2) {
       agent.add("The Acronym " + text + " means " + text2 + ".");
    }
  }
  
  function functionLookup(agent) {
    const language = agent.parameters.ProgrammingLanguage;
    const func = agent.parameters.Function; 
    
    if ("FS" == language) {
     agent.add(new Card({
          title: `FS function: ` + func,
          imageUrl: 'https://stxwiki.meditech.com/MagicFS7/skins/common/logofs7/MagicFS7.png',
          text: `This function does interesting things!`,
          buttonText: 'Information about ' + func,
          buttonUrl: 'https://stxwiki.meditech.com/magicfs7/' + func
      }));
    } 
    else if ("M-AT" == language) {
        agent.add(new Card({
            title: `M-AT function: ` + func,
            imageUrl: 'http://stxwiki.meditech.com/M-ATv12/skins/common/logo/w10DynaLogo.php',
            text: `This M-AT function is pretty interesting..`,
            buttonText: 'Information about ' + func,
            buttonUrl: 'http://stxwiki.meditech.com/wiki12/' + func
        }));
    }
    else {
    	agent.add("I don't know what what the language or function is");
    }
  }

   function ticketCollection(agent) {
    // Capture Parameters from the Current Dialogflow Context
    console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
    console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
    const OUTPUT_CONTEXTS = request.body.queryResult.outputContexts;
    // commented out below parameter for reference 
    // const EMAIL = OUTPUT_CONTEXTS[OUTPUT_CONTEXTS.length - 1].parameters["email.original"];
    const ISSUE_CATEGORY = OUTPUT_CONTEXTS[OUTPUT_CONTEXTS.length - 1].parameters.category;
    const ISSUE_TEXT = request.body.queryResult.queryText;
 

    // The SQL Query to Run
    const SQLQUERY = `WITH pred_table AS (SELECT 5 as seniority, "3-Advanced" as experience,
          @category as category, "Request" as type)
          SELECT cast(predicted_label as INT64) as predicted_label
          FROM ML.PREDICT(MODEL helpdesk.predict_eta,  TABLE pred_table)`;

    const OPTIONS = {
      query: SQLQUERY,
      // Location must match that of the dataset(s) referenced in the query.
      location: "US",
      params: {
        category: ISSUE_CATEGORY
      }
    };
    return BIGQUERY_CLIENT.query(OPTIONS)
      .then(results => {
        //Capture results from the Query
        console.log(JSON.stringify(results[0]));
        const QUERY_RESULT = results[0];
        const ETA_PREDICTION = QUERY_RESULT[0].predicted_label;
    
        //Format the Output Message
        agent.add("I don't have a quick answer for you, so I've created a task in our system. Someone will contact you shortly. " +
            " The estimated response time is " + ETA_PREDICTION  + " days."
        );
        agent.add(
          new Card({
            title:
              "New " + ISSUE_CATEGORY +
              " Task " +
              " (Estimated Response Time: " + ETA_PREDICTION  +
              " days)",
            imageUrl:
              "https://github.com/aniyip/dialogflow/blob/master/MTLogo.JPG",
            text: "Issue description: " + ISSUE_TEXT,
            buttonText: "Go to Task",
            buttonUrl: "https://docs.google.com/spreadsheets/d/1GZXH_OszxgjGNnba51vMh1j1-dsupl-85myktQHO8dQ/edit?usp=sharing"
          })
        );
        agent.setContext({
          name: "submitticket-collectname-followup",
          lifespan: 2
        });
      })
      .catch(err => {
        console.error("ERROR:", err);
      });
  }
 
 
  // // Uncomment and edit to make your own intent handler
  // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function yourFunctionHandler(agent) {
  //   agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
  //   agent.add(new Card({
  //       title: `Title: this is a card title`,
  //       imageUrl: 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
  //       text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
  //       buttonText: 'This is a button',
  //       buttonUrl: 'https://assistant.google.com/'
  //     })
  //   );
  //   agent.add(new Suggestion(`Quick Reply`));
  //   agent.add(new Suggestion(`Suggestion`));
  //   agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' }});
  // }

  // // Uncomment and edit to make your own Google Assistant intent handler
  // // uncomment `intentMap.set('your intent name here', googleAssistantHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function googleAssistantHandler(agent) {
  //   let conv = agent.conv(); // Get Actions on Google library conv instance
  //   conv.ask('Hello from the Actions on Google client library!') // Use Actions on Google library
  //   agent.add(conv); // Add Actions on Google library responses to your agent's response
  // }
  // // See https://github.com/dialogflow/fulfillment-actions-library-nodejs
  // // for a complete Dialogflow fulfillment library Actions on Google client library v2 integration sample

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('Acronym Converter', acronymConverter);
  intentMap.set('Function Lookup', functionLookup);
  intentMap.set("Submit Ticket - Issue Category", ticketCollection);
  // intentMap.set('your intent name here', yourFunctionHandler);
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap);
});
