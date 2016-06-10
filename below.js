
var ls = localStorage
var DRAFTKEY = "drafts"

var apis = { imgur: { url: "https://api.imgur.com/3/image"
                    , key: "5370f18a9f4d459"
                    , arg: "image"
                    , path: "data"
                    , link: "link"
                    , type: "type"
                    }
           , teknik: { url: "https://api.teknik.io/v1/Upload"
                     , key: ""
                     , arg: "file"
                     , path: "result"
                     , link: "url"
                     , type: "contentType"
                     }
           }

// Thread ID; is nullable
var tid = $("[name=t]").attr("value")
// Page number; nullable
var pg = location.pathname.split('/')[4].match(/^\d+$/).toString() || null
// preview XHR limit timeout
var pretimeout = null
// edit-mode post ID; nullable
var editPID = null

// preview element
var preve = null
// textarea element
var texte = $("#c_post-text")[0]
         || $("#fast-reply > dd > textarea")[0]
         || $("#quickcompose")[0]
// relevant textarea container element
var parnt = $("#c_post")[0] || $("#fast-reply")[0]
// quick-reply form
var qrform = $("form[action$='/post/']")


// id :: a -> a
function id(x) { return x }

// parseDef :: String -> a -> a
function parseDef(s, d) {
  try {
    return JSON.parse(s)
  } catch(e) {
    return d
  }
}

// maybe :: b -> (a -> b) -> Maybe a -> b
function maybe(a, f, m) {
  if (m) return f(m)
  else return a
}


// jsonRead :: String -> a -> IO a
function jsonRead(k, a) {
  return parseDef(localStorage[k], a)
}

// jsonWrite :: String -> a -> IO Void
function jsonWrite(k, x) {
  localStorage[k] = JSON.stringify(x)
}

// | XXX probably really slow
// draftRead :: String -> a -> Either a String
function draftRead(k, a) {
  if (! k) return a

  var ds = jsonRead(DRAFTKEY, {})

  // Months approximation
  var date = Math.floor(Date.now() / 1000 / 3600 / 24 / 30)
  // Delete drafts older than a month
  for (kt in ds) if (date - ds[kt].date > 1) {
    delete ds[kt]
    jsonWrite(DRAFTKEY, ds)
    break
  }

  if (k in ds) {
    ds[k].date = date
    // save access date
    jsonWrite(DRAFTKEY, ds)
    return ds[k].text

  } else return a
}

function draftWrite(k, a) {
  if (! k) return

  var ds = jsonRead(DRAFTKEY, {})

  // Months approximation
  var date = Math.floor(Date.now() / 1000 / 3600 / 24 / 30)
  // Delete drafts older than a month
  for (kt in ds) if (date - ds[kt].date > 1) {
    delete ds[kt]
    break
  }

  var o = { date: date, text: a }
  jsonWrite(DRAFTKEY, (a ? ds[k] = o : delete ds[k], ds))
}

// saveDraft :: IO ()
function saveDraft() {
  // Don't save edits
  if (! editPID) draftWrite(tid, this.value)
}

// quotePyramid :: Elem -> IO ()
function quotePyramid(s) {
    var qdls = document.querySelectorAll(".c_post > blockquote > div > blockquote > dl")
    for (var i = 0, l = qdls.length; i < l; i++)
        qdls[i].addEventListener("click", toggleQuote)
}

// toggleQuote :: Event -> IO ()
function toggleQuote(e) {
    var e = this.nextElementSibling
    e.style.display = e.style.display !== "block" ? "block" : "none"
}

// TODO multiquotes
function loadQuotes(pid) {
  var pids = $.zb.get_cache_session("multiquote" + tid).split('|').filter(id)
    , fid = $("[name=f]").attr("value")

  if (pids.indexOf(pid) === -1) pids.push(pid)

  var url = $.zb.stat.url + "post/?mode=2&type=4&f=" + fid + "&t=" + tid
          + "&multiquote_arr=" + pids.join('|')

  $.get(url, "", function(data) {
    var quotesText = $(data).find("#c_post-text").attr("value")
    quotesText = quotesText.trim()
    insertText(quotesText)
    makePreview()
  })
}

function loadEdit(pid) {
  var fid = $("[name=f]").attr("value")

  var url = $.zb.stat.url + "post/?mode=3&type=1&f=" + fid + "&t=" + tid
          + "&p=" + pid

  $.get(url, "", function(data) {
    var editText = $(data).find("#c_post-text").attr("value")
    insertText(editText)
    makePreview()
  })
}

// FIXME
// TODO requestAnimationFrame
// makePreview :: IO ()
function makePreview() {
  if (pretimeout === null)
    pretimeout = setTimeout(function() {
      pretimeout = null

      var q = $("#txt_quote")[0]
        , t = (q ? "[quote]" + q.value + "[/quote]" : "") + texte.value

      preview(t, function(data) {
        if (preve === null) {
          preve = document.createElement("div")
          preve.id = "c_post-preview"
          preve.innerHTML = data

          $(parnt).append(preve)

        } else preve.innerHTML = data

        // FIXME videos and embeds should not be updated unless they're changed
        // High octave
        if (window.high) high(preve)
      })

      try {
      scrollEquilibrate(preve, texte)
      } catch (e) { console.log("scrollEquilibrate " + e.toString()) }
    }, 250)
}

