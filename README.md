# router-alive
根据route历史来管理router-view实例的alive组件。保留了keep-alive和vue-router的相关特性，根据浏览记录控制组件的销毁时机，同时增加了一个test属性，来支持按照路由决定组件是否该被alive。keep-alive会把渲染过的组件无条件的缓存，router-alive只保留根据浏览历史来维持存活的router-view组件实例，更能满足实际应用场景，尤其适合web app的场景当中。


浏览器历史记录有最大条目限制，比如chrome是50；不同浏览器history.length有的从1开始，有的从0开始，在此组件内部，通过vue-router的api，做了一个内部的浏览器记录的管理，能够准确识别页面刷新、替换、前进&后退、打开新页面的动作，并且存储的浏览器记录不受浏览器最大条目限制。  但是浏览记录一旦得到最大限制后，最早访问的记录，也无法通过浏览器的前进后退能访问到了，所以此组件内部存储的浏览器记录比浏览器自己存储的也没有意义了。
