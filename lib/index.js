const SpikeUtil = require('spike-util')
const W = require('when')
const node = require('when/node')
const Joi = require('joi')
const path = require('path')
const fs = require('fs')
const reshape = require('reshape')
const loader = require('reshape-loader')
const {SiteClient} = require('datocms-client')
const DatoLoader = require('datocms-client/lib/local/Loader')
const bindAllClass = require('es6bindall')

module.exports = class SpikeDatoCMS {
  constructor (opts) {
    Object.assign(this, this.validate(opts))
    this.client = new DatoLoader(new SiteClient(opts.token))
    bindAllClass(this, ['apply', 'run'])
  }

  apply (compiler) {
    this.util = new SpikeUtil(compiler.options)
    this.util.runAll(compiler, this.run)

    // TODO: this pulls the incorrect loader context
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('normal-module-loader', (loaderContext) => {
        this.loaderContext = loaderContext
      })
    })

    compiler.plugin('emit', (compilation, done) => {
      if (this.singlePages) {
        W.map(this.singlePages(this.client.itemsRepo), (page) => {
          return writeTemplate.call(this, compiler, compilation, page)
        }).done(() => done(), done)
      }

      done()
    })
  }

  run (compilation, done) {
    return this.client.load().then(() => {
      Object.assign(this.addDataTo, { dato: this.client.itemsRepo })
      done()
    })
  }

  /**
   * Validate options
   * @private
   */
  validate (opts = {}) {
    const schema = Joi.object().keys({
      token: Joi.string().required(),
      addDataTo: Joi.object().required(),
      singlePages: Joi.func()
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

// TODO: get rid of this, put the templates through webpack
function writeTemplate (compiler, compilation, page) {
  const filePath = path.join(compiler.options.context, page.template)

  return node.call(fs.readFile.bind(fs), filePath, 'utf8')
  .then((template) => {
    const newLocals = Object.assign({}, this.addDataTo, page.locals)
    const options = loader.parseOptions.call(this.loaderContext, this.util.getSpikeOptions().reshape, {})

    // for any plugins that pull locals from the options
    options.locals = newLocals
    options.filename = filePath

    return reshape(options)
      .process(template)
      .then((res) => {
        const html = res.output(newLocals)
        compilation.assets[page.output] = {
          source: () => html,
          size: () => html.length
        }
      })
  })
}
