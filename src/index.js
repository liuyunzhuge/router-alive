import Component from './component'
import { resolveQuery, parsePath, extend } from './utils'
import messager from './messager'
import History from './history'

function _createKey(location) {
    return String(Date.now()).substring(7) + (Math.random(10000, 9999) * 10000 | 0)
}

export default {
    install: (Vue, {
        router,
        keyName = 'RAK',
        componentName = 'router-alive',
        createKey = _createKey,
        storageKey = 'router-alive-history',
        debug = false
    } = {}) => {
        if (!router) {
            console.error('router option is required.')
            return
        }

        const history = new History({ Vue, router, storageKey, keyName, messager })

        const transitionTo = router.history.transitionTo
        router.history.transitionTo = function (raw, onComplete, onAbort) {
            // when transitionTo executes, vue-router is finishing initing
            history.init()

            const location = typeof raw === 'string' ? { path: raw } : raw
            const parsedPath = parsePath(location.path || '')
            const query = resolveQuery(
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

        const replace = router.history.replace
        router.history.replace = function (raw, onComplete, onAbort) {
            // use messager to transport replace state
            messager.setReplace()
            return replace.apply(this, [raw, onComplete, function (...args) {
                messager.reset()
                return onAbort.call(this, ...args)
            }])
        }
        Vue.component(componentName, Component({ componentName, keyName, storageKey, messager, debug, history }))
    }
}