// preview :: String -> (XHR -> IO ()) -> IO ()
function preview(p, f) {
  var fd = new FormData()
  fd.append("task", '5')
  fd.append("post", p)

  var x = new XMLHttpRequest()
  x.addEventListener("load", function() { f(this.responseText) })
  x.open("POST", '/' + location.pathname.split('/')[1] + "/tasks/", true)
  x.send(fd)

  return x
}

// TODO use textarea caret position if no scrollbar
// get total height of e1's nodes, treat non-text as one line.
// the old algorithm should become much more precise
// scrollEquilibrate :: Elem -> Elem -> IO ()
function scrollEquilibrate(e0, e1) {
  var h = 0
    , th = 0
  // Coordinates to skip
  var holes = []
  var skips = ["IMG", "OBJECT", "IFRAME", "BLOCKQUOTE"]

  for (var i = 0, ns = e0.childNodes, l = ns.length; i < l; i++) {
    if (ns[i].nodeType === document.TEXT_NODE)
      h += textHeight(ns[i]), th += textHeight(ns[i])

    else {
      // check if image, object, so forth, mark current height
      // to skip those coordinates
      if (skips.indexOf(ns[i].tagName) !== -1) {
        holes.push([h, h + ns[i].clientHeight])
        h += ns[i].clientHeight
      
      } else {
        if (ns[i-1] && ns[i-1].tagName === "BR" && ns[i].tagName === "BR") {
          h += textHeight(ns[i])
          th += textHeight(ns[i])

        } else h += ns[i].clientHeight, th += ns[i].clientHeight
      }
    }
  }

  //console.log("h = " + h + ", th = " + th)

  // TODO Edge attraction
  //var offset = Math.round(Math.cos(Math.PI * e1.scrollTop / (e1.scrollHeight - e1.clientHeight)) * 5) * -1 * 7
  var m = e1.scrollHeight - e1.clientHeight
    , x = e1.scrollTop
    , t = 10
  var offset = Math.trunc(Math.cos(Math.PI / m * x) * -1 * (1 + t / m / (m / 100))) * t
  // Amount to scroll
  // TODO FIXME account for image holes and actually use `h`?
  var scroll = (e1.scrollTop + offset) * ((e0.scrollHeight - e0.clientHeight) / (e1.scrollHeight - e1.clientHeight))

  // Use caret position instead; there is no scrollbar for e1
  if (e1.scrollHeight <= e1.clientHeight) {
    // hacky way to account for newline dividers quantity `lines.length - 1`
    var acc = -1
    var lines = e1.value.split('\n')

    for (var i = 0, l = lines.length; i < l; i++) {
        acc += lines[i].length + 1
        if (e1.selectionStart <= acc) {
          scroll = Math.min(1, i) * ((i + 1) / l) * h // (e0.scrollHeight - e0.clientHeight)
          break
        }
    }

    //console.log("Line: " + i + "; Scroll: " + scroll)
  }

  // FIXME not working?
  // Hole-skipping loop
  /*
  console.log(holes.map(function(xs) {
    return Math.floor(xs[0]) + " - " + Math.floor(xs[1])
  }))
  */
  var b = false
  for (var i = 0, l = holes.length; i < l; i++) {
    // within hole's precinct
    if (holes[i][0] < scroll && holes[i][1] > scroll) {
      //console.log(holes[i][0] + " < " + scroll + " < " + holes[i][1])
      // skip to hole's lower edge
      scroll = holes[i][1]
      console.log("new " + scroll)

      // we only need to match one hole per scroll
      // XXX or do we?
      break
    }
  }

  e0.scrollTop = scroll
}

// textHeight :: TextNode -> Int
function textHeight(tn) {
  var r = document.createRange()
  r.selectNodeContents(tn)
  var rect = r.getBoundingClientRect()
  return rect.bottom - rect.top
}

// uploadFiles :: FileList -> IO Void
function uploadFiles(files) {
  console.info("Uploading files")

  if (files.length > 0) $(ub)[0].classList.add("pulse")

  var done = 0

  for (var i = 0, l = files.length; i < l; i++) {
    var api
    var xhr = new XMLHttpRequest()

    if (files[i].type.match(/^image/) && files[i].size < Math.pow(10, 7)) {
      api = "imgur"
      xhr.open("POST", apis.imgur.url)
      xhr.setRequestHeader("Authorization", "Client-ID " + apis.imgur.key)

    } else {
      api = "teknik"
      xhr.open("POST", apis.teknik.url)
    }

    var fd = new FormData()
    fd.append(apis[api].arg, files[i])

    xhr.onload = (function(api) { return function(e) {
      console.info(this.responseText)
      var json = parseDef(this.responseText, null)
      json.api = api
      maybe(null, insertFile, json)

      done++
      if (done === files.length) $(ub)[0].classList.remove("pulse")
    }})(api)
    xhr.ontimeout = function(e) {
      done++
      if (done === files.length) $(ub)[0].classList.remove("pulse")
    }

    xhr.send(fd)
  }
}

