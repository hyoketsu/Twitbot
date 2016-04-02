//Twitbot v2.5.0

var CONSUMER_KEY = '...';
var CONSUMER_SECRET = '...';
var PROJECT_KEY = '...';

var twitterService = getTwitterService();
var sheet = SpreadsheetApp.getActive().getSheetByName('シート1');

function twitter() {
  var service = getTwitterService();
  if(!service.hasAccess()) {
    authorizad();
    return;
  }
  earthquake();
  var twitter = twitterService.fetch('https://api.twitter.com/1.1/application/rate_limit_status.json', {'method':'GET', muteHttpExceptions:true});
  var json = JSON.parse(twitter.getContentText());
  if(json['resources']['statuses']['/statuses/home_timeline']['remaining'] !== 0) home();
  if(json['resources']['statuses']['/statuses/mentions_timeline']['remaining'] !== 0) mentions();
  if(json['resources']['direct_messages']['/direct_messages']['remaining'] !== 0) messages();
}

function home() {
  var since_id = sheet.getRange(1,2).getValue();
  var twitter = twitterService.fetch('https://api.twitter.com/1.1/statuses/home_timeline.json?count=200&since_id=' + since_id + '&exclude_replies=true&include_rts=false&include_entities=true', {'method':'GET', muteHttpExceptions:true});
  var json = JSON.parse(twitter.getContentText());
  if(!json[0]) return;
  sheet.getRange(1,2).setValue(json[0]['id_str']);
  for(var i = 0;i<json.length;i++) {
    var id = json[i]['id_str'];
    var text = json[i]['text'];
    var screen_name = json[i]['user']['screen_name'];
    if(json[i]['user']['followers_count'] === 0 || json[i]['user']['friends_count'] === 0 || json[i]['user']['listed_count'] === 0 || json[i]['user']['favourites_count'] === 0 || json[i]['user']['statuses_count'] === 0 || json[i]['user']['lang'] !== 'ja') {
      twitterService.fetch('https://api.twitter.com/1.1/friendships/destroy.json?screen_name=' + screen_name, {'method':'POST'});
      continue;
    }
    if(json[i]['lang'] !== 'ja' || !json[i]['source'].match('Twitter') || json[i]['user']['following'] == false || json[i]['favorited'] === true || json[i]['retweeted'] === true) continue;
    var content = sentenceUnderstanding(text);
    if(!content) continue;
    if(!content['taskIdList']) continue;
    var status
    switch(content['taskIdList'][0]) {
      case 'BC00101':
        status = keyword(id,text);
        if(!status || status.length >= 140) continue;
        twitterService.fetch('https://api.twitter.com/1.1/statuses/retweet/' + id + '.json', {'method':'POST', muteHttpExceptions:true});
        twitterService.fetch('https://api.twitter.com/1.1/statuses/update.json?status=' + encodeURIComponent(status) + '&in_reply_to_status_id=' + id, {'method':'POST', muteHttpExceptions:true});
        twitterService.fetch('https://api.twitter.com/1.1/favorites/create.json?id=' + id, {'method':'POST', muteHttpExceptions:true});
        return;
      case 'BT00301':
        status = weather(content);
        if(!status || status.length >= 140) continue;
        status = '@' + screen_name + ' ' + status;
        twitterService.fetch('https://api.twitter.com/1.1/statuses/update.json?status=' + encodeURIComponent(status) + '&in_reply_to_status_id=' + id, {'method':'POST', muteHttpExceptions:true});
        twitterService.fetch('https://api.twitter.com/1.1/favorites/create.json?id=' + id, {'method':'POST', muteHttpExceptions:true});
        break;
      default:
        continue;
    }
  }
}

