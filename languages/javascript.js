const $ = window.jQuery
const startswith = require('lodash.startswith')
const resolve = require('resolve-pathname')

const external = require('../helpers').external
const treePromise = require('../helpers').treePromise
const createLink = require('../helpers').createLink
const htmlWithLink = require('../helpers').htmlWithLink
const bloburl = require('../helpers').bloburl

const extensions = ['js', 'jsx', 'json', 'coffee', 'ts', 'es', 'es6']

module.exports.process = function process () {
  let { current } = window.pathdata

  $('.blob-code-inner').each((_, elem) => {
    let line = elem.innerText.trim()
    processLine(elem, line, current.join('/'))
  })
}

module.exports.processLine = processLine

function processLine (elem, line, currentPath, lineIndex) {
  var moduleName

  let names = [
    /import *.* *from ['"`]([^'"`]+)['"`]/.exec(line),
    /import *['"`]([^'"`]+)['"`]/.exec(line),
    /} * from *['"`]([^'"`]+)['"`]/.exec(line),
    /export .* from ['"`]([^'"`]+)['"`]/.exec(line),
    /require *\(['"`]([^)]+)['"`]\)/.exec(line),
    /require *['"`]([^)]+)['"`]/.exec(line)
  ]
    .filter(x => x)
    .map(regex => regex[1])
  if (names.length) {
    moduleName = names[0]
  } else {
    return
  }

  Promise.resolve()
  .then(() => {
    if (startswith(moduleName, '.')) {
      // is a local file.
      if (extensions.indexOf(moduleName.split('.').slice(-1)[0]) !== -1) {
        return moduleName // the url is exactly this relative path.
      } else {
        return typeof lineIndex === 'undefined'
        ? treePromise()
          .then(paths => {
            for (let i = 0; i < paths.length; i++) {
              let path = paths[i]
              let resolved = resolve(moduleName, currentPath)
              if (path.split('/').slice(0, -1).join('/') === resolved ||
                  path.split('.').slice(0, -1).join('.') === resolved) {
                let { user, repo, ref } = window.pathdata
                return bloburl(user, repo, ref, path)
              }
            }
            throw new Error('fallback.')
          })
          .catch(() => {
            // fallback to appending the same filetype as the file in which we are now.
            // normally === '.js', but can be '.ts' or '.coffee'.
            return moduleName + '.' + window.filetype
          })
        : null // if there is a lineIndex it is because processLine is being called from
               // markdown.js. and we don't want relative paths in this case.
      }
    } else if (moduleName in stdlib) {
      // is not local, is a file from the stdlib.
      return 'https://nodejs.org/api/' + moduleName + '.html'
    } else {
      // is an npm module.
      return npmurl(moduleName)
    }
  })
  .then(url => {
    if (typeof lineIndex !== 'undefined') {
      // lineIndex is passed from markdown.js, meaning we must replace
      // only in that line -- in this case `elem` is the whole code block,
      // not, as normally, a single line.
      let lines = elem.innerHTML.split('\n')
      lines[lineIndex] = htmlWithLink(lines[lineIndex], moduleName, url, true)
      elem.innerHTML = lines.join('\n')
      return
    }

    createLink(elem, moduleName, url, true)
  })
}

module.exports.npmurl = npmurl
function npmurl (moduleName) {
  return external('npm', moduleName)
    .catch(() =>
      'https://npmjs.com/package/' + (
        startswith(moduleName, '@')
          ? moduleName.split('/').slice(0, 2).join('/')
          : moduleName.split('/')[0]
        )
    )
}

const stdlib = {assert: 1, buffer: 1, addons: 1, child_process: 1, cluster: 1, console: 1, crypto: 1, debugger: 1, dns: 1, domain: 1, errors: 1, events: 1, fs: 1, globals: 1, http: 1, https: 1, modules: 1, net: 1, os: 1, path: 1, process: 1, punycode: 1, querystring: 1, readline: 1, repl: 1, stream: 1, string_decoder: 1, timers: 1, tls: 1, tty: 1, dgram: 1, url: 1, util: 1, v8: 1, vm: 1, zlib: 1}
