import Component from './component'
import { resolveQuery, parsePath, extend } from './utils'

function _createKey(location) {
    return String(Date.now()).substring(7) + (Math.random(10000, 9999) * 10000 | 0)
}

export default {
    install: (Vue, {
        router,
        keyName = 'RAK',
        componentName = 'router-alive',
        createKey = _createKey,
        storageKey = 'router-alive-history'
    } = {}) => {
        if (!router) {
            console.error('router option is required.')
            return
        }

        let transitionTo = router.history.transitionTo
        router.history.transitionTo = function (raw, onComplete, onAbort) {
            let location = typeof raw === 'string' ? { path: raw } : raw
            const parsedPath = parsePath(location.path || '')
            let query = resolveQuery(
                parsedPath.query,
                location.query,
                router.options.parseQuery
            )

            if (!query[keyName]) {
                query[keyName] = createKey(raw)
            }

            location.query = query
            return transitionTo.apply(this, [location, onComplete, onAbort])
        }

        let replace = router.history.replace
        router.history.replace = function (raw, onComplete, onAbort) {
            let location = typeof raw === 'string' ? { path: raw } : raw
            let current = router.history.current
            if (current && current.query[keyName]) {
                location.query = location.query || {}
                location.query[keyName] = current.query[keyName]
            }
            return replace.apply(this, [location, onComplete, onAbort])
        }
        Vue.component(componentName, Component({ componentName, keyName, storageKey }))
    }
}