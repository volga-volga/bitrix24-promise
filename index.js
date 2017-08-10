/* jshint esversion: 6, node:true */
/* eslint no-console:false */
'use strict';

const request = require('request-promise');
var token = null;
var bitrixUrl = '';
var credentials = {};
var scope = 'crm';
function isExpired(token){
    return(new Date() > token.expiresAt);
}
function refreshToken(token){
    if(token !== null)
    {
        const options = {
            'url':credentials.auth.tokenHost+credentials.auth.tokenPath,
            'qs':{
                'refresh_token':token.refreshToken,
                'client_id':credentials.client.id,
                'client_secret':credentials.client.secret,
                'grant_type':'refresh_token'
            }
        };
        return new Promise(function(resolve,reject){
            request(options)
                .then(function(response){
                    try
                    {
                        let data = JSON.parse(response);
                        let time = new Date();
                        token = {
                            'accessToken':data.access_token,
                            'refreshToken':data.refresh_token,
                            'expiresAt':time.setSeconds(time.getSeconds() + data.expires_in)
                        };
                        resolve(token);
                    }
                    catch(err){
                        reject(err);
                    }
                })
                .catch(function(err){
                    reject(err);
                });
        });
    }
    else throw new Error('Bitrix24 was not properly initialized. Token not found.');
}
exports.initialize = function(params){
    return new Promise(function(resolve, reject){
        if(params.url) bitrixUrl = params.url+'/rest/';
        else reject(new Error('Bitrix24 url not set.'));
        if(params.credentials.client)
        {
            credentials.client = {};
            if(params.credentials.client.id) credentials.client.id = params.credentials.client.id;
            else reject(new Error('Bitrix24 credentials are not correct.'));
            if(params.credentials.client.secret) credentials.client.secret = params.credentials.client.secret;
            else reject(new Error('Bitrix24 credentials are not correct.'));
        }
        else reject('Bitrix24 credentials are not correct.');
        if(params.credentials.auth)
        {
            credentials.auth = {};
            if(params.credentials.auth.tokenHost) credentials.auth.tokenHost = params.credentials.auth.tokenHost;
            else reject(new Error('Bitrix24 credentials are not correct.'));
            if(params.credentials.auth.tokenPath) credentials.auth.tokenPath = params.credentials.auth.tokenPath;
            else reject(new Error('Bitrix24 credentials are not correct.'));
            if(params.credentials.auth.authorizePath) credentials.auth.authorizePath = params.credentials.auth.authorizePath;
            else reject(new Error('Bitrix24 credentials are not correct.'));
        }
        else reject(new Error('Bitrix24 credentials are not correct.'));
        if(params.scope) scope = params.scope;
        if(params.credentials.user && params.credentials.user.login && params.credentials.user.password){
            //Experimental - try to initialize authomatically
            let authJar = request.jar();
            request.post({
                'url':'https://www.bitrix24.net/auth/',
                'jar': authJar,
                'form':{
                    'AUTH_FORM':'Y',
                    'TYPE':'AUTH',
                    'USER_LOGIN':params.credentials.user.login,
                    'USER_PASSWORD':params.credentials.user.password,
                    'USER_REMEMBER':'N'
                },
                'resolveWithFullResponse':true,
                'simple':false
            }).then(function(authResponse){
                if(authResponse.statusCode == 302) //302 Moved is bitrix response code for successful auth, we got the PHPSESSID in the bag(or jar in this case)
                {
                    request({
                        'url':bitrixUrl.split('/rest/')[0]+'/oauth/authorize/?client_id='+credentials.client.id, //try to authorize client app, following redirect fails to get code from the main site
                        'jar':authJar,
                        'resolveWithFullResponse':true,
                        'simple':false,
                        'followRedirect':false
                    })
                    .then(function(redirectResponse){
                        request({
                            'url':decodeURIComponent(redirectResponse.headers.location.split('redirect_uri=')[1]), //follow a redirect to main site manually to get auth data
                            'jar':authJar,
                            'resolveWithFullResponse':true,
                            'simple':false,
                        })
                        .then(function(authServiceResponse){
                            request({
                                'url':bitrixUrl.split('/rest/')[0]+decodeURIComponent(authServiceResponse.body.substr(51).split('\';</')[0]), //auth with the site using auth data
                                'jar':authJar,
                                'resolveWithFullResponse':true,
                                'simple':false,
                            })
                            .then(function(){ //this is the custom user response and we don't really need it
                                resolve(token); //token should be available now
                            })
                            .catch(function(err){
                                reject(err);
                            });
                        })
                        .catch(function(err){
                            reject(err);
                        });
                    })
                    .catch(function(err){
                        reject(err);
                    });
                }
                else reject(new Error('Bitrix24 authorization failed, check username/password.'));
            })
            .catch(function(err){
                reject(err);
            });
        }
        else resolve({'accessToken':null,'refreshToken':null,'expiresAt':null});
    });
};
exports.manualAuthURL = function(req, res){
    if (Object.keys(credentials).length === 0) throw new Error('Bitrix24 was not properly initialized before calling auth.');
    else res.redirect(credentials.auth.tokenHost+credentials.auth.authorizePath+'?scope='+scope+'&response_type=code&client_id='+credentials.client.id);
};
exports.tokenCallback = function(req, res, next){
    const options = {
        'url':credentials.auth.tokenHost+credentials.auth.tokenPath,
        'qs':{
            'code':req.query.code,
            'client_id':credentials.client.id,
            'client_secret':credentials.client.secret,
            'grant_type':'authorization_code'
        }
    };
    request(options)
        .then(function(response){
            let data = JSON.parse(response);
            let time = new Date();
            token = {
                'accessToken':data.access_token,
                'refreshToken':data.refresh_token,
                'expiresAt':time.setSeconds(time.getSeconds() + data.expires_in)
            };
            next();
        })
        .catch(function(err){
            throw new Error(err);
        });
};
//TODO: switch to POST request keeping the query string same for passing URI limits
exports.callMethod = function(method,params){
    function callRequest(options)
    {
        return new Promise(function(resolve, reject){
            request(options)
                .then(function(result){
                    try
                    {
                        let body = JSON.parse(result.body);
                        if(result.statusCode == 200) 
                        {
                            if(body.error) reject(new Error(body.error));
                            else resolve(body.result);
                        }
                        else reject(new Error(JSON.stringify({'statusCode':result.statusCode,'body':body})));
                    }
                    catch(err)
                    {
                        reject(err);
                    }
                })
                .catch(function(err){
                    reject(err);
                });

        });
    }
    if(token === null) throw new Error('Bitrix24 was not properly initialized. Token not found.');
    else if(isExpired(token))
        return refreshToken(token)
            .then(function(token){
                if(params)
                    params.auth = token.accessToken;
                else
                    params = {'auth':token.accessToken};
                const options = {
                    'url':bitrixUrl+method,
                    'qs':params,
                    'resolveWithFullResponse':true,
                    'simple':false
                };
                return callRequest(options);
            })
            .catch(function(err){
                throw new Error(err);
            });
    else
    {
        if(params)
            params.auth = token.accessToken;
        else
            params = {'auth':token.accessToken};
        const options = {
            'url':bitrixUrl+method,
            'qs':params,
            'resolveWithFullResponse':true,
            'simple':false
        };
        return callRequest(options);
    }
};
exports.getToken = function(){
    if(isExpired(token)) return refreshToken(token);
    else return Promise.resolve(token);
};