// insertFile :: Object (Object _) -> IO Void
function insertFile(o) {
  var api = apis[o.api]
  var data = o[api.path]
  console.info(api), console.info(data), console.info(data[api.link])

  var link = data[api.link]
  if (data[api.type].match(/^image/i)) link = "[img]" + link + "[/img]"

  insertText(link)

  makePreview()
  saveDraft()
}

// insertText :: String -> IO Void
function insertText(s) {
  var ss = texte.selectionStart
    , se = texte.selectionEnd
  texte.value = texte.value.substr(0, ss)
              + s
              + texte.value.substr(se, texte.value.length)
}

// | Close [parent] button
var cb = $("<input>", { type: "button"
                      , value: "x"
                      , class: "close-button" 
                      }).bind("click", function(e) {
                          // Hide button
                          this.parentNode.classList.remove("show-bottom")
                          // Delete draft and clear
                          draftWrite(tid, null)
                          texte.value = ""
                          preve.innerHTML = ""

                          // Reset from possible edit-mode
                          $(parnt).find("[type=submit]:first").text("Add Reply")
                          var form = parnt.parentNode
                          $(form).children("[name=mode]").attr("value", 2)
                          $(form).children("[name=p]").remove()
                          $(form).children("[name=pg]").remove()
                          editPID = null
                      })

// | File upload button
var ub = $("<label class='btn_fake btn_normal'>\uf093<input type=file hidden multiple></label>")


function main() {
  quotePyramid()

  // Scroll sync event
  $(texte).bind("scroll keyup", function(e) {
    scrollEquilibrate(preve, texte)
  })

  // Auto-preview event
  $(texte).bind("input focusout", makePreview)

  // Draft saving event
  $(texte).bind("input focusout", saveDraft)

  // Quick Reply spawn event
  $(".topic-buttons").bind("click", function(e) {
    if (e.button === 0) {
      e.preventDefault()
      $("#fast-reply")[0].classList.add("show-bottom")
    }
  })

  // Quick Reply quote event
  $(".right > [href*='mode=2']").off("click").bind("click", function(e) {
    if (e.button === 0) {
      e.preventDefault()
      loadQuotes(this.href.match(/&p=(\d+)/)[1])
      $("#fast-reply")[0].classList.add("show-bottom")
    }
  })

  // Quick Reply edit event
  $(".left > [href*='mode=3']").bind("click", function(e) {
    if (e.button === 0) {
      e.preventDefault()
      editPID = this.href.match(/&p=(\d+)/)[1]
      loadEdit(editPID)
      var form = parnt.parentNode
      $(form).children("[name=mode]").attr("value", "3")
      $(form).append($("<input type=hidden name=p>").attr("value", editPID))
      $(form).append($("<input type=hidden name=pg>").attr("value", pg))
      $(parnt).find("[type=submit]:first").text("Edit Post")
      $("#fast-reply")[0].classList.add("show-bottom")
    }
  })

  // XXX this may lead to unwanted deletion because qrform might
  //     be selected in other parts of the webpage; it's too general
  // Save state as replying onsubmit to prepare for draft discarding
  $(qrform).bind("submit", function(e) {
    localStorage.reply = true
  })

  window.addEventListener("dragover", function(e) {
    e.stopPropagation()
    e.preventDefault()

    // Show fast-reply
    $("#fast-reply")[0].classList.add("show-bottom")

    texte.style.backgroundColor = "#39C"

    var dt = e.dataTransfer
    dt.dropEffect = 'copy'
  })

  window.addEventListener("dragleave", function(e) {
    texte.style.backgroundColor = null
  })

  window.addEventListener("drop", function(e) {
    e.stopPropagation()
    e.preventDefault()
  })

  // Drag & drop files
  $(texte).bind("drop", function(e) {
    e.stopPropagation()
    e.preventDefault()

    this.style.backgroundColor = null

    var dt = e.originalEvent.dataTransfer
    uploadFiles(dt.files)
  })

  // Paste files
  texte.addEventListener("paste", function(e) {
    var items = e.clipboardData.items
    for (var k in items) if (items[k].kind === "file") {
      var b = items[k].getAsFile()
      uploadFiles([b])
    }
  })

  // Add closing button to Quick Reply
  $("#fast-reply").prepend(cb)
  $(parnt).find("dd").append(ub)
  $(ub).find("input").bind("change", function(e) {
    uploadFiles(this.files)
  })

  // TODO TODO TODO check for errors
  // Successful reply; discard draft
  if (localStorage.reply) {
    draftWrite(tid, null)
    delete localStorage.reply
  }

  // Open Quick Reply on load if a draft exists
  if (draftRead(tid)) parnt.classList.add("show-bottom")

  console.log("Loading draft " + tid)
  // Add saved draft to textarea if applicable
  texte.value = draftRead(tid, texte.value)

  makePreview()

  // Pretty-print code tags
  $("code").each(function(c) {
    c.classList.add("prettyprint")
  })
}

main()

