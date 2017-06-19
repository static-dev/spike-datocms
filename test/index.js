const SpikeDatoCMS = require('..')
const test = require('ava')
const Spike = require('spike-core')
const htmlStandards = require('reshape-standard')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')

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
    t.truthy(locals.dato._meta.id)
    t.truthy(locals.dato.article.length > 0)
    t.truthy(locals.dato.article.length < 3)
    t.truthy(locals.dato.article[0].category.id)
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
    rimraf.sync(path.join(projPath, 'public'))
    t.end()
  })

  project.compile()
})

test.todo('generates json correctly')

test.cb('generates single page templates correctly', (t) => {
  const locals = {}
  const projPath = path.join(fixturesPath, 'template')
  const project = new Spike({
    root: projPath,
    reshape: htmlStandards({ parser: false, locals: () => locals }),
    ignore: ['template.html'],
    plugins: [new SpikeDatoCMS({
      token: datoToken,
      addDataTo: locals,
      models: [{
        name: 'article',
        template: {
          path: 'template.html',
          output: (obj) => `articles/${obj.slug}.html`
        }
      }]
    })]
  })

  project.on('error', t.end)
  project.on('compile', () => {
    const file1 = JSON.parse(fs.readFileSync(path.join(projPath, 'public/articles/testing-post.html'), 'utf8'))
    const file2 = JSON.parse(fs.readFileSync(path.join(projPath, 'public/articles/testing-2-post.html'), 'utf8'))
    t.is(file1.title, 'Testing Post')
    t.is(file2.title, 'Testing #2 Post')
    rimraf.sync(path.join(projPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('writes json', (t) => {
  const locals = {}
  const projPath = path.join(fixturesPath, 'basic')
  const project = new Spike({
    root: projPath,
    reshape: htmlStandards({ parser: false, locals: () => locals }),
    ignore: ['template.html'],
    plugins: [new SpikeDatoCMS({
      token: datoToken,
      addDataTo: locals,
      json: 'all.json',
      models: [{
        name: 'article',
        json: 'articles.json'
      }]
    })]
  })

  project.on('error', t.end)
  project.on('compile', () => {
    const all = JSON.parse(fs.readFileSync(path.join(projPath, 'public/all.json'), 'utf8'))
    const articles = JSON.parse(fs.readFileSync(path.join(projPath, 'public/articles.json'), 'utf8'))
    t.truthy(all.article.length > 0)
    t.truthy(articles.length > 0)
    rimraf.sync(path.join(projPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('reads cache', (t) => {
  const locals = {}
  const projPath = path.join(fixturesPath, 'readCache')
  const project = new Spike({
    root: projPath,
    reshape: htmlStandards({ parser: false, locals: () => locals }),
    ignore: ['template.html'],
    plugins: [new SpikeDatoCMS({
      token: datoToken,
      addDataTo: locals,
      cache: 'cache/dato.json',
      models: [{
        name: 'article'
      }]
    })]
  })

  project.on('error', t.end)
  project.on('compile', () => {
    const p = path.join(projPath, 'cache/dato.json')
    const all = JSON.parse(fs.readFileSync(p, 'utf8'))
    t.truthy(all.article.length > 0)
    rimraf.sync(path.join(projPath, 'public'))
    t.end()
  })

  project.compile()
})

test.cb('writes cache', (t) => {
  const locals = {}
  const projPath = path.join(fixturesPath, 'writeCache')
  const project = new Spike({
    root: projPath,
    reshape: htmlStandards({ parser: false, locals: () => locals }),
    ignore: ['template.html'],
    plugins: [new SpikeDatoCMS({
      token: datoToken,
      addDataTo: locals,
      cache: 'cache/dato.json',
      models: [{
        name: 'article'
      }]
    })]
  })

  project.on('error', t.end)
  project.on('compile', () => {
    const all = JSON.parse(fs.readFileSync(path.join(projPath, 'cache/dato.json'), 'utf8'))
    t.truthy(all.article.length > 0)
    rimraf.sync(path.join(projPath, 'public'))
    rimraf.sync(path.join(projPath, 'cache'))
    t.end()
  })

  project.compile()
})
