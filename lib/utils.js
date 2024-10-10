'use strict'

const inflection = require('inflection')
const _ = require('lodash')

/**
 * Public API
 */
module.exports = {
  clone,
  getModelFromContext,
  getTypeFromContext,
  getRelationsFromContext,
  hostFromContext,
  modelNameFromContext,
  pluralForModel,
  httpPathForModel,
  urlFromContext,
  primaryKeyForModel,
  shouldNotApplyJsonApi,
  shouldApplyJsonApi,
  relationFkOnModelFrom,
  setRequestedIncludes,
  setIncludedRelations
}

function primaryKeyForModel (model) {
  return model.getIdName()
}

/**
 * Returns the plural for a model.
 * @public
 * @memberOf {Utils}
 * @param {Object} model
 * @return {String}
 */
function pluralForModel (model) {
  if (model.pluralModelName) {
    return model.pluralModelName
  }

  if (model.settings && model.settings.plural) {
    return model.settings.plural
  }

  if (
    model.definition &&
    model.definition.settings &&
    model.definition.settings.plural
  ) {
    return model.definition.settings.plural
  }

  return inflection.pluralize(model.sharedClass.name)
}

/**
 * Returns the plural path for a model
 * @public
 * @memberOf {Utils}
 * @param {Object} model
 * @return {String}
 */
function httpPathForModel (model) {
  if (model.settings && model.settings.http && model.settings.http.path) {
    return model.settings.http.path
  }
  return pluralForModel(model)
}

/**
 * Clones an object by stringifying it and parsing it.
 * @public
 * @memberOf {Utils}
 * @param {Object} object
 * @return {Object}
 */
function clone (object) {
  return JSON.parse(JSON.stringify(object))
}

/**
 * Returns a models name from its context.
 * @public
 * @memberOf {Utils}
 * @param {Object} context
 * @return {String}
 */
function modelNameFromContext (context) {
  return context.method.sharedClass.name
}

/**
 * Returns the fully qualified host
 * @public
 * @memberOf {Utils}
 * @param {Object} context
 * @return {String}
 */
function hostFromContext (context) {
  return context.req.protocol + '://' + context.req.get('host')
}

/**
 * Returns the fully qualified request url
 * @public
 * @memberOf {Utils}
 * @param {Object} context
 * @return {String}
 */
function urlFromContext (context) {
  return context.req.protocol +
    '://' +
    context.req.get('host') +
    context.req.originalUrl
}

/**
 * Returns a model from the app object.
 * @public
 * @memberOf {Utils}
 * @param {Object} context
 * @param {Object} app
 * @return {Object}
 */
function getModelFromContext (context, app) {
  const type = getTypeFromContext(context)
  if (app.models[type]) return app.models[type]

  const name = modelNameFromContext(context)
  return app.models[name]
}

/**
 * Returns a model type from the context object.
 * Infer the type from the `root` returns in the remote.
 * @public
 * @memberOf {Utils}
 * @param {Object} context
 * @param {Object} app
 * @return {String}
 */
function getTypeFromContext (context) {
  if (!context.method.returns) return undefined

  const returns = [].concat(context.method.returns)
  for (let i = 0, l = returns.length; i < l; i++) {
    if (typeof returns[i] !== 'object' || returns[i].root !== true) continue
    return returns[i].type
  }
}

/**
 * Gets the relations from a context.
 * @public
 * @memberOf {Utils}
 * @param {Object} context
 * @param {Object} app
 * @return {Object}
 *
 * Example
   {
     post: {
       name: 'post',
       type: 'belongsTo',
       modelFrom: [Function: ModelConstructor],
       keyFrom: 'postId',
       modelTo: [Function: ModelConstructor],
       keyTo: 'id',
       polymorphic: undefined,
       modelThrough: undefined,
       keyThrough: undefined,
       multiple: false,
       properties: {},
       options: {},
       scope: undefined,
       embed: false,
       methods: {}
     }
   }
 */
function getRelationsFromContext (context, app) {
  const model = getModelFromContext(context, app)
  return model.relations
}

function shouldApplyJsonApi (ctx, options) {
  // include on remote have higher priority
  if (ctx.method.jsonapi) return !!ctx.method.jsonapi

  const modelName = ctx.method.sharedClass.name
  const methodName = ctx.method.name
  let model
  let methods
  if (options.include) {
    for (let i = 0; i < options.include.length; i++) {
      model = options.include[i].model
      methods = options.include[i].methods
      if (model === modelName && !methods) return true
      if (!model && methods === methodName) return true
      if (model === modelName && methods === methodName) return true
      if (model === modelName && _.includes(methods, methodName)) return true
      if (!model && _.includes(methods, methodName)) return true
    }
  }

  // a default option can be set in component-config
  return !!options.handleCustomRemoteMethods
}

function shouldNotApplyJsonApi (ctx, options) {
  // exclude on remote have higher priority
  if (ctx.method.jsonapi === false) return true

  // handle options.exclude
  if (!options.exclude) return false

  const modelName = ctx.method.sharedClass.name
  const methodName = ctx.method.name
  let model
  let methods

  for (let i = 0; i < options.exclude.length; i++) {
    model = options.exclude[i].model
    methods = options.exclude[i].methods
    if (model === modelName && !methods) return true
    if (!model && methods === methodName) return true
    if (model === modelName && methods === methodName) return true
    if (model === modelName && _.includes(methods, methodName)) return true
    if (!model && _.includes(methods, methodName)) return true
  }

  return false
}

function relationFkOnModelFrom (relation) {
  return relation.type === 'belongsTo' || relation.type === 'referencesMany'
}

function setIncludedRelations (relations, app) {
  for (const key in relations) {
    if (Object.hasOwn(relations, key)) {
      const name = (relations[key].modelTo &&
        relations[key].modelTo.sharedClass.name) ||
        relations[key].name
      relations[key].relations = app.models[name] && app.models[name].relations
    }
  }
  return relations
}

function setRequestedIncludes (include) {
  if (!include) return undefined

  if (typeof include === 'string') {
    return include
  }
  if (include instanceof Array) {
    return include.map(function (inc) {
      if (typeof inc === 'string') {
        return inc
      }

      if (inc instanceof Object) {
        return inc.relation
      }
      return undefined
    })
  }
  return include
}
