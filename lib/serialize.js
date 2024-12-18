'use strict'

/* global module,require */
const serializer = require('./serializer')
const utils = require('./utils')
const _ = require('lodash')
const regexs = [
  /^find$/,
  /^create$/,
  /^deleteById$/,
  /^findById$/,
  /^__get__.*/,
  /^updateAttributes$/,
  /^patchAttributes$/,
  /^__findRelationships__.*/
]

module.exports = function (app, defaults) {
  defaults.debug('Register jsonapi serializer')
  app.remotes().after('**', function (ctx, next) {
    let type,
      path,
      options,
      relatedModel,
      relatedModelPlural,
      relatedModelPath,
      relations,
      model,
      requestedIncludes

    if (utils.shouldNotApplyJsonApi(ctx, defaults)) {
      return next()
    }

    const matches = regexs.filter(function (regex) {
      return regex.test(ctx.method.name)
    })

    if (!utils.shouldApplyJsonApi(ctx, defaults) && !matches.length) {
      return next()
    }

    // housekeeping, just skip verbs we definitely aren't
    // interested in handling.
    switch (ctx.req.method) {
      case 'DELETE':
      case 'PUT':
      case 'HEAD':
        return next()
    }

    defaults.debug('Response will be serialized')
    if (!ctx.res.headersSent) {
      defaults.debug('Set response Content-Type to `application/vnd.api+json`')
      ctx.res.set({
        'Content-Type': 'application/vnd.api+json'
      })
    }

    const data = utils.clone(ctx.result)
    model = utils.getModelFromContext(ctx, app)
    const modelNamePlural = utils.pluralForModel(model)
    const modelPath = utils.httpPathForModel(model)
    type = modelNamePlural
    path = modelPath
    relations = utils.getRelationsFromContext(ctx, app)

    /**
     * HACK: specifically when data is null and GET :model/:id
     * is being accessed, we should not treat null as ok. It needs
     * to be 404'd and to do that we just exit out of this
     * after remote hook and let the middleware chain continue
     */
    if (!data && ctx.method.name === 'findById') {
      return next()
    }

    let primaryKeyField = utils.primaryKeyForModel(model)
    const regexRelationFromUrl = /\/.*\/(.*$)/g
    const regexMatches = regexRelationFromUrl.exec(ctx.req.path)
    const relationName = regexMatches && regexMatches[1] ? regexMatches[1] : null

    const relation = model.relations[relationName]
    if (relationName && relation) {
      if (relation.polymorphic && utils.relationFkOnModelFrom(relation)) {
        let discriminator = relation.polymorphic.discriminator
        discriminator = utils.clone(ctx.instance)[discriminator]
        relatedModel = app.models[discriminator]
      } else {
        relatedModel = relation.modelTo
      }
      relatedModelPlural = utils.pluralForModel(relatedModel)
      relatedModelPath = utils.httpPathForModel(relatedModel)
      primaryKeyField = utils.primaryKeyForModel(relatedModel)

      if (relatedModelPlural) {
        type = relatedModelPlural
        model = relatedModel
        path = relatedModelPath
        relations = model.relations
      }
    }

    // If we're sideloading, we need to add the includes
    if (ctx.req.isSideloadingRelationships) {
      requestedIncludes = utils.setRequestedIncludes(
        ctx.req.remotingContext.args.filter.include
      )
    }

    if (model.definition.settings.scope) {
      // bring requestedIncludes in array form
      if (typeof requestedIncludes === 'undefined') {
        requestedIncludes = []
      } else if (typeof requestedIncludes === 'string') {
        requestedIncludes = [requestedIncludes]
      }

      // add include from model
      const include = model.definition.settings.scope.include

      if (typeof include === 'string') {
        requestedIncludes.push(include)
      } else if (_.isArray(include)) {
        requestedIncludes = requestedIncludes.concat(
          utils.setRequestedIncludes(include)
        )
      }
    }

    options = {
      app,
      model,
      modelPath: path,
      method: ctx.method.name,
      meta: ctx.meta ? utils.clone(ctx.meta) : null,
      primaryKeyField,
      requestedIncludes,
      host: defaults.host || utils.hostFromContext(ctx),
      dataLinks: {
        self: (item) => {
          const url = new URL([options.restApiRoot, path, item.id].join('/'), options.host)
          return url.toString()
        }
      }
    }
    options.topLevelLinks = {
      self: options.host + ctx.req.originalUrl
    }

    options = _.defaults(options, defaults)

    defaults.debug('===================')
    defaults.debug('Serialization input')
    defaults.debug('===================')
    defaults.debug('JSONAPI TYPE      |:', type)
    defaults.debug('SERIALIZER OPTS   |:', JSON.stringify(options))
    defaults.debug('RELATIONS DEFN    |:', JSON.stringify(relations))
    defaults.debug('DATA TO SERIALIZE |:', JSON.stringify(data))

    // Serialize our request
    serializer(type, data, relations, options, function (err, results) {
      if (err) return next(err)

      ctx.result = results

      defaults.debug('====================')
      defaults.debug('Serialization output')
      defaults.debug('====================')
      defaults.debug('SERIALIZED DATA    |:', JSON.stringify(results))
      next()
    })
  })
}
