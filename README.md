# Spike DatoCMS Plugin

[![npm](https://img.shields.io/npm/v/spike-datocms.svg?style=flat-square)](https://npmjs.com/package/spike-datocms)
[![tests](https://img.shields.io/travis/static-dev/spike-datocms.svg?style=flat-square)](https://travis-ci.org/static-dev/spike-datocms?branch=master)
[![dependencies](https://img.shields.io/david/static-dev/spike-datocms.svg?style=flat-square)](https://david-dm.org/static-dev/spike-datocms)
[![coverage](https://img.shields.io/coveralls/static-dev/spike-datocms.svg?style=flat-square)](https://coveralls.io/r/static-dev/spike-datocms?branch=master)

A quick and easy interface to DatoCMS content

> **Note:** This project is in early development, and versioning is a little different. [Read this](http://markup.im/#q4_cRZ1Q) for more details.

### Installation

`npm install spike-datocms -S`

### Usage

Sometimes the best way to see how to use something is an example!

```js
const htmlStandards = require('reshape-standard')
const SpikeDatoCMS = require('spike-datocms')
const locals = {}

module.exports = {
  reshape: htmlStandards({ locals }),
  plugins: [
    new SpikeDatoCMS({
      addDataTo: locals,
      apiToken: 'xxx',
      models: [{
        type: 'post', // if you leave this off, it will pull all posts
        ids: [10, 13], // (optional) only return specific records
        query: 'foo', // (optional) text query for records
        offset: 3, // (optional) offset results
        limit: 10, // (optional) limit number of results returned
        transform: (record) => {
          // each record is passed through this function, if provided
          // change it however you want and return the modified result!
          return record
        }
      }, {
        type: 'author'
      }]
    })
  ]
}
```

Now, in your views, you can see your records as such:

```
p {{{ JSON.stringify(dato) }}}
```

Or, for example, loop through one of your models:

```
ul
  each(loop='post in dato.post')
    li post.title
```

### License & Contributing

- Details on the license [can be found here](LICENSE.md)
- Details on running tests and contributing [can be found here](contributing.md)
