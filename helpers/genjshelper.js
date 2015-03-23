var GenJS = require('genjs');

var GenJSHelper = (function() {
  function GenJSHelper() {

  }
  GenJSHelper.prototype.loadGenJS = function(Genjsfile) {
    var genJS = new GenJS(Genjsfile);
    genJS.load();
    return genJS;
  };
  GenJSHelper.prototype.getEntitiesChoices = function(genJS) {
    return entitiesChoices;
  };
  GenJSHelper.prototype.getAttributesChoices = function(entity) {

    return attributesChoices;
  };
  return GenJSHelper;
})();

module.exports = GenJSHelper;