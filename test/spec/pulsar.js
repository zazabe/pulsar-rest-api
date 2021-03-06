require('../../lib/errors');
var _ = require('underscore');
var async = require('async');
var Pulsar = require('../../lib/pulsar/index');
var PulsarJob = require('../../lib/pulsar/job');
var PulsarDb = require('../../lib/pulsar/db');
var assert = require('chai').assert;
var jobArgs = require('../data/jobArgs');
var Config = require('../../lib/config');

/**
 * This test suite must be the last to execute as it performs process.exit.
 */
describe('tests of pulsar API', function() {

  this.timeout(2000);

  var testConfig = new Config('./test/data/configs/config.yaml').asHash();
  require('../../lib/logger').configure(testConfig);

  beforeEach(function(done) {
    var self = this;

    new PulsarDb(testConfig.mongodb, function(err, db) {
      if (err) {
        done(err);
        return;
      }
      self.pulsarDb = db;
      //remove all items from collection that might remain from previous tests.
      db.collection.remove(function(err) {
        self.pulsar = new Pulsar(db, testConfig.pulsar);
        process.setMaxListeners(15);
        done(err);
      });
    });
  });

  after(function(done) {
    this.pulsarDb.collection.remove(done);
  });

  it('check if taskVariables are validated', function() {
    var app = jobArgs.app.example;
    var env = jobArgs.env.production;
    var task = jobArgs.task.dummySleepy;

    function callback(err, job) {
    }

    var self = this;
    assert.throw(function() {
      self.pulsar.createJob(app, env, task, [], callback);
    }, ValidationError);
    assert.throw(function() {
      self.pulsar.createJob(app, env, task, {key: []}, callback);
    }, ValidationError);
    assert.throw(function() {
      self.pulsar.createJob(app, env, task, {key: {}}, callback);
    }, ValidationError);
    assert.throw(function() {
      self.pulsar.createJob(app, env, task, {'key df': ''}, callback);
    }, ValidationError);
    assert.throw(function() {
      self.pulsar.createJob(app, env, task, {'ke"ydf': ''}, callback);
    }, ValidationError);
    assert.throw(function() {
      self.pulsar.createJob(app, env, task, {'keydf\'': ''}, callback);
    }, ValidationError);

    _.each(Pulsar.ILLEGAL_TASKS, function(task) {
      assert.throw(function() {
        self.pulsar.createJob(app, env, task, {'key': ''}, callback);
      }, ValidationError);
    });

  });

  it('check if job is created', function(done) {
    this.pulsar.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err && job.status == PulsarJob.STATUS.CREATED);
        done();
      });
  });

  it('tests a normal job\'s lifecycle', function(done) {
    this.timeout(12000);
    var self = this;
    this.pulsar.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err && job.status == PulsarJob.STATUS.CREATED);
        var hadRun = false;
        job.on('change', function() {
          hadRun = job.status == PulsarJob.STATUS.RUNNING;
        });
        job.on('close', function() {
          assert(hadRun);
          self.pulsar.getJob(job.id, function(err, job) {
            assert(!err && job.status == PulsarJob.STATUS.FINISHED);
            done();
          });
        });
        job.execute();
      });
  });

  it('check if job can be got after it is created', function(done) {
    this.pulsar.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err);
        this.pulsar.getJob(job.id, function(err, result) {
          assert.deepEqual(result.getData(), job.getData());
          done();
        });
      }.bind(this));
  });

  it('check if created job in the list of current jobs of pulsar', function(done) {
    this.pulsar.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err);
        this.pulsar.getJobList(function(err, jobList) {
          assert(jobList.length === 1);
          assert.deepEqual(job.getData(), jobList[0].getData());
          assert.deepEqual(job.getArgs(), jobList[0].getArgs());
          done();
        });
      }.bind(this));
  });

  it('check if created job returns available tasks', function(done) {
    this.pulsar.getAvailableTasks(jobArgs.app.example, jobArgs.env.production, function(err, tasks) {
      assert(!err);
      assert(tasks['shell'], 'Shell task must be always present in available tasks');
      _.each(jobArgs.task, function(taskName) {
        assert(taskName in tasks, 'Test tasks must be present in available tasks');
      });
      done();
    });
  });

  it('check if created job can be killed with SIG TERM signal', function(done) {
    this.pulsar.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        assert(!err);
        job.execute();
        job.once('change', function() {
          job.kill();
        });
        job.on('close', function() {
          assert(job.status == PulsarJob.STATUS.KILLED, 'The job kill (SIGTERM) does not work');
          done();
        });
      });
  });

  it('check if created job can be killed with SIG KILL signal', function(done) {
    //only for the sake of the test
    PulsarJob._KILL_TIMEOUT = 200;
    this.pulsar.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummyUnKillable,
      function(err, job) {
        assert(!err);
        job.once('change', function() {
          assert(job.status == PulsarJob.STATUS.RUNNING, 'Job status must be ' + PulsarJob.STATUS.RUNNING + ', current: ' + job.status);

          setTimeout(function() {
            assert(job.status == PulsarJob.STATUS.KILLED, 'The job kill (SIGKILL) does not work, current status: ' + job.status);
            done();
          }, PulsarJob._KILL_TIMEOUT + 50);

          job.kill();
          assert(job.status == PulsarJob.STATUS.KILLING, 'Job status must be ' + PulsarJob.STATUS.KILLING + ', current: ' + job.status);
        });
        job.execute();
      });
  });

  it('check if created job can be restarted after it\'s killed', function(done) {
    this.timeout(12000);
    //only for the sake of the test
    PulsarJob._KILL_TIMEOUT = 200;
    var self = this;
    this.pulsar.createJob(
      jobArgs.app.example,
      jobArgs.env.production,
      jobArgs.task.dummySleepy,
      function(err, job) {
        job.execute();
        job.once('close', function() {
          self.pulsar.restartJob(job, function(err, job) {
            assert(!err && PulsarJob.STATUS.RUNNING == job.status);
            job.once('close', function() {
              assert(PulsarJob.STATUS.FINISHED == job.status);
              done();
            });
          });
        });
        job.kill();
      });
  });

  it('check if the current jobs are shutdowned when the api process is killed', function(done) {
    this.timeout(12000);
    var self = this;
    async.map([null, null], function(dummy, callback) {
      self.pulsar.createJob(
        jobArgs.app.example,
        jobArgs.env.production,
        jobArgs.task.dummySleepy,
        function(err, job) {
          assert(!err);
          job.execute();
          job.once('change', function() {
            assert(job.status == PulsarJob.STATUS.RUNNING, 'Job should be running');
            callback(null, job);
          });
        });
    }, function(err, jobs) {
      assert(jobs && jobs.length === 2);
      process.on('exit', function() {
        _.each(jobs, function(job) {
          assert(job.status == PulsarJob.STATUS.FINISHED, 'Job should be finished');
        });
        //because `_shutdown` kills the process, we need to clean after the test manually.
        self.pulsarDb.collection.remove(done);
      });
      self.pulsar._shutdown('SIGINT');
    });
  });

});
