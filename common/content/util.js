// Copyright (c) 2006-2009 by Martin Stubenschrott <stubenschrott@vimperator.org>
//
// This work is licensed for reuse under an MIT license. Details are
// given in the License.txt file included with this file.

/** @scope modules */

(function () {
    function Namespace(prefix, uri) {
        this.prefix = prefix;
        this.uri = uri;
    }
    Namespace.prototype.toString = function toString() { return this.uri; };

    // Expose XHTML,XUL,NS to Global-scope.
    Object.defineProperties(modules, {
        XHTML: {
            value: Object.freeze(
                new Namespace("html", "http://www.w3.org/1999/xhtml")
            ),
            enumerable: true
        },
        XUL: {
            value: Object.freeze(
                new Namespace("xul", "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul")
            ),
            enumerable: true
        },
        NS: {
            value: Object.freeze(
                new Namespace("liberator", "http://vimperator.org/namespaces/liberator")
            ),
            enumerable: true
        }
    });
})();

let Encoder = Components.Constructor("@mozilla.org/layout/documentEncoder;1?type=text/plain", "nsIDocumentEncoder", "init");

const Util = Module("util", {
    init: function () {
        this.Array = Util.Array;
    },

    /**
     * Returns a shallow copy of <b>obj</b>.
     *
     * @param {Object} obj
     * @returns {Object}
     */
    cloneObject: function cloneObject(obj) {
        if (obj instanceof Array)
            return obj.slice();
        let newObj = {};
        for (let [k, v] in Iterator(obj))
            newObj[k] = v;
        return newObj;
    },

    /**
     * Clips a string to a given length. If the input string is longer
     * than <b>length</b>, an ellipsis is appended.
     *
     * @param {string} str The string to truncate.
     * @param {number} length The length of the returned string.
     * @returns {string}
     */
    clip: function clip(str, length) {
        return str.length <= length ? str : str.substr(0, length - 3) + "...";
    },

    /**
     * Compares two strings, case insensitively. Return values are as
     * in String#localeCompare.
     *
     * @param {string} a
     * @param {string} b
     * @returns {number}
     */
    compareIgnoreCase: function compareIgnoreCase(a, b) String.localeCompare(a.toLowerCase(), b.toLowerCase()),

    /**
     * Returns an object representing a Node's computed CSS style.
     *
     * @param {Node} node
     * @returns {Object}
     */
    computedStyle: function computedStyle(node) {
        while ((node instanceof Text || node instanceof Comment) && node.parentNode)
            node = node.parentNode;
        return node.ownerDocument.defaultView.getComputedStyle(node, null);
    },

    /**
     * Copies a string to the system clipboard. If <b>verbose</b> is specified
     * the copied string is also echoed to the command line.
     *
     * @param {string} str
     * @param {boolean} verbose
     */
    copyToClipboard: function copyToClipboard(str, verbose) {
        const clipboardHelper = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper);
        clipboardHelper.copyString(str);

        if (verbose)
            liberator.echomsg("Copied text to clipboard: " + str);
    },

    /**
     * Converts any arbitrary string into an URI object.
     *
     * @param {string} str
     * @returns {Object}
     */
    // FIXME: newURI needed too?
    createURI: function createURI(str) {
        const fixup = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
        return fixup.createFixupURI(str, fixup.FIXUP_FLAG_ALLOW_KEYWORD_LOOKUP);
    },

    /**
     * Converts HTML special characters in <b>str</b> to the equivalent HTML
     * entities.
     *
     * @param {string} str
     * @returns {string}
     */
    escapeHTML: function escapeHTML(str) {
        // XXX: the following code is _much_ slower than a simple .replace()
        // :history display went down from 2 to 1 second after changing
        //
        // var e = window.content.document.createElement("div");
        // e.appendChild(window.content.document.createTextNode(str));
        // return e.innerHTML;
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },

    /**
     * Escapes Regular Expression special characters in <b>str</b>.
     *
     * @param {string} str
     * @returns {string}
     */
    escapeRegex: function escapeRegex(str) {
        return str.replace(/([\\{}()[\].?*+])/g, "\\$1");
    },

    /**
     * Escapes quotes, newline and tab characters in <b>str</b>. The returned
     * string is delimited by <b>delimiter</b> or " if <b>delimiter</b> is not
     * specified. {@see String#quote}.
     *
     * @param {string} str
     * @param {string} delimiter
     * @returns {string}
     */
    escapeString: function escapeString(str, delimiter) {
        if (delimiter === undefined)
            delimiter = '"';
        return delimiter + str.replace(/([\\'"])/g, "\\$1").replace("\n", "\\n", "g").replace("\t", "\\t", "g") + delimiter;
    },

    /**
     * Returns an XPath union expression constructed from the specified node
     * tests. An expression is built with node tests for both the null and
     * XHTML namespaces. See {@link Buffer#evaluateXPath}.
     *
     * @param nodes {Array(string)}
     * @returns {string}
     */
    makeXPath: function makeXPath(nodes) {
        return util.Array(nodes).map(function (node) [node, "xhtml:" + node]).flatten()
                                .map(function (node) "//" + node).join(" | ");
    },

    /**
     * Memoize the lookup of a property in an object.
     *
     * @param {object} obj The object to alter.
     * @param {string} key The name of the property to memoize.
     * @param {function} getter A function of zero to two arguments which
     *          will return the property's value. <b>obj</b> is
     *          passed as the first argument, <b>key</b> as the
     *          second.
     */
    memoize: function memoize(obj, key, getter) {
        obj.__defineGetter__(key, function () {
            delete obj[key];
            obj[key] = getter(obj, key);
            return obj[key];
        });
    },

    /**
     * Split a string on literal occurrences of a marker.
     *
     * Specifically this ignores occurrences preceded by a backslash, or
     * contained within 'single' or "double" quotes.
     *
     * It assumes backslash escaping on strings, and will thus not count quotes
     * that are preceded by a backslash or within other quotes as starting or
     * ending quoted sections of the string.
     *
     * @param {string} str
     * @param {RegExp} marker
     */
    splitLiteral: function splitLiteral(str, marker) {
        let results = [];
        let resep = RegExp(/^(([^\\'"]|\\.|'([^\\']|\\.)*'|"([^\\"]|\\.)*")*?)/.source + marker.source);
        let cont = true;

        while (cont) {
            cont = false;
            str = str.replace(resep, function (match, before) {
                cont = false;
                if (before) {
                    results.push(before);
                    cont = true;
                }
                return "";
            });
        }

        results.push(str);
        return results;
    },

    /**
     * Converts <b>bytes</b> to a pretty printed data size string.
     *
     * @param {number} bytes The number of bytes.
     * @param {string} decimalPlaces The number of decimal places to use if
     *     <b>humanReadable</b> is true.
     * @param {boolean} humanReadable Use byte multiples.
     * @returns {string}
     */
    formatBytes: function formatBytes(bytes, decimalPlaces, humanReadable) {
        const unitVal = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
        let unitIndex = 0;
        let tmpNum = parseInt(bytes, 10) || 0;
        let strNum = [tmpNum + ""];

        if (humanReadable) {
            while (tmpNum >= 1024) {
                tmpNum /= 1024;
                if (++unitIndex > (unitVal.length - 1))
                    break;
            }

            let decPower = Math.pow(10, decimalPlaces);
            strNum = ((Math.round(tmpNum * decPower) / decPower) + "").split(".", 2);

            if (!strNum[1])
                strNum[1] = "";

            while (strNum[1].length < decimalPlaces) // pad with "0" to the desired decimalPlaces)
                strNum[1] += "0";
        }

        for (let u = strNum[0].length - 3; u > 0; u -= 3) // make a 10000 a 10,000
            strNum[0] = strNum[0].substr(0, u) + "," + strNum[0].substr(u);

        if (unitIndex) // decimalPlaces only when > Bytes
            strNum[0] += "." + strNum[1];

        return strNum[0] + " " + unitVal[unitIndex];
    },

    exportHelp: function (path) {
        const FILE = io.File(path);
        const PATH = FILE.leafName.replace(/\..*/, "") + "/";
        const TIME = Date.now();

        let zip = services.create("zipWriter");
        zip.open(FILE, io.MODE_CREATE | io.MODE_WRONLY | io.MODE_TRUNCATE);
        function addURIEntry(file, uri)
            zip.addEntryChannel(PATH + file, TIME, 9,
                services.get("io").newChannel(uri, null, null), false)
        function addDataEntry(file, data) // Inideal to an extreme.
            addURIEntry(file, "data:text/plain;charset=UTF-8," + encodeURI(data))

        let empty = util.Array.toObject(
            "area base basefont br col frame hr img input isindex link meta param"
            .split(" ").map(Array.concat));

        let chrome = {};
        for (let [file,] in Iterator(services.get("liberator:").FILE_MAP)) {
            liberator.open("liberator://help/" + file);
            events.waitForPageLoad();
            let data = [
                '<?xml version="1.0" encoding="UTF-8"?>\n',
                '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"\n',
                '          "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">\n'
            ];
            function fix(node) {
                switch(node.nodeType) {
                    case Node.ELEMENT_NODE:
                        if (node instanceof HTMLScriptElement)
                            return;

                        data.push("<"); data.push(node.localName);
                        if (node instanceof HTMLHtmlElement)
                            data.push(" xmlns=" + JSON.stringify(XHTML.uri));

                        for (let { name: name, value: value } in util.Array.itervalues(node.attributes)) {
                            if (name === "liberator:highlight") {
                                name = "class";
                                value = "hl-" + value;
                            }
                            if (name === "href") {
                                if (value.indexOf("liberator://help-tag/") === 0)
                                    value = services.get("io").newChannel(value, null, null).originalURI.path.substr(1);
                                if (!/[#\/]/.test(value))
                                    value += ".xhtml";
                            }
                            if (name === "src" && value.indexOf(":") > 0) {
                                chrome[value] = value.replace(/.*\//, "");
                                value = value.replace(/.*\//, "");
                            }
                            data.push(" ");
                            data.push(name);
                            data.push('="');
                            data.push(xml`${value}`.toString());
                            data.push('"');
                        }
                        if (node.localName in empty)
                            data.push(" />");
                        else {
                            data.push(">");
                            if (node instanceof HTMLHeadElement)
                                data.push(`<link rel="stylesheet" type="text/css" href="help.css"/>`/*toXMLString()*/);
                            Array.map(node.childNodes, arguments.callee);
                            data.push("</");
                            data.push(node.localName);
                            data.push(">");
                        }
                        break;
                    case Node.TEXT_NODE:
                        data.push(xml`${node.textContent}`.toString());
                }
            }
            fix(content.document.documentElement);
            addDataEntry(file + ".xhtml", data.join(""));
        }

        let data = Array.from(iter(highlight))
                        .filter(h => /^Help|^Logo/.test(h.class))
                        .map(h =>
                            h.selector.replace(/^\[.*?=(.*?)\]/, ".hl-$1").replace(/html\|/, "") +
                            "\t{" + h.value + "}"
                        );

        data = data.join("\n");
        addDataEntry("help.css", data.replace(/chrome:[^ ")]+\//g, ""));

        let re = /(chrome:[^ ");]+\/)([^ ");]+)/g;
        while ((m = re.exec(data)))
            chrome[m[0]] = m[2];

        for (let [uri, leaf] in Iterator(chrome))
            addURIEntry(leaf, uri);

        zip.close();
    },

    /**
     * Sends a synchronous or asynchronous HTTP request to <b>url</b> and
     * returns the XMLHttpRequest object. If <b>callback</b> is specified the
     * request is asynchronous and the <b>callback</b> is invoked with the
     * object as its argument.
     *
     * @param {string} url
     * @param {function(XMLHttpRequest)} callback
     * @returns {XMLHttpRequest}
     */
    httpGet: function httpGet(url, callback) {
        try {
            let xmlhttp = new XMLHttpRequest();
            xmlhttp.mozBackgroundRequest = true;
            if (callback) {
                xmlhttp.onreadystatechange = function () {
                    if (xmlhttp.readyState === 4)
                        callback(xmlhttp);
                };
            }
            xmlhttp.open("GET", url, !!callback);
            xmlhttp.send(null);
            return xmlhttp;
        }
        catch (e) {
            // liberator.log("Error opening " + url + ": " + e);
            return null;
        }
    },

    /**
     * Evaluates an XPath expression in the current or provided
     * document. It provides the xhtml, xhtml2 and liberator XML
     * namespaces. The result may be used as an iterator.
     *
     * @param {string} expression The XPath expression to evaluate.
     * @param {Document} doc The document to evaluate the expression in.
     * @default The current document.
     * @param {Node} elem The context element.
     * @default <b>doc</b>
     * @param {boolean} asIterator Whether to return the results as an
     *     XPath iterator.
     */
    evaluateXPath: function (expression, doc, elem, asIterator) {
        if (!doc)
            doc = window.content.document;
        if (!elem)
            elem = doc;
        if (isarray(expression))
            expression = util.makeXPath(expression);

        let result = doc.evaluate(expression, elem,
            function lookupNamespaceURI(prefix) {
                return {
                    xhtml: "http://www.w3.org/1999/xhtml",
                    xhtml2: "http://www.w3.org/2002/06/xhtml2",
                    liberator: NS.uri
                }[prefix] || null;
            },
            asIterator ? XPathResult.ORDERED_NODE_ITERATOR_TYPE : XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
        );

        if (Cu.isXrayWrapper(result)) {
            let xr = result;

            if (asIterator) {
                result = { iterateNext: function iterateNext() xr.iterateNext()};
            } else {
                result = {
                    snapshotItem: function snapshotItem(num) xr.snapshotItem(num),
                    get snapshotLength() xr.snapshotLength,
                };
            }
        }

        result.__iterator__ = asIterator
                            ? function () { let elem; while ((elem = this.iterateNext())) yield elem; }
                            : function () { for (let i = 0; i < this.snapshotLength; i++) yield this.snapshotItem(i); };

        return result;
    },

    /**
     * The identity function.
     *
     * @param {Object} k
     * @returns {Object}
     */
    identity: function identity(k) k,

    /**
     * Returns the intersection of two rectangles.
     *
     * @param {Object} r1
     * @param {Object} r2
     * @returns {Object}
     */
    intersection: function (r1, r2) ({
        get width()  this.right - this.left,
        get height() this.bottom - this.top,
        left: Math.max(r1.left, r2.left),
        right: Math.min(r1.right, r2.right),
        top: Math.max(r1.top, r2.top),
        bottom: Math.min(r1.bottom, r2.bottom)
    }),

    /**
     * Returns the array that results from applying <b>func</b> to each
     * property of <b>obj</b>.
     *
     * @param {Object} obj
     * @param {function} func
     * @returns {Array}
     */
    map: function map(obj, func) {
        let ary = [];
        for (let i in Iterator(obj))
            ary.push(func(i));
        return ary;
    },

    /**
     * Math utility methods.
     * @singleton
     */
    Math: {
        /**
         * Returns the specified <b>value</b> constrained to the range <b>min</b> -
         * <b>max</b>.
         *
         * @param {number} value The value to constrain.
         * @param {number} min The minimum constraint.
         * @param {number} max The maximum constraint.
         * @returns {number}
         */
        constrain: function constrain(value, min, max) Math.min(Math.max(min, value), max)
    },

    /**
     * Converts a URI string into a URI object.
     *
     * @param {string} uri
     * @returns {nsIURI}
     */
    // FIXME: createURI needed too?
    newURI: function (uri) {
        return services.get("io").newURI(uri, null, null);
    },

    /**
     * Pretty print a JavaScript object. Use HTML markup to color certain items
     * if <b>color</b> is true.
     *
     * @param {Object} object The object to pretty print.
     * @param {boolean} color Whether the output should be colored.
     * @returns {string}
     */
    objectToString: function objectToString(object, color) {
        if (object === null)
            return "null\n";

        if (typeof object != "object")
            return false;

        const NAMESPACES = util.Array.toObject([
            [NS, 'liberator'],
            [XHTML, 'html'],
            [XUL, 'xul']
        ]);
        if (object instanceof Element) {
            let elem = object;
            if (elem.nodeType === elem.TEXT_NODE)
                return elem.data;
            function namespaced(node) {
                var ns = NAMESPACES[node.namespaceURI];
                if (ns)
                    return ns + ":" + node.localName;
                return node.localName.toLowerCase();
            }
            try {
                let tag = xml`${`<${namespaced(elem)} `}${
                    template.map2(xml, elem.attributes,
                        function (a) xml`${namespaced(a)}=${template.highlight(a.value, true)}`, " ")}${
                    !elem.firstChild || /^\s*$/.test(elem.firstChild) && !elem.firstChild.nextSibling
                        ? "/>" : `>...</${namespaced(elem)}>`}`;
                return tag;
            }
            catch (e) {
                return {}.toString.call(elem);
            }
        }

        try { // for window.JSON
            var obj = String(object);
        }
        catch (e) {
            obj = "[Object]";
        }
        obj = template.highlightFilter(util.clip(obj, 150), "\n", !color ? function () "^J" : function () xml`<span highlight="NonText">^J</span>`);
        let string = xml`<span highlight="Title Object">${obj}</span>::<br/>&#xa;`;

        let keys = [];
        try { // window.content often does not want to be queried with "var i in object"
            let hasValue = !("__iterator__" in object);
            if (modules.isPrototypeOf(object)) {
                object = Iterator(object);
                hasValue = false;
            }
            for (let i in object) {
                let value = xml`<![CDATA[<no value>]]>`;
                try {
                    value = object[i];
                }
                catch (e) {}
                if (!hasValue) {
                    if (i instanceof Array && i.length === 2)
                        [i, value] = i;
                    else
                        var noVal = true;
                }

                value = template.highlight(value, true, 150);
                let key = xml`<span highlight="Key">${i}</span>`;
                if (!isNaN(i))
                    i = parseInt(i);
                else if (/^[A-Z_]+$/.test(i))
                    i = "";
                keys.push([i, xml`${key}${noVal ? "" : xml`: ${value}`}<br/>&#xa;`]);
            }
        }
        catch (e) {}

        function compare(a, b) {
            if (!isNaN(a[0]) && !isNaN(b[0]))
                return a[0] - b[0];
            return String.localeCompare(a[0], b[0]);
        }
        xml["+="](string, template.map2(xml, keys.sort(compare), function (f) f[1]));
        return string;
    },

    /**
     * A generator that returns the values between <b>start</b> and <b>end</b>,
     * in <b>step</b> increments.
     *
     * @param {number} start The interval's start value.
     * @param {number} end The interval's end value.
     * @param {boolean} step The value to step the range by. May be
     *     negative. @default 1
     * @returns {Iterator(Object)}
     */
    range: function range(start, end, step) {
        if (!step)
            step = 1;
        if (step > 0) {
            for (; start < end; start += step)
                yield start;
        }
        else {
            while (start > end)
                yield start += step;
        }
    },

    /**
     * An interruptible generator that returns all values between <b>start</b>
     * and <b>end</b>. The thread yields every <b>time</b> milliseconds.
     *
     * @param {number} start The interval's start value.
     * @param {number} end The interval's end value.
     * @param {number} time The time in milliseconds between thread yields.
     * @returns {Iterator(Object)}
     */
    interruptibleRange: function* interruptibleRange(start, end, time) {
        let endTime = Date.now() + time;
        while (start < end) {
            if (Date.now() > endTime) {
                liberator.threadYield(true, true);
                endTime = Date.now() + time;
            }
            yield start++;
        }
    },

    /**
     * Reads a string from the system clipboard.
     *
     * This is same as Firefox's readFromClipboard function, but is needed for
     * apps like Thunderbird which do not provide it.
     *
     * @returns {string}
     */
    readFromClipboard: function readFromClipboard() {
        let str;

        try {
            const clipboard = Cc["@mozilla.org/widget/clipboard;1"].getService(Ci.nsIClipboard);
            const transferable = Cc["@mozilla.org/widget/transferable;1"].createInstance(Ci.nsITransferable);
            if("init" in transferable) {
                transferable.init(null);
            }

            transferable.addDataFlavor("text/unicode");

            if (clipboard.supportsSelectionClipboard())
                clipboard.getData(transferable, clipboard.kSelectionClipboard);
            else
                clipboard.getData(transferable, clipboard.kGlobalClipboard);

            let data = {};
            let dataLen = {};

            transferable.getTransferData("text/unicode", data, dataLen);

            if (data) {
                data = data.value.QueryInterface(Ci.nsISupportsString);
                str = data.data.substring(0, dataLen.value / 2);
            }
        }
        catch (e) {}

        return str;
    },

    /**
     * Returns an array of URLs parsed from <b>str</b>.
     *
     * Given a string like 'google bla, www.osnews.com' return an array
     * ['www.google.com/search?q=bla', 'www.osnews.com']
     *
     * @param {string} str
     * @returns {string[]}
     */
    stringToURLArray: function stringToURLArray(str) {
        let urls;

        if (options.urlseparator)
            urls = util.splitLiteral(str, RegExp("\\s*" + options.urlseparator + "\\s*"));
        else
            urls = [str];

        return urls.map(function (url) {
            url = url.trim();

            if (!url)
                return "";

            if (url.substr(0, 5) != "file:") {
                try {
                    // Try to find a matching file.
                    let file = io.File(url);
                    if (file.exists() && file.isReadable())
                        return services.get("io").newFileURI(file).spec;
                }
                catch (e) {}
            }

            // Look for a valid protocol
            let proto = url.match(/^([-\w]+):/);
            if (proto && Cc["@mozilla.org/network/protocol;1?name=" + proto[1]])
                // Handle as URL, but remove spaces. Useful for copied/'p'asted URLs.
                return url.replace(/\s*\n+\s*/g, "");

            // Ok, not a valid proto. If it looks like URL-ish (foo.com/bar),
            // let Gecko figure it out.
            if (!/^(["']).*\1$/.test(url) && /[.\/]/.test(url) && !/^\.|\s/.test(url) ||
                /^[\w-.]+:\d+(?:\/|$)/.test(url))
                return url;

            // TODO: it would be clearer if the appropriate call to
            // getSearchURL was made based on whether or not the first word was
            // indeed an SE alias rather than seeing if getSearchURL can
            // process the call usefully and trying again if it fails

            // check for a search engine match in the string, then try to
            // search for the whole string in the default engine
            let searchURL = bookmarks.getSearchURL(url, false) || bookmarks.getSearchURL(url, true);
            if (searchURL)
                return searchURL;

            // Hmm. No defsearch? Let the host app deal with it, then.
            return url;
        }).filter(function(url, i) i === 0 || url);
    },

    /**
     * Converts an string, TemplateXML object or E4X literal to a DOM node.
     *
     * @param {String|TemplateXML|xml} node
     * @param {Document} doc
     * @param {Object} nodes If present, nodes with the "key" attribute are
     *     stored here, keyed to the value thereof.
     * @returns {Node|DocumentFragment}
     */
    xmlToDom: function xmlToDom(node, doc, nodes) {
        var dom = this.xmlToDomForTemplate(node, doc, nodes);

        //xxx: change highlight's namespace
        const str = "highlight";
        var attr,
            list = (dom.nodeType === 11 ? dom : dom.parentNode).querySelectorAll("[highlight]");
        for (let node of list) {
            attr = node.getAttribute(str);
            node.removeAttribute(str);
            node.setAttributeNS(NS, str, attr);
        }
        return dom;
    },
    /**
     * Converts an string of TemplateXML object to a DOM node.
     *
     * @param {String|TemplateXML} node
     * @param {Document} doc
     * @param {Object} nodes
     * @returns {Node|DocumentFragment}
     * @see util.xmlToDom
     */
    xmlToDomForTemplate: function xmlToDomForTemplate(node, doc, nodes) {
        var range = doc.createRange();
        var fragment = range.createContextualFragment(
            xml`<div xmlns:ns=${NS} xmlns:xul=${XUL} xmlns=${XHTML}>${node}</div>`.toString());

        range.selectNodeContents(fragment.firstChild);
        var dom = range.extractContents();

        range.detach();

        if (nodes) {
            for (let elm of dom.querySelectorAll("[key]"))
                nodes[elm.getAttribute("key")] = elm;
        }
        return dom.childNodes.length === 1 ? dom.childNodes[0] : dom;
    },
    /**
     * encoding dom
     *
     * @param {Node|Range|Selection|Document} node
     * @param {String} type     example "text/plain", "text/html", "text/xml", "application/xhtml+xml" etc...
     * @param {Number} flags    nsIDocumentEncoder.OutputXXXX
     * @returns {String}
     */
    domToStr: function domToStr(node, type, flags) {
        var doc, method;

        if (node instanceof Document) {
            doc = node;
            node = null;
            method = "setNode";
        } else if (node instanceof Node) {
            doc = node.ownerDocument;
            method = "setNode";
        } else if (node instanceof Range) {
            doc = node.startContainer;
            if (doc.ownerDocument) {
                doc = doc.ownerDocument;
            }
            method = "setRange";
        } else if (node instanceof Selection) {
            // can not found document
            if (node.rangeCount === 0) {
                return "";
            }
            doc = node.getRangeAt(0).startContainer;
            if (doc.ownerDocument) {
                doc = doc.ownerDocument;
            }
            method = "setSelection";
        } else {
            return null;
        }

        var encoder = new Encoder(doc, type || "text/html", flags || 0);
        encoder[method](node);
        return encoder.encodeToString();
    },
}, {
    // TODO: Why don't we just push all util.BuiltinType up into modules? --djk
    /**
     * Array utility methods.
     */
    Array: Class("Array", Array, {
        init: function (ary) {
            return {
                __proto__: ary,
                __iterator__: function () this.iteritems(),
                mapImpl: function (meth, args) {
                    var res = util.Array[meth].apply(null, [this.__proto__].concat(args));

                    if (util.Array.isinstance(res))
                        return util.Array(res);
                    return res;
                },
                toString: function () this.__proto__.toString(),
                concat: function () this.__proto__.concat.apply(this.__proto__, arguments),
                map: function () this.mapImpl("map", Array.slice(arguments)),
                flatten: function () this.mapImpl("flatten", arguments)
            };
        }
    }, {
        isinstance: function isinstance(obj) {
            return Object.prototype.toString.call(obj) === "[object Array]";
        },

        /**
         * Converts an array to an object. As in lisp, an assoc is an
         * array of key-value pairs, which maps directly to an object,
         * as such:
         *    [["a", "b"], ["c", "d"]] -> { a: "b", c: "d" }
         *
         * @param {Array[]} assoc
         * @... {string} 0 - Key
         * @...          1 - Value
         */
        toObject: function toObject(assoc) {
            let obj = {};
            assoc.forEach(function ([k, v]) { obj[k] = v; });
            return obj;
        },

        /**
         * Compacts an array, removing all elements that are null or undefined:
         *    ["foo", null, "bar", undefined] -> ["foo", "bar"]
         *
         * @param {Array} ary
         * @returns {Array}
         */
        compact: function compact(ary) ary.filter(function (item) item != null),

        /**
         * Flattens an array, such that all elements of the array are
         * joined into a single array:
         *    [["foo", ["bar"]], ["baz"], "quux"] -> ["foo", ["bar"], "baz", "quux"]
         *
         * @param {Array} ary
         * @returns {Array}
         */
        flatten: function flatten(ary) Array.prototype.concat.apply([], ary),

        /**
         * Returns an Iterator for an array's values.
         *
         * @param {Array} ary
         * @returns {Iterator(Object)}
         */
        itervalues: function itervalues(ary) {
            let length = ary.length;
            for (let i = 0; i < length; i++)
                yield ary[i];
        },

        /**
         * Returns an Iterator for an array's indices and values.
         *
         * @param {Array} ary
         * @returns {Iterator([{number}, {Object}])}
         */
        iteritems: function iteritems(ary) {
            let length = ary.length;
            for (let i = 0; i < length; i++)
                yield [i, ary[i]];
        },

        /**
         * Filters out all duplicates from an array. If
         * <b>unsorted</b> is false, the array is sorted before
         * duplicates are removed.
         *
         * @param {Array} ary
         * @param {boolean} unsorted
         * @returns {Array}
         */
        uniq: function uniq(ary, unsorted) [...new Set(unsorted ? ary : ary.sort())],
    })
});

// vim: set fdm=marker sw=4 ts=4 et:
