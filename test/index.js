const SpikeDatoCMS = require('..')
const test = require('ava')
const Spike = require('spike-core')
const htmlStandards = require('reshape-standard')
const path = require('path')
const fs = require('fs')

const fixturesPath = path.join(__dirname, 'fixtures')
const datoToken = 'cb1f960dfb4f14a7ae93'

test.cb('basic', (t) => {
  const locals = {}
  const plugin = new SpikeDatoCMS({
    token: datoToken,
    addDataTo: locals,
    models: [{ name: 'article' }]
  })
  return plugin.run({}, () => {
    t.truthy(locals.dato.article.length > 0)
    t.end()
  })
})

test.cb('works with spike', (t) => {
  const locals = {}
  const projPath = path.join(fixturesPath, 'basic')
  const project = new Spike({
    root: projPath,
    // so if the locals are not passed as a function, the reference doesn't
    // update. i'm not 100% sure why this is, in theory it should
    reshape: htmlStandards({ parser: false, locals: () => locals }),
    plugins: [new SpikeDatoCMS({
      token: datoToken,
      addDataTo: locals,
      models: [{ name: 'article' }]
    })]
  })

  project.on('error', t.end)
  project.on('compile', () => {
    const output = JSON.parse(fs.readFileSync(path.join(projPath, 'public/index.html'), 'utf8'))
    t.truthy(output.article.length > 0)
    t.end()
  })

  project.compile()
})
