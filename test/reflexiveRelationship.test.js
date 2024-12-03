'use strict'

/* global describe, beforeEach, it */

const request = require('supertest')
const loopback = require('loopback')
const expect = require('chai').expect
const JSONAPIComponent = require('../')

let app, Folder

describe('reflexive relationship', function () {
  beforeEach(function (done) {
    app = loopback()
    app.set('legacyExplorer', false)
    const ds = loopback.createDataSource('memory')
    // create models
    Folder = ds.createModel('folder', {
      id: { type: Number, id: true },
      name: String
    })

    Folder.hasMany(Folder, { as: 'children', foreignKey: 'parentId' })
    Folder.belongsTo(Folder, { as: 'parent', foreignKey: 'parentId' })
    // add models
    app.model(Folder)

    // make data
    Folder.create(
      [
        { name: 'Folder 1', parentId: 0 },
        { name: 'Folder 2', parentId: 1 },
        { name: 'Folder 3', parentId: 1 },
        { name: 'Folder 4', parentId: 3 }
      ],
      function (err, foders) {
        if (err) console.error(err)
        done()
      }
    )

    app.use(loopback.rest())
    JSONAPIComponent(app, { restApiRoot: '' })
  })

  it('should make initial data', function (done) {
    request(app).get('/folders').end(function (err, res) {
      expect(err).to.equal(null)
      expect(res.body.data.length).to.equal(4)
      done(err)
    })
  })

  it('should have children', function (done) {
    request(app).get('/folders/1/children').end(function (err, res) {
      expect(err).to.equal(null)
      expect(res.body.data.length).to.equal(2)
      expect(res.body.data[0].relationships.children.data).to.equal(undefined)
      expect(res.body.data[1].relationships.children.data).to.equal(undefined)
      done(err)
    })
  })
})
