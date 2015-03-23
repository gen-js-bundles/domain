var
  inquirer = require("inquirer"),
  fs = require('fs'),
  path = require('path'),
  gfile = require('gfilesync'),
  yaml = require('js-yaml'),
  GenJSHelper = require('../helpers/genjshelper'),
  GenJS = require('genjs');

var Task = (function() {
  function Task() {
  }
  Task.prototype.do = function(data, callback) {
    this.doMain(data, callback);
  };
  Task.prototype.loadGenJS = function(data) {
    this.genJSHelper = new GenJSHelper();
    this.genJS = this.genJSHelper.loadGenJS(data.Genjsfile);
  };
  Task.prototype.writeEntity = function(entity) {
    var modelDir = this.genJS.modelDirs[0];
    gfile.writeYaml(path.join(modelDir,'@domain',entity.id+'.yml'), entity);
  };
  Task.prototype.deleteEntity = function(entity) {
    var modelDir = this.genJS.modelDirs[0];
    fs.unlinkSync(path.join(modelDir,'@domain',entity.id+'.yml'));
  };
  Task.prototype.doMain = function(data, callback) {
    this.loadGenJS(data);
    var choices = [];
    if(this.genJS.entities != null && Object.keys(this.genJS.entities).length > 0) {
      choices.push({
        name: 'Edit entity',
        value: 'modify'
      });
    }
    choices.push({
      name: 'New entity',
        value: 'new'
    });
    if(this.genJS.entities != null && Object.keys(this.genJS.entities).length > 0) {
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
          this.doEditEntity(enity, data, function () {
            this.doMain(data, callback);
          }.bind(this));
        }.bind(this));
      }
      if(answers.action == 'modify') {
        this.doSelectEntity(data, function (entity) {
          this.doEditEntity(entity, data, function () {
            this.doMain(data, callback);
          }.bind(this))
        }.bind(this));
      }
      if(answers.action == 'remove') {
        this.doSelectEntity(data, function (entity) {
          this.doRemoveEntity(entity, data, function () {
            this.doMain(data, callback);
          }.bind(this))
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
      var entity = {
        id: answers.entityName,
        name: answers.entityName
      };
      this.writeEntity(entity);
      this.loadGenJS(data);
      callback(entity);
    }.bind(this));
  };
  Task.prototype.doSelectEntity = function(data, callback) {
    var entitiesChoices = [];
    for (var entityId in this.genJS.entities) {
      var entity = this.genJS.entities[entityId];
      entitiesChoices.push({
        value: entity,
        name: entity.name,
        checked: false
      });
    }
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
    this.loadGenJS(data);
    entity = this.genJS.entities[entity.id];
    var choices = [];
    choices.push({
      name: 'Add attribute',
      value: 'addAttribute'
    });
    if(entity.attributes != null && Object.keys(entity.attributes).length > 0) {
      choices.push({
        name: 'Edit attribute',
        value: 'editAttribute'
      });
      choices.push({
        name: 'Remove attribute',
        value: 'removeAttribute'
      });
    }
    choices.push(new inquirer.Separator());
    choices.push({
      name: 'Add relationship',
      value: 'addRelationship'
    });
    if(entity.links != null && Object.keys(entity.links).length > 0) {
      choices.push({
        name: 'Edit relationship',
        value: 'editRelationship'
      });
      choices.push({
        name: 'Remove relationship',
        value: 'removeRelationship'
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
      if(answers.action == 'addAttribute') {
        this.doAddAttribute(entity, data, function() {
          this.doEditEntity(entity, data, callback);
        }.bind(this));
      }
      if(answers.action == 'editAttribute') {
        this.doSelectAttribute(entity, data, function(attribute) {
          this.doEditAttribute(attribute, entity, data, function() {
            this.doEditEntity(entity, data, callback);
          }.bind(this))
        }.bind(this));
      }
      if(answers.action == 'removeAttribute') {
        this.doSelectAttribute(entity, data, function(attribute) {
          this.doRemoveAttribute(attribute, entity, data, function () {
            this.doEditEntity(entity, data, callback);
          }.bind(this))
        }.bind(this));
      }
      if(answers.action == 'addRelationship') {
        this.doAddRelationship(entity, data, function() {
          this.doEditEntity(entity, data, callback);
        }.bind(this));
      }
      if(answers.action == 'editRelationship') {
        this.doSelectRelationship(entity, data, function(link) {
          this.doEditRelationship(link, entity, data, function () {
            this.doEditEntity(entity, data, callback);
          }.bind(this))
        }.bind(this));
      }
      if(answers.action == 'removeRelationship') {
        this.doSelectRelationship(entity, data, function(link) {
          this.doRemoveRelationship(link, entity, data, function () {
            this.doEditEntity(entity, data, callback);
          }.bind(this))
        }.bind(this));
      }
      if(answers.action == '') {
        if(callback) {
          callback();
        }
      }
    }.bind(this));
  };
  Task.prototype.doSelectAttribute = function(entity, data, callback) {
    var attributesChoices = [];
    for (var attributeId in entity.attributes) {
      var attribute = entity.attributes[attributeId];
      attributesChoices.push({
        value: attribute,
        name: attribute.name,
        checked: false
      });
    }
    var questions = [
      {
        type: 'list',
        name: 'attribute',
        message: 'Attribute',
        choices: attributesChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      callback(answers.attribute);
    }.bind(this));
  };
  Task.prototype.doAddAttribute = function(entity, data, callback) {
    var questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Attribute name'
      },
      {
        type: 'input',
        name: 'type',
        message: 'Attribute type',
        default: 'string'
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      entity.attributes[answers.name] = {
        id: answers.name,
        name: answers.name,
        type: answers.type
      };
      this.writeEntity(entity);
      callback();
    }.bind(this));
  };
  Task.prototype.doEditAttribute = function(attribute, entity, data, callback) {
    var oldAttributeId = attribute.id;
    var questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Attribute name',
        default: attribute.name
      },
      {
        type: 'input',
        name: 'type',
        message: 'Attribute type',
        default: attribute.type
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      delete entity.attributes[oldAttributeId];
      entity.attributes[answers.name] = attribute;
      attribute.id = answers.name;
      attribute.name = answers.name;
      attribute.type = answers.type;
      this.writeEntity(entity);
      callback();
    }.bind(this));
  };
  Task.prototype.doRemoveAttribute = function(attribute, entity, data, callback) {
    var questions = [
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirm remove attribute: '+entity.id+'.'+attribute.id,
        default: true
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.confirm) {
        delete entity.attributes[attribute.id];
        this.writeEntity(entity);
      }
      callback();
    }.bind(this));
  };
  Task.prototype.doSelectRelationship = function(entity, data, callback) {
    var relationshipsChoices = [];
    for (var linkId in entity.links) {
      var link = entity.links[linkId];
      relationshipsChoices.push({
        value: link,
        name: link.name,
        checked: false
      });
    }
    var questions = [
      {
        type: 'list',
        name: 'link',
        message: 'Relationship',
        choices: relationshipsChoices
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      callback(answers.link);
    }.bind(this));
  };
  Task.prototype.doAddRelationship = function(entity, data, callback) {
    var questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Relationship name'
      },
      {
        type: 'list',
        name: 'type',
        message: 'Relationship type',
        choices: [
          {
            name: '* - 1 : Many to One',
            value: 'many-to-one'
          },
          {
            name: '1 - * : One to Many',
            value: 'one-to-many'
          },
          {
            name: '1 - 1 : One to One',
            value: 'one-to-one'
          },
          {
            name: '* - * : Many to Many',
            value: 'many-to-many'
          }
        ],
        default: 'many-to-one'
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      entity.links[answers.name]={
        id: answers.name,
        name: answers.name,
        type: answers.type
      };
      this.writeEntity(entity);
      callback();
    }.bind(this));
  };
  Task.prototype.doEditRelationship = function(link, entity, data, callback) {
    var oldLinkId = link.id;
    var questions = [
      {
        type: 'input',
        name: 'name',
        message: 'Relationship name',
        default: link.name
      },
      {
        type: 'list',
        name: 'targetEntityId',
        message: 'Target entity',
        choices: this.getEntitiesChoices(this.genJS.entities),
        default: link.target
      },
      {
        type: 'list',
        name: 'type',
        message: 'Relationship type',
        choices: [
          {
            name: '* - 1 : Many to One',
            value: 'many-to-one'
          },
          {
            name: '1 - * : One to Many',
            value: 'one-to-many'
          },
          {
            name: '1 - 1 : One to One',
            value: 'one-to-one'
          },
          {
            name: '* - * : Many to Many',
            value: 'many-to-many'
          }
        ],
        default: link.type
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      delete entity.links[oldLinkId];
      entity.links[answers.name]=link;
      link.id = answers.name;
      link.name = answers.name;
      link.type = answers.type;
      link.target = answers.targetEntityId;
      this.writeEntity(entity);
      callback();
    }.bind(this));
  };
  Task.prototype.getEntitiesChoices = function(entities) {
    var entitiesChoices = [];
    for(var entityId in entities) {
      var entity = entities[entityId];
      entitiesChoices.push({
        name: entity.name,
        value: entity.id
      });
    }
    return entitiesChoices;
  };
  Task.prototype.doRemoveRelationship = function(link, entity, data, callback) {
    var questions = [
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Confirm remove relationship: '+entity.id+'.'+link.id,
        default: true
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.confirm) {
        delete entity.links[link.id];
        this.writeEntity(entity);
      }
      callback();
    }.bind(this));
  };
  return Task;
})();

module.exports = new Task();