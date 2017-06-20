const SpikeUtil = require('spike-util')
const W = require('when')
const node = require('when/node')
const Joi = require('joi')
const path = require('path')
const fs = require('fs')
const reshape = require('reshape')
const loader = require('reshape-loader')
const {SiteClient} = require('datocms-client')
const bindAllClass = require('es6bindall')
const mkdirp = require('mkdirp')

module.exports = class SpikeDatoCMS {
  constructor (opts) {
    Object.assign(this, this.validate(opts))
    this.client = new SiteClient(opts.token)
    bindAllClass(this, ['apply', 'run'])
  }

  apply (compiler) {
    this.util = new SpikeUtil(compiler.options)
    this.util.runAll(compiler, this.run)

    // set cache to full path for use in emit + run functions
    if (this.cache) {
      this.cache = path.join(compiler.options.context, this.cache)
    }

    // TODO: this pulls the incorrect loader context
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('normal-module-loader', (loaderContext) => {
        this.loaderContext = loaderContext
      })
    })

    compiler.plugin('emit', (compilation, done) => {
      if (this.json) {
        writeJson(compilation, this.json, this.addDataTo.dato)
      }

      // if cache is set and cache file doesn't exist; write it
      if (this.cache && this.rewrite) {
        writeCache(this.cache, this.addDataTo.dato)
      }

      this.models.filter((m) => m.json).map((m) => {
        return writeJson(compilation, m.json, this.addDataTo.dato[m.type])
      })

      W.map(this.models.filter((m) => m.template), (contentType) => {
        return writeTemplate.call(this, compiler, compilation, contentType)
      }).done(() => done(), done)
    })
  }

  run (compilation, done) {
    return W.all([
      fetchData.call(this),
      W.reduce(this.models, (memo, model) => {
        // format options
        const options = {}
        if (model.ids) { options['filter[ids]'] = model.ids }
        if (model.query) { options['filter[query]'] = model.query }
        if (model.offset) { options['page[offset]'] = model.offset }
        if (model.limit) { options['page[limit]'] = model.limit }
        const transformFn = model.transform ? model.transform : (x) => x

        // fetch items and itemTypes
        return W.all([
          W(this.client.items.all(options)),
          W(this.client.itemTypes.all())
        ])
          // make sure linked entries are resolved
          .then(resolveLinks)
          // filter to the model type, if necessary
          .then(([records, itemTypes]) => {
            if (!model.type) return records
            const t = itemTypes.find((it) => it.apiKey === model.type)
            return records.filter((r) => r.itemType === t.id)
          })
          // transform if necessary
          .then((res) => W.map(res, (entry) => transformFn(entry)))
          // add resolved item to the response
          .tap((res) => { memo[model.type || 'all'] = res })
          .yield(memo)
      }, {})
    ]).done(([site, models]) => {
      // add to the locals
      Object.assign(this.addDataTo, { dato: Object.assign(models, { _meta: site }) })
      done()
    }, done)
  }

  /**
   * Validate options
   * @private
   */
  validate (opts = {}) {
    const schema = Joi.object().keys({
      token: Joi.string().required(),
      addDataTo: Joi.object().required(),
      json: Joi.string(),
      cache: Joi.string(),
      models: Joi.array().items(
        Joi.object().keys({
          type: Joi.string().default(Joi.ref('name')),
          name: Joi.string(), // this is an alias for type
          ids: Joi.array().single(),
          query: Joi.string(),
          offset: Joi.number(),
          limit: Joi.number(),
          transform: Joi.func(),
          json: Joi.string(),
          template: Joi.object().keys({
            path: Joi.string(),
            output: Joi.func()
          })
        })
      )
    })

    const res = Joi.validate(opts, schema, {
      language: {
        messages: { wrapArrays: false },
        object: { child: '!![spike-datocms constructor] option {{reason}}' }
      }
    })
    if (res.error) { throw new Error(res.error) }
    return res.value
  }
}

function fetchData () {
  // if cache is set
  if (this.cache) {
    // if cache is set and cache file doesn't exist; write it
    if (!fs.existsSync(this.cache)) {
      this.rewrite = true
    } else { // if cache is set and cache file exists; parse it
      return W.resolve(JSON.parse(fs.readFileSync(this.cache, 'utf8')))
    }
  } else { // if cache isn't set, hit the API
    return this.client.site.find()
  }
}

// TODO: use proxies so there can be no infinite loopz
function resolveLinks ([records, itemTypes]) {
  // find all model ids
  const recordIds = records.map((r) => r.id)
  // scan all model values
  records.map((r) => {
    for (let k in r) {
      if (k === 'id') continue
      // check to see if it is a model id, which means it's a link
      // if so, replace the id with the actual item
      if (Array.isArray(r[k])) {
        r[k] = r[k].map(resolveLink.bind(null, recordIds, records))
      } else {
        r[k] = resolveLink(recordIds, records, r[k])
      }
    }
  })
  return [records, itemTypes]
}

function resolveLink (ids, records, record) {
  if (ids.indexOf(record) > -1) {
    return records.find((r2) => r2.id === record)
  } else {
    return record
  }
}

function writeJson (compilation, filename, data) {
  const src = JSON.stringify(data, null, 2)
  compilation.assets[filename] = {
    source: () => src,
    size: () => src.length
  }
}

function writeCache (filename, data) {
  const src = JSON.stringify(data, null, 2)
  return mkdirp(path.dirname(filename), function () {
    fs.writeFileSync(filename, src)
  })
}

// TODO: get rid of this, put the templates through webpack
function writeTemplate (compiler, compilation, model) {
  const data = this.addDataTo.dato[model.type]
  const filePath = path.join(compiler.options.context, model.template.path)

  return node.call(fs.readFile.bind(fs), filePath, 'utf8').then((template) => {
    return W.map(data, (item) => {
      const newLocals = Object.assign({}, this.addDataTo, { item })

      const options = loader.parseOptions.call(this.loaderContext, this.util.getSpikeOptions().reshape, {})

      // for any plugins that pull locals from the options
      options.locals = newLocals

      return reshape(options)
        .process(template)
        .then((res) => {
          const html = res.output(newLocals)
          compilation.assets[model.template.output(item)] = {
            source: () => html,
            size: () => html.length
          }
        })
    })
  })
}
