var
  inquirer = require("inquirer"),
  chalk = require('chalk'),
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
      if(tagId == 'domain') {
        return true;
      }
    }
    return false;
  };
  Task.prototype.loadGenJS = function(data) {
    this.genJS = new GenJS(data.Genjsfile);
    this.genJS.load();
  };
  Task.prototype.showModel = function() {
    console.log('=> Model:');
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
    console.log(chalk.red.bold(entity.id),':');
    console.log('  fields:');
    var hasAttribute = false;
    for(var attributeId in entity.attributes) {
      hasAttribute = true;
      var attribute = entity.attributes[attributeId];
      console.log(chalk.blue('    '+attribute.id),':',chalk.magenta(attribute.type));
    }
    if(!hasAttribute) {
      console.log('    < no field >');
    }
    console.log('  relationships:');
    var hasLink = false;
    for(var linkId in entity.links) {
      hasLink = true;
      var link = entity.links[linkId];
      if(link.type == 'one-to-one') {
        var linkType = '1 - 1';
      }
      if(link.type == 'one-to-many') {
        var linkType = '1 - *';
      }
      if(link.type == 'many-to-one') {
        var linkType = '* - 1';
      }
      if(link.type == 'many-to-many') {
        var linkType = '* - *';
      }
      console.log(chalk.blue('    '+link.id),':',entity.id,':',linkType,':',chalk.magenta(link.target),'('+link.type+')');
    }
    if(!hasLink) {
      console.log('    < no relationship >');
    }
  };
  Task.prototype.cleanEntity = function(entity) {
    var entityClean = {};
    for(var eltId in entity) {
      if(eltId != 'id' && eltId != 'fields' && eltId != 'attributes' && eltId != 'links') {
        entityClean[eltId] = entity[eltId];
      }
    }
    if(entity.attributes != null) {
      entityClean.attributes = {};
      for (var attributeId in entity.attributes) {
        var attribute = entity.attributes[attributeId];
        var attributeClean = {};
        entityClean.attributes[attributeId] = attributeClean;
        for(var eltId in attribute) {
          if(eltId != 'id') {
            attributeClean[eltId] = attribute[eltId];
          }
        }
      }
    }
    if(entity.links != null) {
      entityClean.links = {};
      for (var linkId in entity.links) {
        var link = entity.links[linkId];
        var linkClean = {};
        entityClean.links[linkId] = linkClean;
        for(var eltId in link) {
          if(eltId != 'id') {
            linkClean[eltId] = link[eltId];
          }
        }
      }
    }
    return entityClean;
  };
  Task.prototype.writeEntity = function(entity) {
    var entityToSave = this.cleanEntity(entity);
    var modelDir = this.genJS.modelDirs[0];
    mkdirp.sync(path.join(modelDir,'@domain'));
    gfile.writeYaml(path.join(modelDir,'@domain',entity.id+'.yml'), entityToSave);
  };
  Task.prototype.deleteEntity = function(entity) {
    var modelDir = this.genJS.modelDirs[0];
    fs.unlinkSync(path.join(modelDir,'@domain',entity.id+'.yml'));
  };
  Task.prototype.doMain = function(data, callback) {
    this.loadGenJS(data);
    this.showModel();
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
          name: answers.entityName
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
          if(attribute == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doEditAttribute(attribute, entity, data, function () {
              this.doEditEntity(entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      if(answers.action == 'removeAttribute') {
        this.doSelectAttribute(entity, data, function(attribute) {
          if(attribute == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doRemoveAttribute(attribute, entity, data, function () {
              this.doEditEntity(entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      if(answers.action == 'addRelationship') {
        this.doAddRelationship(entity, data, function() {
          this.doEditEntity(entity, data, callback);
        }.bind(this));
      }
      if(answers.action == 'editRelationship') {
        this.doSelectRelationship(entity, data, function(link) {
          if(link == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doEditRelationship(link, entity, data, function () {
              this.doEditEntity(entity, data, callback);
            }.bind(this))
          }
        }.bind(this));
      }
      if(answers.action == 'removeRelationship') {
        this.doSelectRelationship(entity, data, function(link) {
          if(link == null) {
            this.doEditEntity(entity, data, callback);
          } else {
            this.doRemoveRelationship(link, entity, data, function () {
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
  Task.prototype.doSelectAttribute = function(entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
    var attributesChoices = [];
    for (var attributeId in entity.attributes) {
      var attribute = entity.attributes[attributeId];
      attributesChoices.push({
        value: attribute,
        name: attribute.name,
        checked: false
      });
    }
    attributesChoices.push(new inquirer.Separator());
    attributesChoices.push({
      name: 'Exit',
      value: null
    });
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
    if(entity == null) {
      callback();
      return;
    }
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
        default: 'string',
        when: function(answers) {
          return answers.name != '';
        }
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '') {
        callback(null);
      } else {
        var attribute = {
          id: answers.name,
          name: answers.name,
          type: answers.type
        };
        entity.attributes[answers.name] = attribute;
        this.writeEntity(entity);
        callback(attribute);
      }
    }.bind(this));
  };
  Task.prototype.doEditAttribute = function(attribute, entity, data, callback) {
    if(entity == null) {
      callback();
      return;
    }
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
        default: attribute.type,
        when: function(answers) {
          return answers.name != '';
        }
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '') {
        callback(null);
      } else {
        delete entity.attributes[oldAttributeId];
        entity.attributes[answers.name] = attribute;
        attribute.id = answers.name;
        attribute.name = answers.name;
        attribute.type = answers.type;
        this.writeEntity(entity);
        callback();
      }
    }.bind(this));
  };
  Task.prototype.doRemoveAttribute = function(attribute, entity, data, callback) {
    if(attribute == null) {
      callback();
      return;
    }
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
    if(entity == null) {
      callback();
      return;
    }
    var relationshipsChoices = [];
    for (var linkId in entity.links) {
      var link = entity.links[linkId];
      relationshipsChoices.push({
        value: link,
        name: link.name,
        checked: false
      });
    }
    relationshipsChoices.push(new inquirer.Separator());
    relationshipsChoices.push({
      name: 'Exit',
      value: null
    });
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
    if(entity == null) {
      callback();
      return;
    }
    var questions = [
      {
        type: 'list',
        name: 'targetEntityId',
        message: 'Target entity',
        choices: this.getEntitiesChoices()
      },
      {
        type: 'input',
        name: 'name',
        message: 'Relationship name',
        default: function(answers) {
          return answers.targetEntityId
        },
        when: function(answers) {
          return answers.targetEntityId != null;
        }
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
        default: 'many-to-one',
        when: function(answers) {
          return answers.targetEntityId != null && answers.name != '';
        }
      }
    ];
    inquirer.prompt(questions, function( answers ) {
      if(answers.name == '' || answers.targetEntityId == null) {
        callback(null);
      } else {
        entity.links[answers.name] = {
          id: answers.name,
          name: answers.name,
          type: answers.type,
          target: answers.targetEntityId
        };
        this.writeEntity(entity);
        callback();
      }
    }.bind(this));
  };
  Task.prototype.doEditRelationship = function(link, entity, data, callback) {
    if(link == null) {
      callback();
      return;
    }
    var oldLinkId = link.id;
    var questions = [
      {
        type: 'list',
        name: 'targetEntityId',
        message: 'Target entity',
        choices: this.getEntitiesChoices(),
        default: link.target
      },
      {
        type: 'input',
        name: 'name',
        message: 'Relationship name',
        default: link.name
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
      if(answers.name == '' || answers.targetEntityId == null) {
        callback(null);
      } else {
        delete entity.links[oldLinkId];
        entity.links[answers.name] = link;
        link.id = answers.name;
        link.name = answers.name;
        link.type = answers.type;
        link.target = answers.targetEntityId;
        this.writeEntity(entity);
        callback();
      }
    }.bind(this));
  };
  Task.prototype.getEntitiesChoices = function() {
    var entities = this.getEntities();
    var entitiesChoices = [];
    for(var entityId in entities) {
      var entity = entities[entityId];
      entitiesChoices.push({
        name: entity.name,
        value: entity.id
      });
    }
    entitiesChoices.push(new inquirer.Separator());
    entitiesChoices.push({
      name: 'Exit',
      value: null
    });
    return entitiesChoices;
  };
  Task.prototype.doRemoveRelationship = function(link, entity, data, callback) {
    if(link == null) {
      callback();
      return;
    }
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