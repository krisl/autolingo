export default class ReactUtils {
    constructor() {}

    ReactInternal = (elem) => {
        // Object.keys() doesn't like null and undefined
        if (elem == null || elem == undefined) {
            return;
        }
    
        // find it's react internal instance key
        let key = Object.keys(elem).find(key => key.startsWith("__reactInternalInstance$"));
    
        // get the react internal instance
        return elem[key];
    }
    
    ReactEvents = (elem) => {
        // Object.keys() doesn't like null and undefined
        if (elem == null || elem == undefined) {
            return;
        }
    
        // find it's react internal instance key
        let key = Object.keys(elem).find(key => key.startsWith("__reactEventHandlers$"))
    
        // get the react internal instance
        return elem[key]
    }
}
