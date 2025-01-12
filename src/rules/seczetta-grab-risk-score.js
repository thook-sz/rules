/* global configuration, auth0 */

/**
 * @title seczettaGrabRiskScore
 * @overview Grab the risk score from SecZetta to use in the authentication flow
 * @gallery true
 * @category multifactor"
 * 
 * 
 * **Required configuration** (this Rule will be skipped if any of the below are not defined):
 *
 *    - `SECZETTA_API_KEY` API Token from your SecZetta tennant
 *    - `SECZETTA_BASE_URL` URL for your SecZetta tennant
 *    - `SECZETTA_ATTRIBUTE_ID` the id of the SecZetta attribute you are searching on (i.e personal_email, user_name, etc.)
 *    - `SECZETTA_PROFILE_TYPE_ID' the id of the profile type this user's profile
 *
 * **Optional configuration:**
 *
 *    - `SECZETTA_AUTHENTICATE_ON_ERROR` Choose whether or not the rule continues to authenticate on error
 *    - `SECZETTA_RISK_KEY` The attribute name on the account where the users risk score is stored
 *    - `SECZETTA_ALLOWABLE_RISK` Set to a risk score integer value above which MFA is required
 *    - `SECZETTA_MAXIMUM_ALLOWED_RISK` Set to a maximum risk score integer value above which login fails.
 *    
 * **Helpful Hints**
 *    - The SecZetta API documentation is located here: https://{{SECZETTA_BASE_URL}}/api/v1/
 *
 * @param {object} user
 * @param {object} context
 * @param {function} callback
 */
