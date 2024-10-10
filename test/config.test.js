'use strict'

const request = require('supertest')
const loopback = require('loopback')
const expect = require('chai').expect
const JSONAPIComponent = require('../')

let app
let Image

describe('Dont override config.js ', function () {
  beforeEach(function () {
    app = loopback()
    app.set('legacyExplorer', false)
    app.use(loopback.rest())

    const remotes = app.remotes()
    remotes.options.json = { limit: '100B' }
    const ds = loopback.createDataSource('memory')
    Image = ds.createModel('image', {
      id: { type: Number, id: true },
      source: String
    })

    app.model(Image)

    JSONAPIComponent(app)
  })

  it('should have limit property', function (done) {
    const remotes = app.remotes()
    expect(remotes.options.json).to.have.any.keys('limit')
    done()
  })

  it('should accept payload < 100B', function (done) {
    request(app)
      .post('/images')
      .send({
        data: {
          type: 'images',
          attributes: {
            source: 'a'
          }
        }
      })
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/json')
      .expect(201)
      .end(done)
  })

  it('should not accept payload > 100B', function (done) {
    request(app)
      .post('/images')
      .send({
        data: {
          type: 'images',
          attributes: {
            source: 'A long text to make the payload greater then 100B'
          }
        }
      })
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/json')
      .expect(413)
      .end(done)
  })
})
