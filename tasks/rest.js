var
  inquirer = require("inquirer"),
  chalk = require('chalk'),
  Q = require('q'),
  fs = require('fs'),
  path = require('path'),
  gfile = require('gfilesync'),
  mkdirp = require('mkdirp'),
  yaml = require('js-yaml'),
  GenJS = require('genjs');

var Task = (function() {
  function Task() {
  }
  Task.prototype.do = function(data, callback) {
    this.doMain(data, callback);
  };
  Task.prototype.getEntities = function() {
    var entities = {};
    for(var entityId in this.genJS.entities) {
      var entity = this.genJS.entities[entityId];
      if(this.hasTagDomain(entity)) {
        entities[entityId] = entity;
      }
    }
    return entities;
  };
  Task.prototype.hasTagDomain = function(entity) {
    for(var tagId in entity.tags) {
      if(tagId == 'rest') {
        if(entity.tags != null && entity.tags.rest != null && entity.tags.rest.paths != null) {
          return true;
        }
      }
    }
    return false;
  };
  Task.prototype.loadGenJS = function(data) {
    this.genJS = new GenJS(data.Genjsfile);
    this.genJS.load();
  };
  Task.prototype.showAPI = function() {
    console.log('=> API:');
    var entities = this.getEntities();
    for(var entityId in entities) {
      var entity = entities[entityId];
      this.showOneEntity(entity);
    }
    console.log('');
  };
  Task.prototype.showEntity = function(entity) {
    this.showOneEntity(entity);
    console.log('');
  };
  Task.prototype.showOneEntity = function(entity) {
    console.log('');
    console.log(chalk.red.bold(entity.id));
    var hasPath = false;
    for(var pathId in entity.tags.rest.paths) {
      hasPath = true;
      var path = entity.tags.rest.paths[pathId];
      console.log(chalk.blue('  '+pathId));
      
      for(var methodId in path.methods) {
        var method = path.methods[methodId];
        console.log(chalk.blue('    '+methodId));
        if(method.name != null) {
          console.log('      name', ':', chalk.magenta(method.name));
        }
        if(method.params != null) {
          console.log('      params', ':');
          for(var paramId in method.params) {
            var param = method.params[paramId];
            console.log(chalk.blue('        '+paramId),':',chalk.magenta(param.type));
          }
        }
        if(method.return != null) {
          console.log('      return', ':', chalk.magenta(method.return));
        }
      }
    }
    if(!hasPath) {
      console.log('  < no path >');
    }

  };
  Task.prototype.cleanEntity = function(entity) {
    var entityClean = {};
    for(var eltId in entity) {
      if(eltId != 'id' && eltId != 'fields' && eltId != 'paths' && eltId != 'links') {
        entityClean[eltId] = entity[eltId];
      }
    }
    if(entity.tags.rest.paths != null) {
      entityClean.paths = {};
      for (var pathId in entity.tags.rest.paths) {
        var path = entity.tags.rest.paths[pathId];
        var pathClean = {};
        entityClean.tags.rest.paths[pathId] = pathClean;
        for(var eltId in path) {
          if(eltId != 'id' && eltId != 'methods') {
            pathClean[eltId] = path[eltId];
          }
          if(path.methods != null) {
            var methods = path.methods;
            pathClean.methods = {};
            for(var methodId in path.methods) {
              var method = path.methods[methodId];
              var methodClean = {};
              pathClean.methods[methodId] = methodClean;
              for(var eltMethod in method) {
                if(eltMethod != 'id') {
                  methodClean[eltMethod] = method[eltMethod];
                }
              }
            }
          }
        }
      }
    }
    return entityClean;
  };
  Task.prototype.writeEntity = function(entity) {
    var entityToSave = this.cleanEntity(entity);
    var modelDir = this.genJS.modelDirs[0];
    mkdirp.sync(path.join(modelDir,'@rest'));
    gfile.writeYaml(path.join(modelDir,'@rest',entity.id+'.yml'), entityToSave);
  };
  Task.prototype.deleteEntity = function(entity) {
    var modelDir = this.genJS.modelDirs[0];
    fs.unlinkSync(path.join(modelDir,'@rest',entity.id+'.yml'));
  };
  Task.prototype.doMain = function(data, callback) {
    this.loadGenJS(data);
    this.showAPI();
    var choices = [];
    var entities = this.getEntities();
    if(entities != null && Object.keys(entities).length > 0) {
      choices.push({
        name: 'Edit entity',
        value: 'modify'
      });
    }
    choices.push({
      name: 'New entity',
        value: 'new'
    });
    if(entities != null && Object.keys(entities).length > 0) {
      choices.push({
        name: 'Remove entity',
        value: 'remove'
      });
    }
    choices.push(new inquirer.Separator());
    choices.push({
      name: 'Exit',
        value: ''
    });
    var questions = [
      {
        type: 'list',
        name: 'action',
        message: 'Action',
        choices: choices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.action == 'new') {
        this.doAddEntity(data, function (entity) {
          if(entity == null) {
            this.doMain(data, callback);
          } else {
            this.doEditEntity(entity, data, function () {
              this.doMain(data, callback);
            }.bind(this));
          }
        }.bind(this));
      }
      if(answers.action == 'modify') {
        this.doSelectEntity(data, function (entity) {
          if(entity == null) {
            this.doMain(data, callback);
          } else {
            this.doEditEntity(entity, data, function () {
              this.doMain(data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      if(answers.action == 'remove') {
        this.doSelectEntity(data, function (entity) {
          if(entity == null) {
            this.doMain(data, callback);
          } else {
            this.doRemoveEntity(entity, data, function () {
              this.doMain(data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      if(callback) {
        callback();
      }
    }.bind(this));
  };
  Task.prototype.doAddEntity = function(data, callback) {
    var questions = [
      {
        type: 'input',
        name: 'entityName',
        message: 'Entity name'
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      console.log(answers.entityName);
      if(answers.entityName == null || answers.entityName == '') {
        callback(null);
      } else {
        var entity = {
          id: answers.entityName,
          name: answers.entityName,
          tags: {
            rest: {
              paths: {

              }
            }
          }
        };
        this.writeEntity(entity);
        this.loadGenJS(data);
        callback(entity);
      }
    }.bind(this));
  };
  Task.prototype.doSelectEntity = function(data, callback) {
    var entitiesChoices = [];
    var entities = this.getEntities();
    for (var entityId in entities) {
      var entity = entities[entityId];
      entitiesChoices.push({
        value: entity,
        name: entity.name,
        checked: false
      });
    }
    entitiesChoices.push(new inquirer.Separator());
    entitiesChoices.push({
      name: 'Exit',
      value: null
    });
    var questions = [
      {
        type: 'list',
        name: 'entity',
        message: 'Entity',
        choices: entitiesChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      callback(answers.entity);
    }.bind(this));
  };
  Task.prototype.doRemoveEntity = function(entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    var questions = [
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirm remove entity: '+entity.id,
        default: true
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.confirm) {
        this.deleteEntity(entity);
      }
      callback();
    }.bind(this));
  };
  Task.prototype.doEditEntity = function(entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    this.loadGenJS(data);
    var entities = this.getEntities();
    entity = entities[entity.id];
    this.showEntity(entity);
    var choices = [];
    choices.push({
      name: 'Add path',
      value: 'addPath'
    });
    if(entity.tags.rest.paths != null && Object.keys(entity.tags.rest.paths).length > 0) {
      choices.push({
        name: 'Edit path',
        value: 'editPath'
      });
      choices.push({
        name: 'Remove path',
        value: 'removePath'
      });
    }
    choices.push(new inquirer.Separator());
    choices.push({
      name: 'Exit',
      value: ''
    });

    var questions = [
      {
        type: 'list',
        name: 'action',
        message: 'Action on the entity : '+entity.id,
        choices: choices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.action == 'addPath') {
        this.doAddPath(entity, data, function() {
          this.doEditEntity(entity, data, callback);
        }.bind(this));
      }
      if(answers.action == 'editPath') {
        this.doSelectPath(entity, data, function(path) {
          if(path == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doEditPath(path, entity, data, function () {
              this.doEditEntity(entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      if(answers.action == 'removePath') {
        this.doSelectPath(entity, data, function(path) {
          if(path == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doRemovePath(path, entity, data, function () {
              this.doEditEntity(entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      if(answers.action == '') {
        if(callback) {
          callback();
        }
      }
    }.bind(this));
  };
  Task.prototype.doSelectPath = function(entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    var pathsChoices = [];
    for (var pathId in entity.tags.rest.paths) {
      var path = entity.tags.rest.paths[pathId];
      path.id = pathId;
      pathsChoices.push({
        value: path,
        name: pathId,
        checked: false
      });
    }
    pathsChoices.push(new inquirer.Separator());
    pathsChoices.push({
      name: 'Exit',
      value: null
    });
    var questions = [
      {
        type: 'list',
        name: 'path',
        message: 'Path',
        choices: pathsChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      callback(answers.path);
    }.bind(this));
  };
  Task.prototype.doAddPath = function(entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    var questions = [
      {
        type: 'input',
        name: 'id',
        message: 'Path name'
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '') {
        callback(null);
      } else {
        var path = {
          id: answers.id
        };
        entity.tags.rest.paths[answers.id] = path;
        this.writeEntity(entity);
        callback(path);
      }
    }.bind(this));
  };
  /*
  Task.prototype.doEditPath = function(path, entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    var oldPathId = path.id;
    var questions = [
      {
        type: 'input',
        name: 'id',
        message: 'Path',
        default: path.id
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '') {
        callback(null);
      } else {
        delete entity.tags.rest.paths[oldPathId];
        entity.tags.rest.paths[answers.id] = path;
        path.id = answers.id;
        this.writeEntity(entity);
        callback();
      }
    }.bind(this));
  };
  */
  Task.prototype.doRemovePath = function(path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    var questions = [
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirm remove path: '+entity.id+'.'+path.id,
        default: true
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.confirm) {
        delete entity.tags.rest.paths[path.id];
        this.writeEntity(entity);
      }
      callback();
    }.bind(this));
  };
  Task.prototype.doEditPath = function(path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    this.loadGenJS(data);
    var entities = this.getEntities();
    entity = entities[entity.id];
    var pathId = path.id;
    path = entity.tags.rest.paths[path.id];
    path.id = pathId;
    this.showEntity(entity);
    var choices = [];
    choices.push({
      name: 'Add method',
      value: 'addMethod'
    });
    if(path.methods != null && Object.keys(path.methods).length > 0) {
      choices.push({
        name: 'Edit method',
        value: 'editMethod'
      });
      choices.push({
        name: 'Remove method',
        value: 'removeMethod'
      });
    }
    choices.push(new inquirer.Separator());
    choices.push({
      name: 'Exit',
      value: ''
    });

    var questions = [
      {
        type: 'list',
        name: 'action',
        message: 'Action on the path : '+path.id,
        choices: choices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.action == 'addMethod') {
        this.doAddMethod(path, entity, data, function() {
          this.doEditPath(path, entity, data, callback);
        }.bind(this));
      }
      if(answers.action == 'editMethod') {
        this.doSelectMethod(path, entity, data, function(method) {
          if(method == null) {
            this.doEditPath(path, entity, data, callback);
          } else {
            this.doEditMethod(method, path, entity, data, function () {
              this.doEditPath(path, entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      if(answers.action == 'removeMethod') {
        this.doSelectMethod(path, entity, data, function(method) {
          if(method == null) {
            this.doEditPath(path, entity, data, callback);
          } else {
            this.doRemoveMethod(method, path, entity, data, function () {
              this.doEditPath(path, entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      if(answers.action == '') {
        if(callback) {
          callback();
        }
      }
    }.bind(this));
  };
  Task.prototype.doSelectMethod = function(path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    var methodsChoices = [];
    for (var methodId in path.methods) {
      var method = path.methods[methodId];
      method.id = methodId;
      methodsChoices.push({
        value: method,
        name: methodId,
        checked: false
      });
    }
    methodsChoices.push(new inquirer.Separator());
    methodsChoices.push({
      name: 'Exit',
      value: null
    });
    var questions = [
      {
        type: 'list',
        name: 'method',
        message: 'Method',
        choices: methodsChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      callback(answers.method);
    }.bind(this));
  };
  Task.prototype.doAddMethod = function(path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    var methodChoices = [];
    var methods = {
      'GET': true,
      'POST': true,
      'PUT': true,
      'DELETE': true,
      'PATCH': true,
      'OPTIONS': true
    };
    for(var method in path.methods) {
      methods[method] = false;
    }
    for(var method in methods) {
      if(methods[method]) {
        methodChoices.push({
          name: method,
          value: method
        });
      }
    }
    var questions = [
      {
        type: 'list',
        name: 'id',
        message: 'Method HTTP',
        choices: methodChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '') {
        callback(null);
      } else {
        var method = {
          id: answers.id
        };
        if(path.methods == null) {
          path.methods = {};
        }
        path.methods[answers.id] = method;
        this.writeEntity(entity);
        callback(method);
      }
    }.bind(this));
  };
  Task.prototype.doEditMethod = function(method, path, entity, data, callback) {
    if(path == null) {
      callback();
      return;
    }
    var oldMethodId = method.id;
    var questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Method name',
        default: function() {
          if(method.name != null) {
            return method.name;
          }
          var pathName = path.id;
          while(pathName.indexOf('/') != -1) {
            var pos = pathName.indexOf('/');
            pathName = pathName.substring(0,pos) + pathName.charAt(pos+1).toUpperCase() + pathName.substring(pos+2);
          }
          if(pathName.lastIndexOf('s') == pathName.length-1) {
            if(method.id == 'GET') {
              return 'getAll'+pathName;
            }
          } else {
            if(method.id == 'GET') {
              return 'getOne'+pathName;
            }
          }
        }
      },
      {
        type: 'input',
        name: 'return',
        message: 'Method return',
        default: function() {
          if(method.return != null) {
            return method.return;
          } else {
            var pathName = path.id;
            var pos = pathName.lastIndexOf('/');
            pathName = pathName.charAt(pos+1).toUpperCase() + pathName.substring(pos+2);
            if(path.id.lastIndexOf('s') == path.id.length-1) {
              pathName = pathName.substring(0,pathName.length-1);
              if(method.id == 'GET') {
                return 'List<'+pathName+'>';
              }
            } else {
              if(method.id == 'GET') {
                return pathName;
              }
            }
          }
        }
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '') {
        callback(null);
      } else {
        method.name = answers.name;

        var paramInquirer = (function paramInquirer(method) {
          var questions = [
            {
              type: 'input',
              name: 'paramName',
              message: 'Parameter name'
            },
            {
              type: 'input',
              name: 'paramType',
              message: 'Parameter type',
              when: function(answers) {
                return answers.paramName != '';
              }
            }
          ];
          var deferred = Q.defer();
          inquirer.prompt(questions, function (answers) {
            if (answers.paramName != '') {
              if(method.params == null) {
                method.params = {};
              }
              method.params[answers.paramName] = {
                type: answers.paramType
              };
              paramInquirer(method)
                .then(function() {
                  deferred.resolve();
                });
            } else {
              deferred.resolve();
            }
          });
          return deferred.promise;
        });
        paramInquirer(method)
          .then(function() {
            method.return = answers.return;
            this.writeEntity(entity);
            callback();
          }.bind(this));
      }
    }.bind(this));
  };
  Task.prototype.doRemoveMethod = function(method, path, entity, data, callback) {
    if(method == null) {
      callback();
      return;
    }
    var questions = [
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirm remove method: '+path.id+'.'+method.id,
        default: true
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.confirm) {
        delete path.methods[method.id];
        this.writeEntity(entity);
      }
      callback();
    }.bind(this));
  };
  return Task;
})();

module.exports = new Task();