async function seczettaGrabRiskScore(user, context, callback) {
  
  if (!configuration.SECZETTA_API_KEY || !configuration.SECZETTA_BASE_URL) {
    console.log("Missing required configuration. Skipping.");
    return callback(null, user, context);
  }

  const userUtils = new require(
    "@auth0/rule-utilities@0.2.0"
  );

  const axios = require("axios@0.19.2");
      
  //As of right now (12/15/2020), SecZetta has to call 2 apis to grab the risk score. One to grab the profile
  //and then once we have the profile we can grab the ID to call the risk score api.
  //  For all SecZetta API you need to request an api key in the admin side of the tool
  //       templates -> apis -> new key
  //  Once you have that new API key you need to add 3 headers to the request itself
  //  >>  'Content-Type':'application/json',
  //  >>  'Authorization': 'Token token=${apiKey},
  //  >>  'Accept': 'application/json'
  //  Get Profile API 
  //  >> get profile searches by 'name' this name field is configurable on the SecZetta side
  //  >> Request:
  //  >> https://taylordemo.mynonemployee.com/api/profiles?name=${name}
  //  >>
  //  >> Example Response: 
  // >> "profiles": [
  // >>     {
  // >>         "id": "633b5e71-090c-4a47-a1a3-d0b8338df872",
  // >>         "uid": "eedb47e4c2e147778a9e3be61c255a38",
  // >>         "name": "testuser01@seczetta.com",
  // >>         "profile_type_id": "5666f53e-cdd8-4420-8431-ca6e62e81451",
  // >>         "status": "Active",
  // >>         "updated_at": "2020-12-15T12:19:34.000-05:00",
  // >>         "created_at": "2020-12-14T17:36:33.000-05:00",
  // >>         "attributes": {
  // >>             "personal_home_phone": "",
  // >>             "engagement_contract_start_date": "12/14/2020",
  // >>             "engagement_contract_end_date": "01/30/2021",
  // >>             "personal_middle_name": "",
  // >>             "personal_birthdate": "12/14/2020",
  // >>             "engagement_type_of_employment": "Corporate Temp",
  // >>             "personal_state": "AL",
  // >>             "personal_mobile": "",
  // >>             "personal_city": "",
  // >>             "personal_email": "testuser01@seczetta.com",
  // >>             "personal_zip": "",
  // >>             "personal_first_name": "Test",
  // >>             "personal_last_name": "User01",
  // >>             "personal_street": ""
  // >>         }
  // >>     }
  // >> ] 
  //  Get Risk Score API 
  //  >> notice in the response that the risk score still comes back as an array of 1
  //  >> Request:
  //  >> https://taylordemo.mynonemployee.com/api/risk_scores?object_id=${objectId}
  //  >> 
  //  >> Example Response: 
  //  >> {
  //  >>    "risk_scores": [
  //  >>        {
  //  >>            "id": "14118693-983e-462f-a330-f3b34d29f281",
  //  >>            "uid": "036e7e2a3d0c41938609cdc6029d5b11",
  //  >>            "object_id": "633b5e71-090c-4a47-a1a3-d0b8338df872",
  //  >>            "object_type": "Profile",
  //  >>            "overall_score": 3.5,
  //  >>            "overall_risk_level_id": "29fc4382-2c60-4c6d-891b-15102cdc9e01",
  //  >>            "impact_score": 7.0,
  //  >>            "impact_risk_level_id": "29fc4382-2c60-4c6d-891b-15102cdc9e01",
  //  >>            "probability_score": 0.0,
  //  >>            "probability_risk_level_id": "c1f10e76-44c0-4bda-b344-8ae2a256d6c4"
  //  >>        }
  //  >>    ]
  //  >> }

  let profileResponse;
  let riskScoreResponse;

  let attributeId = configuration.SECZETTA_ATTRIBUTE_ID;
  let profileTypeId = configuration.SECZETTA_PROFILE_TYPE_ID;

  let uid = user.user_name || user.email; //depends on the configuration
  let profileRequestUrl = configuration.SECZETTA_BASE_URL + '/advanced_search/run';
  let advancedSearchBody = {
    advanced_search: {
      label: "All Contractors",
      condition_rules_attributes: [
        {
          "type": "ProfileTypeRule",
          "comparison_operator": "==",
          "value": profileTypeId
        },
        {
          "type": "ProfileAttributeRule",
          "condition_object_id": attributeId,
          "object_type": "NeAttribute",
          "comparison_operator": "==",
          "value": uid
        }
      ]
    }
  };
  
  try {
    	profileResponse = await axios.post(profileRequestUrl,advancedSearchBody,{
        headers: {
          'Content-Type':'application/json',
          'Authorization': 'Token token='+configuration.SECZETTA_API_KEY,
          'Accept': 'application/json'
        },
      });

      //if the user isnt found via the advanced search. A 
    	if( profileResponse.data.profiles.length === 0 ) {
        console.log("Profile not found. Empty Array sent back!");
  	 		if( configuration.SECZETTA_AUTHENTICATE_ON_ERROR && configuration.SECZETTA_AUTHENTICATE_ON_ERROR === "true" ) {
          return callback(null, user, context);
        }
        return callback(new UnauthorizedError("Error retrieving Risk Score."));
  		}
    
  } catch (profileError) {
    // Swallow risk scope API call, default is set to highest risk below.
    console.log(`Error while calling Profile API: ${profileError.message}`);
    if( configuration.SECZETTA_AUTHENTICATE_ON_ERROR && configuration.SECZETTA_AUTHENTICATE_ON_ERROR === "true" ) {
      return callback(null, user, context);
    }
    return callback(new UnauthorizedError("Error retrieving Risk Score."));
  }

  //Should now have the profile in profileResponse. Lets grab it.
  let objectId = profileResponse.data.profiles[0].id;
  console.log(objectId);

  let riskScoreRequestUrl = configuration.SECZETTA_BASE_URL + '/risk_scores?object_id=' + objectId;

  try {
      riskScoreResponse = await axios.get(riskScoreRequestUrl,{
      headers: {
        'Content-Type':'application/json',
        'Authorization': 'Token token='+configuration.SECZETTA_API_KEY,
        'Accept': 'application/json'
      },
    });
  } catch (riskError) {
    // Swallow risk scope API call, default is set to highest risk below.
    console.log(`Error while calling Risk Score API: ${riskError.message}`);
    if( configuration.SECZETTA_AUTHENTICATE_ON_ERROR && configuration.SECZETTA_AUTHENTICATE_ON_ERROR === "true" ) {
      return callback(null, user, context);
    }
    return callback(new UnauthorizedError("Error retrieving Risk Score."));
  }

  //Should now finally have the risk score. Lets add it to the user
  var riskScoreObj = riskScoreResponse.data.risk_scores[0];
  var overallScore = riskScoreObj.overall_score;

  // Default risk value is set to highest if API fails or no score returned.
  //var riskScore = typeof apiResponse.riskScore === "number" ? riskScore : 100;

  const allowableRisk = parseInt(configuration.SECZETTA_ALLOWABLE_RISK, 10);
  const maximumRisk = parseInt(configuration.SECZETTA_MAXIMUM_ALLOWED_RISK, 10);
  
  //if risk score is below the maxium risk score but above allowable risk: Require MFA
  if (allowableRisk && overallScore > allowableRisk && overallScore < maximumRisk) {
    console.log(
      `Risk score ${overallScore} is greater than maximum of ${allowableRisk}. Prompting for MFA`
    );
    context.multifactor = {
      provider: 'any',
      allowRememberBrowser: false
    };
    return callback(null, user, context);
  
  }

  //if risk score is above the maxium risk score: Fail authN
  if (maximumRisk && overallScore > maximumRisk) {
    console.log(
      `Risk score ${overallScore} is greater than maximum of ${maximumRisk}`
    );
    return callback(new UnauthorizedError("A "+overallScore+" Risk score is too high. Maximum acceptable risk is " + maximumRisk));
  }

  if (configuration.SECZETTA_RISK_KEY) {
    context.idToken[configuration.SECZETTA_RISK_KEY] = overallScore;
    context.accessToken[configuration.SECZETTA_RISK_KEY] = overallScore;
  }

  return callback(null, user, context);
}