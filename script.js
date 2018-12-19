// 'use strict';
console.log("HEY");
/** @type {function(?): ?} */
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function(canCreateDiscussions) {
    return typeof canCreateDiscussions;
} : function(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};
(function() {
    /**
     * @param {!Object} variable$jscomp$0
     * @return {?}
     */
    var typeOf$jscomp$0 = function typeOf$jscomp$1(variable$jscomp$0) {
        return _typeof(eval(variable$jscomp$0));
    };
    // console.log("WOWWWWW")
    if (top != window) {
        //     top.location.replace("http://json.parser.online.fr");
        //     return;
        console.log("top != window");

    }
    (function() {
        /**
         * @param {string} data
         * @return {?}
         */
        function parse(data) {
            /**
             * @param {string} string
             * @return {?}
             */
            function parseDate(string) {
                console.log(string);
                return resolve(trim(string));
            }
            /**
             * @param {string} s
             * @return {?}
             */
            function trim(s) {
                return s.replace(/\s+$/g, "");
            }
            /**
             * @param {string} data
             * @return {?}
             */
            function resolve(data) {
                return data.replace(/^\s+/g, "");
            }
            /**
             * @return {?}
             */
            function create() {
                /** @type {number} */
                var i = 0;
                var nbBackslash;
                var offset;
                do {
                    i = p.indexOf('"', i + 1);
                    /** @type {number} */
                    nbBackslash = 0;
                    /** @type {number} */
                    offset = 1;
                    do {
                        if (p.substring(i - offset, i - offset + 1) === "\\") {
                            /** @type {number} */
                            nbBackslash = nbBackslash + 1;
                            offset++;
                            continue;
                        }
                        break;
                    } while (true);
                    if (nbBackslash % 2 === 0) {
                        break;
                    }
                } while (true);
                return i;
            }
            /**
             * @param {!Object} data
             * @return {?}
             */
            function parse(data) {
                /**
                 * @param {!Object} result
                 * @return {?}
                 */
                function value(result) {
                    /**
                     * @param {!Object} options
                     * @return {?}
                     */
                    function next(options) {
                        var data;
                        var max;
                        var i;
                        var firstChar = options.substring(0, 1);
                        options.update("");
                        if (firstChar === '"') {
                            data = options.shift(create(options.todo) + 1);
                            if (data.search(/\\u(?![\d|A-F|a-f]{4})/g) !== -1) {
                                return options.err("\\u must be followed by 4 hexadecimal characters", data);
                            }
                            max = data.length;
                            /** @type {number} */
                            i = 0;
                            for (; i < max; i++) {
                                if (data.substring(i, i + 1) == "\\") {
                                    if (i + 1 < max) {
                                        i++;
                                        if (!data.substring(i, i + 1).search(/[^"|\\|\/|b|f|n|r|t|u]/)) {
                                            return options.err("Backslash must be escaped", data);
                                        }
                                    }
                                }
                            }
                            return options.update('<span class="property">"<span class="p">' + data.substring(1, data.length - 1) + '</span>"</span>');
                        }
                        data = options.shift(options.indexOf(":"));
                        return options.err("Name property must be a String wrapped in double quotes.", data);
                    }
                    /**
                     * @param {!Object} child
                     * @return {?}
                     */
                    function set(child) {
                        if (child.substring(0, 1) !== ":") {
                            child.err("Semi-column is missing.", child.shift(child.indexOf(":")));
                        }
                        return child.swap(1);
                    }
                    result.update("<li>");
                    if (result.substring(0, 1) === "}") {
                        return result.update("</li>");
                    }
                    result = next(result);
                    result = set(result);
                    result = get(result, "}");
                    if (result.substring(0, 1) === ",") {
                        result.swap(1).update("</li>");
                        return value(result);
                    }
                    if (result.substring(0, 1) === "}") {
                        return result.update("</li>");
                    }
                    return result.err("Comma is missing", result.shift(result.indexOf("}"))).update("</li>");
                }
                if (data.indexOf("{") === -1) {
                    data.err("Opening brace is missing", data.todo);
                    return data.update("", "");
                } else {
                    data.shift(1);
                    data.update('<span class="object"><span class="toggle">{</span><ul>');
                    data = value(data).update("</ul>");
                    if (data.indexOf("}") === -1) {
                        data.err("Closing brace is missing", data.todo);
                        return data.update("", "");
                    }
                    return data.span("toggle-end", data.shift(1));
                }
            }
            /**
             * @param {!Object} state
             * @return {?}
             */
            function exec(state) {
                /**
                 * @param {!Object} child
                 * @return {?}
                 */
                function callback(child) {
                    child.update("<li>");
                    child = get(child, "]");
                    if (child.substring(0, 1) === ",") {
                        child.swap(1).update("</li>");
                        return callback(child, ++depth);
                    }
                    if (child.substring(0, 1) === "]") {
                        return child.update("</li>");
                    }
                    return child.err("Comma is missing", child.shift(child.search(/(,|\])/))).update("</li>");
                }
                /** @type {number} */
                var depth = 0;
                if (state.indexOf("[") === -1) {
                    state.err("Opening square bracket is missing", state.todo);
                    return state.update("", "");
                }
                state.shift(1);
                state.update('<span class="array">');
                state.update('<span class="toggle">[</span><ol>');
                if (state.indexOf("]") === 0) {
                    state.shift(1);
                    state.update('</ol><span class="toggle-end" card="0">]</span>');
                    return state.update("</span>");
                }
                state = callback(state, 0);
                if (state.indexOf("]") === -1) {
                    state.err("Closing square bracket is missing", state.todo);
                    state.update('</ol><span class="toggle-end" card="' + (depth + 1) + '"></span>');
                    return state.update("</span>");
                }
                state.shift(1);
                state.update('</ol><span class="toggle-end" card="' + (depth + 1) + '">]</span>');
                return state.update("</span>");
            }
            /**
             * @param {!Object} data
             * @param {string} conversion
             * @return {?}
             */
            function get(data, conversion) {
                var text;
                var idx;
                var i;
                var l;
                var name;
                /** @type {string} */
                var type = "";
                if (data.search(/^(")/) === 0) {
                    text = data.shift(create(data.todo) + 1);
                    if (text.search(/\\u(?![\d|A-F|a-f]{4})/g) !== -1) {
                        return data.err("\\u must be followed by 4 hexadecimal characters", text);
                    }
                    l = text.length;
                    /** @type {number} */
                    i = 0;
                    for (; i < l; i++) {
                        if (text.substring(i, i + 1) == "\\") {
                            if (i + 1 < l) {
                                i++;
                                if (!text.substring(i, i + 1).search(/[^"|\\|\/|b|f|n|r|t|u]/)) {
                                    return data.err("Backslash must be escaped", text);
                                }
                            }
                        }
                    }
                    return data.span("string", text);
                }
                if (data.search(/^\{/) === 0) {
                    return parse(data);
                }
                if (data.search(/^\[/) === 0) {
                    return exec(data);
                }
                idx = data.search(new RegExp("(,|" + conversion + ")"));
                if (idx === -1) {
                    /** @type {number} */
                    idx = data.todo.length - 1;
                    name = trim(data.todo);
                    data.update("", "");
                } else {
                    name = trim(data.shift(idx));
                }
                try {
                    type = typeOf$jscomp$0(name);
                } catch (e) {}
                switch (type) {
                    case "boolean":
                    case "number":
                        return data.span(type, name);
                    default:
                        if (name === "null") {
                            return data.span("null", name);
                        } else {
                            if (name.search(/^(')/) === 0) {
                                return data.err("String must be wrapped in double quotes", name);
                            }
                            return data.err("Unknown type", name);
                        }
                }
            }
            /** @type {boolean} */
            var hasError = false;
            /**
             * @param {string} increment
             * @return {undefined}
             */
            var Date = function factory(increment) {
                /** @type {string} */
                this.done = "";
                this.todo = increment ? increment : "";
                /**
                 * @param {string} state
                 * @param {string} todo
                 * @return {?}
                 */
                this.update = function(state, todo) {
                    if (state) {
                        this.done += state;
                    }
                    if (todo !== undefined) {
                        this.todo = resolve(todo);
                    }
                    return this;
                };
                /**
                 * @param {number} value
                 * @return {?}
                 */
                this.swap = function(value) {
                    if (value && !isNaN(Number(value)) && this.todo.length >= value) {
                        this.update(this.todo.substr(0, value), this.todo.substring(value));
                    }
                    return this;
                };
                /**
                 * @return {?}
                 */
                this.toString = function() {
                    if (this.todo.length !== 0) {
                        this.err("Text after last closing brace.", this.todo);
                    }
                    return this.done;
                };
                /**
                 * @param {string} text
                 * @param {string} className
                 * @return {?}
                 */
                this.span = function(text, className) {
                    return this.update('<span class="' + text + '">' + className + "</span>");
                };
                /**
                 * @param {string} title
                 * @param {string} text
                 * @return {?}
                 */
                this.err = function(title, text) {
                    /** @type {boolean} */
                    hasError = true;
                    return this.update('<span class="error" title="' + title + '">' + text + "</span>");
                };
                /**
                 * @param {number} i
                 * @return {?}
                 */
                this.shift = function(i) {
                    var s;
                    if (i && !isNaN(Number(i)) && this.todo.length >= i) {
                        s = this.substring(0, i);
                        this.update("", this.substring(i));
                        return trim(s);
                    }
                    return "";
                };
                /**
                 * @param {string} value
                 * @param {?} fromIndex
                 * @return {?}
                 */
                this.indexOf = function(value, fromIndex) {
                    if (fromIndex) {
                        return this.todo.indexOf(value, fromIndex);
                    } else {
                        return this.todo.indexOf(value);
                    }
                };
                /**
                 * @param {number} start
                 * @param {number} end
                 * @return {?}
                 */
                this.substring = function(start, end) {
                    if (end) {
                        return this.todo.substring(start, end);
                    } else {
                        return this.todo.substring(start);
                    }
                };
                /**
                 * @param {!Object} value
                 * @return {?}
                 */
                this.search = function(value) {
                    return this.todo.search(value);
                };
            };
            var p = new Date(parseDate(data));
            var msg;
            if (resolve(data).substr(0, 1) === "[") {
                msg = {
                    html: exec(p).toString(),
                    valid: !hasError
                };
            } else {
                if (resolve(data).substr(0, 1) === "{") {
                    msg = {
                        html: parse(p).toString(),
                        valid: !hasError
                    };
                } else {
                    msg = {
                        html: p.err("JSON expression must be an object or an array", data).update(null, "").toString(),
                        valid: false
                    };
                }
            }
            return msg;
        }
        /**
         * @return {undefined}
         */
        function update() {
            /**
             * @param {string} str
             * @return {?}
             */
            function getValue(str) {
                /** @type {string} */
                var whitespace = "[\\x20\\t\\r\\n\\f]";
                /** @type {!RegExp} */
                var fillingCharSequenceRegExp = new RegExp("^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g");
                return str.replace(fillingCharSequenceRegExp, "");
            }
            /**
             * @param {string} data
             * @return {undefined}
             */
            function callback(data) {
                /** @type {(Element|null)} */
                var link = document.querySelector("#favicon");
                /** @type {!Element} */
                var newFavicon = link.cloneNode();
                newFavicon.setAttribute("href", "favicon/" + data + ".png");
                head.replaceChild(newFavicon, link);
            }
            var value = editor.value;
            if (getValue(value) === "") {
                /** @type {string} */
                div.innerHTML = "";
                pre.classList.remove("status-error");
                callback("undefined");
                return;
            }
            pre.classList.remove("status-error");
            setTimeout(function() {
                value = value.replace(/</g, "&lt;");
                value = value.replace(/>/g, "&gt;");
                var date = parse(value);
                div.innerHTML = date.html;
                if (date.valid) {
                    callback("valid");
                } else {
                    var violatedRuleCount = date.html.match(/class="error"/g).length;
                    /** @type {string} */
                    pre.innerHTML = "<b>Invalid JSON</b> &nbsp; " + violatedRuleCount + "&nbsp;error" + (violatedRuleCount > 1 ? "s" : "") + "&nbsp;found";
                    pre.classList.add("status-error");
                    callback("syntax-error");
                }
            }, 0);
        }
        /** @type {string} */
        var faviconName = "favicon";
        /** @type {string} */
        var dot = "online";
        /** @type {(Element|null)} */
        var pre = document.getElementById("status");
        /** @type {string} */
        var mock = "/";
        /** @type {string} */
        var letter = ".";
        /** @type {string} */
        var _ = "parser";
        /** @type {string} */
        var httpHandler = ":";
        /** @type {string} */
        var default_format = "json";
        /** @type {(Element|null)} */
        var head = document.querySelector("head");
        /** @type {(Element|null)} */
        var div = document.getElementById("result");
        /** @type {(Element|null)} */
        var editor = document.getElementById("editor");
        /** @type {string} */
        var blockDirPath = "fr";
        /** @type {string} */
        var type = "keyup";
        /** @type {string} */
        var click = "click";
        /** @type {string} */
        var root = "http" + httpHandler + mock + mock + default_format + letter + _ + letter + dot + letter + blockDirPath + mock;
        /** @type {number} */
        var i = 0;
        /** @type {!NodeList<Element>} */
        var prices = document.querySelectorAll(".ui-option");
        var buy;
        for (; buy = prices[i]; i++) {
            buy.addEventListener(click, function() {
                document.querySelector("body").classList.toggle(this.id);
            }, false);
        }
        (function() {
            /** @type {(Element|null)} */
            var prettyPrintButton = document.querySelector(".popup-container");
            /** @type {(Element|null)} */
            var err_el = document.querySelector(".popup");
            document.querySelector(".about").addEventListener(click, function() {
                prettyPrintButton.classList.add("show");
            }, false);
            document.querySelector(".popup-centerer").addEventListener(click, function(treeOutline) {
                if (treeOutline.target.classList.contains("popup-centerer")) {
                    prettyPrintButton.classList.remove("show");
                    err_el.classList.remove("bitcoin");
                }
            }, false);
            document.querySelector("#bitcoin").addEventListener(click, function() {
                err_el.classList.add("bitcoin");
            });
        })();
        (function() {
            div.addEventListener(click, function(e) {
                /** @type {(EventTarget|null)} */
                var clickedElement = e.target;
                if (clickedElement.classList.contains("toggle") || clickedElement.classList.contains("toggle-end")) {
                    clickedElement.parentNode.classList.toggle("collapsed");
                }
            }, false);
        })();
        (function() {
            var startX;
            var startY;
            var oldValue;
            var y;
            var newHeight;
            /** @type {(Element|null)} */
            var elem = document.querySelector(".ui-editor");
            /** @type {(Element|null)} */
            var yAxisDivInner = document.querySelector(".ui-aside");
            /** @type {(Element|null)} */
            var menu = document.querySelector(".ui-resizer");
            /**
             * @param {!Event} e
             * @return {undefined}
             */
            var resizeOutput = function doDrag(e) {
                if (window.getComputedStyle(menu).height == "1px") {
                    /** @type {number} */
                    var height = y + e.clientY - startY;
                    /** @type {number} */
                    height = height > 5 ? height : 5;
                    /** @type {string} */
                    elem.style.width = "";
                    /** @type {string} */
                    elem.style.height = height + "px";
                    /** @type {string} */
                    yAxisDivInner.style.height = newHeight - height + "px";
                } else {
                    /** @type {number} */
                    var width = oldValue + e.clientX - startX;
                    /** @type {number} */
                    width = width > 5 ? width : 5;
                    /** @type {string} */
                    elem.style.width = width + "px";
                    /** @type {string} */
                    elem.style.height = "";
                    /** @type {string} */
                    yAxisDivInner.style.height = "";
                }
            };
            /**
             * @param {?} event
             * @return {undefined}
             */
            var resetClickFn = function mouseup(event) {
                document.removeEventListener("mousemove", resizeOutput, false);
                document.removeEventListener("mouseup", mouseup, false);
                menu.classList.remove("resizing");
            };
            menu.addEventListener("mousedown", function(touch) {
                /** @type {number} */
                startX = touch.clientX;
                /** @type {number} */
                startY = touch.clientY;
                /** @type {number} */
                oldValue = parseInt(document.defaultView.getComputedStyle(elem).width, 10);
                /** @type {number} */
                y = parseInt(document.defaultView.getComputedStyle(elem).height, 10);
                /** @type {number} */
                newHeight = parseInt(window.innerHeight);
                this.classList.add("resizing");
                document.addEventListener("mousemove", resizeOutput, false);
                document.addEventListener("mouseup", resetClickFn, false);
            }, false);
            window.addEventListener("resize", function() {
                /** @type {string} */
                elem.style.width = "";
                /** @type {string} */
                elem.style.height = "";
                /** @type {string} */
                yAxisDivInner.style.height = "";
            }, false);
        })();
        if ((document.location + "").search(root) !== 0) {
            /**
             * @return {?}
             */
            parse = function build_flight_route() {
                return {
                    html: "",
                    valid: true
                };
            };
            return;
        }
        editor.addEventListener(type, update, false);
        editor.addEventListener(click, update, false);
        update();
        if (root.length !== 22 + faviconName.length) {
            /**
             * @return {undefined}
             */
            update = function analyze() {};
            return;
        }
        editor.select();
    })();
})();