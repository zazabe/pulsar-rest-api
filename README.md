[![Build Status](https://travis-ci.org/cargomedia/pulsar-rest-api.png?branch=master)](https://travis-ci.org/cargomedia/pulsar-rest-api)

(unstable, currently in development)

pulsar-rest-api
===============

## About
HTTP REST API for executing [pulsar](https://github.com/nebulab/pulsar) tasks.

## Server

### Installation
Package is in nodejs and is available through npm registry:
```
npm install pulsar-rest-api [-g]
```

### Running
####In short
 * Prepare valid config.
 * Verify that mongodb is up and running.
 * Run the instance with command `pulsar-rest-api -c 'your_config.yaml'`

####In detail
#####Prepare valid config
The instance of pulsar-rest-api can be run with different options. All of the options can be specified in the config. To run the instance with
your own config you need to specify the filepath to it with the flag `-c`. For example `pulsar-rest-api -c '~/my_pulsar_config.yaml'`.

The default config is [`config.yaml`](bin/config.yaml) and it can be found in `bin` directory of the pulsar-rest-api installation.

Please read carefully through the format of the config below. The options that are marked as required must be present in your config otherwise the
instance won't start. There are no options that have default value. All values should be clearly defined.
```yaml
port: # required. Port where server listens for requests.
auth: # authentication block of config.
  githubOauthId: # required. Github OAuth Application ID. To get it go to https://github.com/settings/applications/new
  githubOauthSecret: # required. Github OAuth Application Secret. To get it go to https://github.com/settings/applications/new
  githubOrg: # required. Github organization. User needs to be member of that organization to get access to the interface of pulsar-rest-api.
  baseUrl: # required. URL where the pulsar-rest-api instance would have its web interface.
  callbackUrl: # required. OAuth callback Url. Must be relative to the baseUrl.
mongodb:# mongoDB connection parameters
  host: # required. hostname
  port: # required. port
  db: # required. database name. Now there is only one collection 'tasks' will be used.
pulsar:
  repo: # optional. Pulsar configuration repository. If omitted then [pulsar rules](https://github.com/nebulab/pulsar#loading-the-repository) applied.
  branch: # optional. Branch for pulsar configuration repository. If omitted then [pulsar rules](https://github.com/nebulab/pulsar#loading-the-repository) applied.
ssl:
  key: # required if `pfx` isn't presented. Ssl private key file. Combine with `cert` option.
  cert: # required if `pfx` isn't presented. Ssl public certificate file. Combine with `key` option. Append CA-chain within this file.
  pfx: # required if `key` or `cert` options aren't presented. Ssl pfx file (key + cert). Overrides `ssl-key` and `ssl-cert` options.
  passphrase: # optional. File containing the ssl passphrase.
```
#####Verify that mongodb is up and running
The mongodb instance that you defined in your config should be up and running before you start the pulsar.

#####Run
`pulsar-rest-api -c 'your_config.yaml'`. After that web interface should be browsable through url defined in `auth.baseUrl`.

### Test

#### Auto tests
To run these tests you need the running instance of mongodb. The required configuration of mongodb can be found in `test/config.yaml`, section `mongodb`.
When mongodb is running type in console `npm test`.

#### Manual tests
To see how the server is working you need to run its instance and open `https://localhost:8001/web` to see its web interface.
Do not forget that you may have another port in your config and hence you will need to adjust the port of page url.

To create task type in console `curl -X POST -k https://localhost:8001/application/environment?task=<task>`. You can see the result in the web
interface. Do not forget that you will need these `application`, `environment` and `task` to be present in your pulsar configuration.

There are also the ssl keys that let you browse web interface without notifications of untrusted connection. If you want to do this then:

 * modify your `/etc/hosts` file by adding `127.0.0.1 api.pulsar.local`.
 * install ssl keys onto your OS.

After that you can use `https://api.pulsar.local:8001/` instead of `https://localhost:8001/` without notifications of improper ssl.

## API documentation

`:app` - application name (e.g. foobar)

`:env` - environment name (e.g. production)

`:action` - pulsar action/task

`:id` - task ID

### Get tasks list

#### Request:
`GET /tasks`

#### Response on success:
HTTP response code `200`
```json
{
  "url": "http://api.pulsar.local:8001/pulsar/index.html",
  "tasks": {
    "task-id-1" : "{Object}",
    "task-id-n" : "{Object}"
  }
}
```

#### Response on timeout:
No new task created before the timeout
HTTP response code `200`
```json
{
  "changed": false
}
```


### Create Task

#### Request:
```
POST /:app/:env?task=:task
```

Optionally use the blocking behaviour:
```
POST /:app/:env?action=:action&wait=true
```

#### Response on success:
HTTP response code `200`
```json
{
  "id": "123",
  "url": "https://api.pulsar.local:8001/web/task/532c3240f8214f0000177376"
}
```

In case of a blocking execution the task's data will be returned:
```json
{
  "id": 123,
  "url": "https://api.pulsar.local:8001/web/task/532c3240f8214f0000177376",
  "data": {
    "id": 123,
    "status": "failed",
    "app": "fuboo",
    "env": "production",
    "action": "shell",
    "exitCode": null,
    "output": "Here comes the output",
    "pid": 48691
  }
}
```

### Get task data

Immediately returns all task data including output to date.

#### Request:
`GET /task/:id`

#### Response on success:
HTTP response code `200`
```json
{
  "id": 123,
  "status": "failed",
  "app": "fuboo",
  "env": "production",
  "action": "shell",
  "exitCode": null,
  "output": "Here comes the output",
  "pid": 48691
}
```

### Kill task

#### Request
`GET /task/:id/kill`

#### Response
HTTP response code `200`