function mentions() {
  var since_id = sheet.getRange(2,2).getValue();
  var twitter = twitterService.fetch('https://api.twitter.com/1.1/statuses/mentions_timeline.json?since_id=' + since_id + '&include_entities=true', {'method':'GET', muteHttpExceptions:true});
  var json = JSON.parse(twitter.getContentText());
  if(!json[0]) return;
  sheet.getRange(2,2).setValue(json[0]['id_str']);
  for(var i = 0;i<json.length;i++) {
    var id = json[i]['id_str'];
    var text = json[i]['text'];
    var screen_name = json[i]['user']['screen_name'];
    if(json[i]['user']['followers_count'] === 0 || json[i]['user']['friends_count'] === 0 || json[i]['user']['listed_count'] === 0 || json[i]['user']['favourites_count'] === 0 || json[i]['user']['statuses_count'] === 0 || json[i]['user']['lang'] !== 'ja') {
      twitterService.fetch('https://api.twitter.com/1.1/friendships/destroy.json?screen_name=' + screen_name, {'method':'POST', muteHttpExceptions:true});
      continue;
    }
    if(!json[i]['source'].match('Twitter') || json[i]['user']['following'] == false || json[i]['lang'] !== 'ja' || json[i]['favorited'] === true) continue;
    var content = sentenceUnderstanding(text);
    if(!content) continue;
    if(!content['taskIdList']) continue;
    var status;
    switch(content['taskIdList'][0]) {
      case 'BT00301':
        status = weather(content);
        if(!status || status.length >= 140) status = keyword(id,text);
        if(!status || status.length >= 140) status = dialogue(text);
        if(!status || status.length >= 140) continue;
        status = '@' + screen_name + ' ' + status;
        twitterService.fetch('https://api.twitter.com/1.1/statuses/update.json?status=' + encodeURIComponent(status) + '&in_reply_to_status_id=' + id, {'method':'POST', muteHttpExceptions:true});
        twitterService.fetch('https://api.twitter.com/1.1/favorites/create.json?id=' + id, {'method':'POST', muteHttpExceptions:true});
        break;
      default:
        status = keyword(id,text);
        if(!status || status.length >= 140) status = dialogue(text);
        if(!status || status.length >= 140) continue;
        status = '@' + screen_name + ' ' + status;
        twitterService.fetch('https://api.twitter.com/1.1/statuses/update.json?status=' + encodeURIComponent(status) + '&in_reply_to_status_id=' + id, {'method':'POST', muteHttpExceptions:true});
        twitterService.fetch('https://api.twitter.com/1.1/favorites/create.json?id=' + id, {'method':'POST', muteHttpExceptions:true});
        break;
    }
  }
}

function messages() {
  var since_id = sheet.getRange(3,2).getValue();
  var twitter = twitterService.fetch('https://api.twitter.com/1.1/direct_messages.json?since_id=' + since_id + '&include_entities=true', {'method':'GET', muteHttpExceptions:true});
  var json = JSON.parse(twitter.getContentText());
  if(!json[0]) return;
  sheet.getRange(3,2).setValue(json[0]['id_str']);
  for(var i = 0;i<json.length;i++) {
    var id = json[i]['id_str'];
    var text = json[i]['text'];
    var screen_name = json[i]['sender_screen_name'];
    if(json[i]['sender']['followers_count'] === 0 || json[i]['sender']['friends_count'] === 0 || json[i]['sender']['listed_count'] === 0 || json[i]['sender']['favourites_count'] === 0 || json[i]['sender']['statuses_count'] === 0 || json[i]['sender']['lang'] !== 'ja') {
      twitterService.fetch('https://api.twitter.com/1.1/friendships/destroy.json?screen_name=' + screen_name, {'method':'POST', muteHttpExceptions:true});
      continue;
    }
    var content = sentenceUnderstanding(text);
    if(!content) continue;
    if(!content['taskIdList']) continue;
    var status;
    switch(content['taskIdList'][0]) {
      case 'BT00301':
        status = weather(content);
        if(!status) status = keyword(id,text);
        if(!status) status = dialogue(text);
        if(!status) continue;
        twitterService.fetch('https://api.twitter.com/1.1/direct_messages/new.json?screen_name=' + screen_name + '&text=' + encodeURIComponent(status), {'method':'POST', muteHttpExceptions:true});
        break;
      default:
        status = keyword(id,text);
        if(!status) status = dialogue(text);
        if(!status) continue;
        twitterService.fetch('https://api.twitter.com/1.1/direct_messages/new.json?screen_name=' + screen_name + '&text=' + encodeURIComponent(status), {'method':'POST', muteHttpExceptions:true});
        break;
    }
  }
}

function sentenceUnderstanding(text) {
  var dialogue_options = {
    'projectKey': 'OSU',
    'appInfo': {
      'appName': 'hoge_app',
      'appKey': 'hoge_app01'
    },
    'clientVer': '1.0.0',
    'language': 'ja',
    'userUtterance': {
      'utteranceText': text
    }
  };
  var options = {
    'method': 'POST',
    'contentType': 'application/x-www-form-urlencoded',
    'payload': JSON.stringify(dialogue_options),
    muteHttpExceptions:true
  };
  var response = UrlFetchApp.fetch('https://api.apigw.smt.docomo.ne.jp/sentenceUnderstanding/v1/task?APIKEY=69744634675a536375425554464e42633973564f526a66756d3572394d7466646d736d6d63332f624c5443', options);
  response = response.getContentText();
  if(!response) return;
  var content = JSON.parse(response);
  return content;
}

