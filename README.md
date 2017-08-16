# Bitrix24-promise

A Node.js module that provides automatic authorization to a Bitrix24-based CRM system, allowing you to call BX24 REST API methods promisified with a similar syntax, without ever touching the weird window-based official Javascript library.

## Usage

Initialize the library by providing the credentials, add a route to listen to the token callback, then call Bitrix methods:
```
const express = require('express');
const app = express();
const BX24 = require('bitrix24-promise');
BX24.initialize({
    url:'https://your-bitrix-portal.bitrix24.ru',
    credentials:{
        client: {
            id: 'local.123456idstring.78901011',
            secret: 'bitrix secret string'
        },
        auth: {
            tokenHost: 'https://oauth.bitrix.info',
            tokenPath: '/oauth/token/',
            authorizePath: '/oauth/authorize'
        },
        user: {
            login: 'username@gmail.com',
            password: 'hunter2'
        }
    },
    scope:'crm'
});
app.get('/token_callback', BX24.tokenCallback, function(req, res){
    res.send('Authorization successful');
    BX24.callMethod('crm.contact.list').then(function(result){
        for(let user of result)
            console.log(user.NAME);
    });
});
```

## Installation

```
npm install --save gitlab:lol10801lol/bitrix24-promise
```

## Developer Reference

For Bitrix24 API documentation, see https://dev.1c-bitrix.ru/rest_help/index.php

`BX24.initialize({})`

Set up the library and optionally try to authorize automatically. Return a promise that can contain the token if authorization was automatic, but the recommended way of getting data on initialization is to put the request in token callback.
```
url:'https://your-bitrix-portal.bitrix24.ru', //required - base url of your bitrix portal
credentials:{
    client: {
        id: 'local.123456idstring.78901011', //required - id of your app
        secret: 'bitrix secret string that is usually long'  //required - secret string of your app
    },
    auth: {
        tokenHost: 'https://oauth.bitrix.info', //required - base url of oauth server
        tokenPath: '/oauth/token/', //required - oauth grant token url
        authorizePath: '/oauth/authorize' //required - oauth url with user authorization
    },
    user: {
        login: 'username@gmail.com', //optional - username for automatic authorization
        password: 'hunter2' //optional - password for automatic authorization
    },
    scope:'crm' //optional - default is 'crm'
}
```
For the possible scope field values, see https://dev.1c-bitrix.ru/learning/course/index.php?COURSE_ID=99&LESSON_ID=2280 . Multiple values in the string should be separated by commas.

`BX24.tokenCallback(req, res, next)`

Express middleware to grab auth data and request the access token. It is necessary to use this middleware with either manual or automatic authorization. All BX24 methods called after this middleware will have the access token.

`BX24.manualAuthURL(req, res)`

Express route that redirects the user to the OAuth site. You can do the redirect in your own routes and this one is provided just for convinience.

`BX24.getToken()`

Returns a *token* promise. Calling this method will refresh the token if it is expired.
```
{
    accessToken: 'String' //token that can be used to access Bitrix API outside of the callMethod() function
    refreshToken: 'String' //refresh token used internally to refresh the token when it expires
    expiresAt: Number // amount of milliseconds from 1 January 1970 to the moment this accessToken expires
}
```
`BX24.callMethod(method, params)`

Call a Bitrix method, refreshing the token if necessary. Returns a promise with the request result. Parameters object is optional. For method descriptions, see the official Bitrix REST API documentation https://dev.1c-bitrix.ru/rest_help/index.php