function weather(content) {
  var slotStatus = content['dialogStatus']['slotStatus'];
  for(var i = 0;i<slotStatus.length;i++) {
    if(slotStatus[i]['slotName'] !== 'searchArea') continue;
    var geocode = slotStatus[i]['slotValue'];
    var response = Maps.newGeocoder().setLanguage('ja').geocode(geocode);
    if(response['results']) break;
    var q = response['results'][i]['address_components'][0]['long_name'];
    if(q == 'none') break;
    response = UrlFetchApp.fetch('http://map.goo.ne.jp/search/q/' + encodeURIComponent(q), {muteHttpExceptions:true});
    response = response.getContentText();
    var url = response.match(/http:\/\/weather.goo.ne.jp\/weather\/address\/(.+?)\//);
    if(!url) break;
    response = UrlFetchApp.fetch(url[0], {muteHttpExceptions:true});
    response = response.getContentText();
    var text = response.match(/<p class=weather>(.+?)<\/p>/);
    var status = text[1] + '\n' + url[0];
    if(status.length >= 140) {
      url = UrlShortener.Url.insert({longUrl: url[0]});
      status = text + '\n' + url['id'];
    }
    return status;
  }
  return;
}

function keyword(id,text) {
  text = text.replace(/[\x00-\x7F]/g,'');
  var dialogue_options = {
    'app_id': 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'title': ' ',
    'body': '\'' + text + '\''
  };
  var options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify(dialogue_options),
    muteHttpExceptions:true
  };
  var response = UrlFetchApp.fetch('https://labs.goo.ne.jp/api/keyword', options);
  var content = JSON.parse(response.getContentText());
  var keywords = content['keywords'];
  for(var i = 0;i<keywords.length;i++) {
    var surface = JSON.stringify(keywords[i]);
    if(!q) var q = surface.replace(/[\x00-\x7F]/g,'');
    else q = q + ' AND ' + surface.replace(/[\x00-\x7F]/g,'');
  }
  if(!q) return;
  var twitter = twitterService.fetch('https://api.twitter.com/1.1/search/tweets.json?q=' + encodeURIComponent(q) + '&lang=ja', {'method':'GET', muteHttpExceptions:true});
  var json = JSON.parse(twitter.getContentText());
  var statuses = json['statuses'];
  for(i = 0;i<statuses.length;i++) {
    if(!statuses[i]['source'].match('Twitter') || statuses[i]['user']['followers_count'] === 0 || statuses[i]['user']['friends_count'] === 0 || statuses[i]['user']['listed_count'] === 0 || statuses[i]['user']['favourites_count'] === 0 || statuses[i]['user']['statuses_count'] === 0 || statuses[i]['user']['lang'] !== 'ja') continue;
    var status = statuses[i]['text'];
    if(status && id !== statuses[i]['id_str'] && !status.match(/[\x00-\x7F]/) && !status.match(/\n/)　&& !status.match(text)) return status;
  }
  return;
}

function dialogue(text) {
  text = text.replace(/[\x00-\x7F]/g,'');
  var dialogue_options = {
    'utt': text
  };
  var options = {
    'method': 'POST',
    'contentType': 'application/json',
    'payload': JSON.stringify(dialogue_options),
    muteHttpExceptions:true
  };
  var response = UrlFetchApp.fetch('https://api.apigw.smt.docomo.ne.jp/dialogue/v1/dialogue?APIKEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', options);
  var content  = JSON.parse(response.getContentText());
  var status = content['utt'];
  return status;
}

function earthquake() {
  var response = UrlFetchApp.fetch('http://weather.goo.ne.jp/earthquake/index.rdf', {muteHttpExceptions:true});
  response = response.getContentText('EUC-JP');
  var xml = XmlService.parse(response);
  var item = xml.getRootElement().getChildren('channel')[0].getChildren('item')[0];
  var link = item.getChild("link").getText();
  var exec = /\d+/g;
  var id = exec.exec(link);
  if(sheet.getRange(4,2).getValue() == id) return;
  sheet.getRange(4,2).setValue(id);
  var title = item.getChild("title").getText();
  title = title.replace('(','\n');
  var status = title + '\n' + link;
  twitterService.fetch('https://api.twitter.com/1.1/statuses/update.json?status=' + encodeURIComponent(status), {'method':'POST', muteHttpExceptions:true});
  return;
}

function getTwitterService() {
  var service = OAuth1.createService('twitter');
  service.setAccessTokenUrl('https://api.twitter.com/oauth/access_token');
  service.setRequestTokenUrl('https://api.twitter.com/oauth/request_token');
  service.setAuthorizationUrl('https://api.twitter.com/oauth/authorize');
  service.setConsumerKey(CONSUMER_KEY);
  service.setConsumerSecret(CONSUMER_SECRET);
  service.setProjectKey(PROJECT_KEY);
  service.setCallbackFunction('authCallback');
  service.setPropertyStore(PropertiesService.getScriptProperties());
  return service;
}

function authCallback(request) {
  var service = getTwitterService();
  var isAuthorized = service.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Success! You can close this page.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this page');
  }
}

function authorizad() {
  var service = getTwitterService();
  var authorizationUrl = service.authorize();
  Logger.log('Please visit the following URL and then re-run the script: ' + authorizationUrl);
}
